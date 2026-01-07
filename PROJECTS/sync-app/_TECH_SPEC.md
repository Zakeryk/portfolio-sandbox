# SYNC - technical specification

## stack

### backend
- **supabase** (postgres + real-time + auth)
- hosted postgres db
- real-time subscriptions for presence + seeks
- auth via phone OTP

### mobile
- **expo** (react native)
- managed workflow for faster iteration
- works on iOS + Android from single codebase

### interactions
- **instant call**: 1min window, real-time matching, immediate webrtc connection
- **quantum ping**: 24h window, silent send, "crossed minds" on mutual match

### real-time audio
- **webrtc** for peer-to-peer calls
- options:
  - `simple-peer` (lightweight, manual setup)
  - `daily.co` sdk (easier, managed TURN servers)
  - **recommendation**: daily.co for mvp, migrate to simple-peer if needed

### deep linking
- expo's built-in linking config
- universal links (iOS) + app links (Android)
- format: `sync.app/@username`

## database schema

### users table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_username ON users(username) WHERE username IS NOT NULL;
```

**fields:**
- `phone`: normalized phone number (E.164 format)
- `username`: optional, globally unique, alphanumeric + underscore only
- `display_name`: shown in friend list (can be nickname)
- `avatar_url`: profile pic (optional, stored in supabase storage)
- `last_seen_at`: updated on heartbeat for presence

### friendships table
```sql
CREATE TYPE friendship_source AS ENUM ('contact', 'link');

CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source friendship_source NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

CREATE INDEX idx_friendships_user ON friendships(user_id);
CREATE INDEX idx_friendships_friend ON friendships(friend_id);
```

**rules:**
- friendships are **mutual** (require both A→B and B→A rows)
- `source` tracks how they connected:
  - `contact`: matched via phone number sync
  - `link`: added via @username link
- deleting a user cascades to their friendships

### sync_requests table (handles both calls + pings)
```sql
CREATE TYPE sync_status AS ENUM ('seeking', 'matched', 'expired');
CREATE TYPE signal_type AS ENUM ('call', 'ping');

CREATE TABLE sync_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type signal_type NOT NULL DEFAULT 'call',
  status sync_status DEFAULT 'seeking',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  matched_at TIMESTAMPTZ,
  CHECK (from_user_id != to_user_id),
  CHECK (expires_at > created_at)
);

CREATE INDEX idx_sync_requests_active ON sync_requests(to_user_id, type, status, expires_at)
  WHERE status = 'seeking';
```

**lifecycle:**

**call (1 minute window):**
1. user A seeks user B → insert with `type = 'call'`, `expires_at = now + 1min`
2. user B responds within 1min → update `status = 'matched'`, initiate webrtc
3. if 1min passes → `status = 'expired'`

**quantum ping (24 hour window):**
1. user A pings user B → insert with `type = 'ping'`, `expires_at = now + 24h`
2. **no notification sent to B**
3. if B pings A within 24h → update both pings to `status = 'matched'`
4. send push notification to **both** A & B: "Crossed Minds"
5. if 24h passes → `status = 'expired'` silently

**queries:**
- find active seeks for user: `WHERE to_user_id = $1 AND status = 'seeking' AND expires_at > now()`
- check if A & B mutually seeking: check both directions within time window

### presence table (optional, can use supabase presence instead)
```sql
CREATE TABLE presence (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT false,
  last_heartbeat TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_presence_online ON presence(is_online, last_heartbeat);
```

**alternative**: use supabase's built-in presence feature (recommended for mvp)

## real-time subscriptions

### 1. presence channel
- subscribe to friends' online status
- each client broadcasts heartbeat every 30sec
- mark user offline if no heartbeat for 60sec

**client code (pseudocode):**
```ts
const channel = supabase.channel('presence')
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState()
    // update UI with online friends
  })
  .subscribe()

// heartbeat
setInterval(() => {
  channel.track({ user_id, online: true })
}, 30000)
```

### 2. sync_requests subscription
- listen for incoming seeks
- filter: `to_user_id = current_user AND status = 'seeking'`

**client code (pseudocode):**
```ts
supabase
  .channel('sync_requests')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'sync_requests',
      filter: `to_user_id=eq.${userId}`
    },
    (payload) => {
      const request = payload.new
      if (request.status === 'seeking' && request.expires_at > Date.now()) {
        // highlight friend in UI
      }
    }
  )
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'sync_requests',
      filter: `from_user_id=eq.${userId}`
    },
    (payload) => {
      if (payload.new.status === 'matched') {
        // initiate webrtc call
      }
    }
  )
  .subscribe()
```

## auth flow

### phone authentication
1. user enters phone number
2. supabase sends OTP via SMS
3. user enters code
4. supabase verifies → returns session token
5. client stores token in secure storage

**supabase config:**
- enable phone auth in dashboard
- configure twilio or supabase's built-in SMS provider

### contact sync (privacy-respecting)
1. request permission to access contacts
2. hash phone numbers client-side (SHA-256)
3. send hashed numbers to server
4. server matches against hashed `users.phone`
5. return matched user IDs (not raw phone numbers)
6. client creates friendship rows for matches

**privacy:**
- never send raw phone numbers of non-users to server
- hashing prevents server from learning contacts

## interaction flows

### 1. instant call (1 minute window)

#### scenario: user A seeks user B for immediate call

**step 1: A taps B's name**
```ts
// client A
async function seekFriend(friendId: string) {
  const { data, error } = await supabase
    .from('sync_requests')
    .insert({
      from_user_id: currentUserId,
      to_user_id: friendId,
      status: 'seeking',
      expires_at: new Date(Date.now() + 60000) // 1 min from now
    })
    .select()

  if (!error) {
    // show pulsing UI
    startSeekingAnimation()

    // listen for match
    watchForMatch(data.id)
  }
}
```

**step 2: B sees incoming seek (if app is open)**
- real-time subscription fires
- check `expires_at` - if already expired, ignore
- highlight A's name with subtle glow

**step 3: B taps A's name (mutual seek)**
```ts
// client B
async function respondToSeek(requestId: string) {
  const { data, error } = await supabase
    .from('sync_requests')
    .update({
      status: 'matched',
      matched_at: new Date()
    })
    .eq('id', requestId)
    .eq('status', 'seeking') // prevent race conditions
    .select()

  if (!error && data.length > 0) {
    // initiate webrtc
    initiateCall(data[0].from_user_id)
  }
}
```

**step 4: both clients get match notification**
- A's subscription fires on UPDATE
- both transition to call screen
- webrtc handshake begins

**step 5: if 60 seconds pass without match**
```ts
// client A (timer)
setTimeout(() => {
  supabase
    .from('sync_requests')
    .update({ status: 'expired' })
    .eq('id', requestId)
    .eq('status', 'seeking')

  // fade out pulsing UI silently
  endSeekingAnimation()
}, 60000)
```

### 2. quantum ping (24 hour window)

#### scenario: user A sends quantum ping to user B

**step 1: A long-presses (or swipes) B's name**
```ts
// client A
async function sendQuantumPing(friendId: string) {
  const { data, error } = await supabase
    .from('sync_requests')
    .insert({
      from_user_id: currentUserId,
      to_user_id: friendId,
      type: 'ping',
      status: 'seeking',
      expires_at: new Date(Date.now() + 86400000) // 24 hours
    })
    .select()

  if (!error) {
    // subtle haptic feedback
    // no visible UI change
    // silent send
  }
}
```

**step 2: B has no idea (yet)**
- **no notification**
- **no UI change**
- B's app silently tracks active pings in background

**step 3: B independently pings A (within 24h)**
```ts
// client B (same function as above, but check for mutual)
async function sendQuantumPing(friendId: string) {
  // first, insert B's ping
  const { data: newPing } = await supabase
    .from('sync_requests')
    .insert({
      from_user_id: currentUserId,
      to_user_id: friendId,
      type: 'ping',
      status: 'seeking',
      expires_at: new Date(Date.now() + 86400000)
    })
    .select()

  // then check if friendId already pinged us
  const { data: mutualPing } = await supabase
    .from('sync_requests')
    .select()
    .eq('from_user_id', friendId)
    .eq('to_user_id', currentUserId)
    .eq('type', 'ping')
    .eq('status', 'seeking')
    .gte('expires_at', new Date().toISOString())
    .single()

  if (mutualPing) {
    // MATCH! update both to matched
    await supabase
      .from('sync_requests')
      .update({ status: 'matched', matched_at: new Date() })
      .in('id', [newPing.id, mutualPing.id])

    // send push notification to BOTH users
    await sendCrossedMindsPush(currentUserId, friendId)
  }
}
```

**step 4: both get "crossed minds" notification**
- push notification: "🧠 Crossed Minds with [friend name]"
- opens app → special screen showing the match
- optional: transition to call screen or just acknowledgment

**step 5: if 24h passes without mutual ping**
- background job marks ping as expired
- no notification
- silent cleanup

#### ui considerations for quantum pings
- **send**: long-press friend name → subtle haptic → no visual feedback
- **mutual match**: push notification + special "crossed minds" screen
- **history**: optional "ping log" showing past crossed minds (not who initiated)

## webrtc flow

### using daily.co (recommended for mvp)
```ts
import Daily from '@daily-co/react-native-daily-js'

// on match
async function initiateCall(peerId: string) {
  // create ephemeral room via daily.co api
  const room = await createDailyRoom({ peerId })

  // join room
  const call = Daily.createCallObject()
  await call.join({ url: room.url })

  // listen for peer join
  call.on('participant-joined', () => {
    // show call UI
  })
}
```

**daily.co benefits:**
- handles TURN servers (for NAT traversal)
- automatic reconnection
- easy to implement
- free tier: 10k minutes/month

### alternative: simple-peer (for p2p without third party)
- more complex setup
- need custom signaling server (can use supabase real-time)
- need TURN server for NAT traversal (can use free STUN servers)

## deep linking flow

### 1. user creates username
```ts
async function createUsername(username: string) {
  const { error } = await supabase
    .from('users')
    .update({ username })
    .eq('id', currentUserId)

  if (!error) {
    // generate shareable link
    const link = `https://sync.app/@${username}`
    // show share sheet
  }
}
```

### 2. recipient opens link
**if app installed:**
- deep link opens app
- navigate to "add friend" screen
- show username + preview (avatar, display name)
- prompt: "add [username] as friend?"

**if app not installed:**
- redirect to app store
- after install, reopen link → deep link triggers

### 3. recipient confirms
```ts
async function addFriendViaLink(username: string) {
  // lookup user by username
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single()

  if (user) {
    // create mutual friendship
    await supabase.from('friendships').insert([
      { user_id: currentUserId, friend_id: user.id, source: 'link' },
      { user_id: user.id, friend_id: currentUserId, source: 'link' }
    ])
  }
}
```

## expo configuration

### app.json (linking config)
```json
{
  "expo": {
    "scheme": "sync",
    "ios": {
      "associatedDomains": ["applinks:sync.app"]
    },
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [{ "scheme": "https", "host": "sync.app" }],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

### deep link handling
```ts
import * as Linking from 'expo-linking'

Linking.addEventListener('url', ({ url }) => {
  const parsed = Linking.parse(url)
  if (parsed.path?.startsWith('@')) {
    const username = parsed.path.slice(1)
    navigateToAddFriend(username)
  }
})
```

## security considerations

### 1. rate limiting
- limit seeks per user: max 10/hour (prevent spam)
- implement via supabase postgres function or edge function

### 2. block/report
- `blocked_users` table for user-level blocks
- prevent seeks from/to blocked users

### 3. phone verification
- require verified phone number before using app
- prevents fake accounts

### 4. username squatting prevention
- require account activity before username creation
- or: paid username reservation ($1 one-time)

## analytics (optional)

### track (privacy-respecting):
- match rate: matched seeks / total seeks
- response time: time between seek sent → matched
- network density: active friendships / total friendships
- retention: weekly active users who sync

### do NOT track:
- who seeks whom (beyond what's needed for functionality)
- call content or duration (unless user opts in)
- contacts list (only hashed matching)

## deployment

### supabase
1. create project at supabase.com
2. run migrations via supabase cli
3. configure auth providers (phone)
4. set up storage bucket for avatars

### expo
1. develop on expo go (dev)
2. build with EAS (expo application services)
3. submit to app store + play store

### domain
- register `sync.app` (or alternative)
- configure universal links / app links
- set up simple landing page with app store links

## next steps
1. init supabase project
2. write + run migration sql
3. init expo app with typescript
4. install deps (supabase-js, daily-co, expo-contacts)
5. build basic UI (home, seeking, call screens)
6. implement handshake logic
7. test locally with 2 devices
8. deploy alpha to testflight
