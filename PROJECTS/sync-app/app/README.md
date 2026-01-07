# sync mobile app

expo + react native app for sync

## setup

```bash
npm install
```

## dependencies to install

```bash
# supabase client
npm install @supabase/supabase-js

# webrtc (daily.co for mvp)
npm install @daily-co/react-native-daily-js
npm install @daily-co/react-native-webrtc

# expo modules
npm install expo-linking
npm install expo-contacts
npm install expo-secure-store
npm install expo-haptics
npm install expo-notifications
npm install expo-build-properties

# navigation (optional, add when building UI)
npm install @react-navigation/native
npm install @react-navigation/native-stack
npm install react-native-screens react-native-safe-area-context
```

## run

```bash
# ios
npm run ios

# android
npm run android

# expo go (dev)
npx expo start
```

## structure

```
src/
├── screens/          # ui screens
│   ├── HomeScreen.tsx
│   ├── SeekingScreen.tsx
│   └── CallScreen.tsx
├── services/         # backend integration
│   ├── supabase.ts
│   ├── presence.ts
│   ├── handshake.ts
│   └── webrtc.ts
├── hooks/            # react hooks
│   ├── usePresence.ts
│   ├── useSyncRequests.ts
│   └── useContacts.ts
└── types/            # typescript types
```

## env setup

create `.env` file:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_DAILY_API_KEY=your_daily_api_key
```

## next steps

1. install dependencies
2. create `.env` file with supabase credentials
3. create services layer (supabase client, handshake logic)
4. build basic UI (friend list, seeking, call)
5. test locally with 2 devices
