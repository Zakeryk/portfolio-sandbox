# SYNC - build log

## 2026-01-07 - foundation setup

### completed
- ✅ created project directory structure (`/sync-app`)
- ✅ wrote `_PROJECT_MAP.md` (vision, vibe, laws)
- ✅ wrote `_TECH_SPEC.md` (stack, schema, interaction flows)
- ✅ defined two interaction types:
  - instant call (1min window, real-time connection)
  - quantum ping (24h window, "crossed minds" on mutual)
- ✅ designed supabase schema (users, friendships, sync_requests with type column)
- ✅ wrote supabase migration sql (`supabase/migrations/001_initial_schema.sql`)
  - includes RLS policies, helper functions, triggers
  - supports both call and ping interactions
- ✅ initialized expo app with typescript
- ✅ configured deep linking in `app.json`
  - ios: associated domains for sync.app
  - android: intent filters for https links
- ✅ created src structure (screens, services, hooks, types)
- ✅ wrote app/README.md with setup instructions

### next up
- [ ] set up supabase project (via cli or dashboard)
- [ ] run migration to create db schema
- [ ] add real auth flow
- [ ] implement real-time subscriptions
- [ ] build seeking/call screens
- [ ] integrate webrtc for calls
- [ ] test handshake flow with 2 devices

---

## 2026-01-07 - mvp boilerplate

### completed
- ✅ installed core dependencies (supabase-js, expo modules)
- ✅ created `.env` template + placeholder file
- ✅ wrote typescript types (User, Friend, SyncRequest)
- ✅ scaffolded services layer:
  - `services/supabase.ts` - client setup
  - `services/handshake.ts` - sync request logic
- ✅ built HomeScreen with mock data:
  - friend list with online status
  - tap to seek (1min window simulation)
  - long-press for quantum ping
  - seeking state visualization
- ✅ updated App.tsx to render HomeScreen

### to run locally
```bash
cd app
npm install  # if not done already
npx expo start
# press 'i' for ios simulator or 'a' for android
```

**note**: currently using mock data. supabase integration works but needs real project setup.

### decisions made
- **backend**: supabase (postgres + real-time + auth)
- **mobile**: expo (react native)
- **calls**: daily.co sdk (easier mvp, can migrate to simple-peer later)
- **friends**: phone contacts (primary) + username links (secondary, no search)
- **call window**: 1 minute (tight, high stakes)
- **ping window**: 24 hours (lower stakes, serendipitous)

### open questions
- [ ] daily.co sdk vs simple-peer for webrtc?
- [ ] call history stored or fully ephemeral?
- [ ] push notifications when someone seeks (if app backgrounded)?
- [ ] analytics tracking (match rate, window success)?
- [ ] domain name for deep links (sync.app)?

---

## template for future entries

### yyyy-mm-dd - [milestone name]

#### completed
- ✅ thing 1
- ✅ thing 2

#### blockers
- ⚠️ issue description

#### learnings
- insight 1
- insight 2

#### next
- [ ] todo 1
- [ ] todo 2
