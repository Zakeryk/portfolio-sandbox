# SYNC

double-blind handshake call app. 1min window for instant calls, 24h window for quantum pings.

## structure

```
sync-app/
├── _PROJECT_MAP.md      # vision, vibe, laws
├── _TECH_SPEC.md        # stack, schema, logic
├── _LOG.md              # build progress log
├── app/                 # expo/react native app
│   ├── src/
│   │   ├── screens/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── types/
│   ├── app.json         # expo config + deep linking
│   └── README.md        # app setup instructions
└── supabase/
    ├── migrations/      # db schema
    └── functions/       # edge functions (future)
```

## quick start

### 1. setup supabase
```bash
# option A: via cli
cd sync-app
supabase init
supabase start
supabase db reset  # runs migrations

# option B: via dashboard
# create project at supabase.com
# copy connection string
# run migrations manually
```

### 2. install app deps
```bash
cd app
npm install
npm install @supabase/supabase-js @daily-co/react-native-daily-js expo-linking expo-contacts
```

### 3. configure env
create `app/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=your_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key
EXPO_PUBLIC_DAILY_API_KEY=your_daily_key
```

### 4. run dev server
```bash
cd app
npx expo start
```

## core features

### instant call (1 min window)
- tap friend → seeking mode (pulsing UI)
- if they tap back within 1min → instant webrtc audio
- if not → silent expiry, no trace

### quantum ping (24h window)
- long-press friend → send silent ping
- if they ping you back within 24h → "crossed minds" notification to both
- if not → silent expiry

## next steps

see `_LOG.md` for current progress and next tasks

## docs

- `_PROJECT_MAP.md` - the why (vision, vibe, laws)
- `_TECH_SPEC.md` - the how (stack, schema, flows)
- `_LOG.md` - the what (build log, decisions, blockers)
