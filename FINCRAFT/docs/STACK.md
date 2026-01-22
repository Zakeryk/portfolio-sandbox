# tech stack 🔧

## data layer (the pipes)

### plaid (primary)
- what copilot/venmo/robinhood uses
- handles bank login security + transaction fetching
- best docs for solo devs
- **expensive**: pay per connected account

### alternatives
- **mx**: sometimes cheaper
- **finicity**: another option
- both have worse dx than plaid

## frontend

### web (current)
- **react + vite**: fast dev, hot reload
- **canvas/pixi.js**: 2d game rendering
- good for prototyping

### native (future ios)
- **swift + swiftui**: native performance for widgets
- **spritekit**: apple's 2d engine
  - integrates seamlessly w/ swiftui overlays
  - way less battery than unity
  - perfect for isometric wc3 aesthetic

## backend

### firebase/supabase
- negligible cost at small scale
- realtime sync
- auth built in

## widget ecosystem

### ios
- **home screen**: mini-map widget (town hall health + incoming threats)
- **lock screen**: resource counters (gold/wood)

### macos
- menu bar app or live wallpaper
- idle animation of peons when you get paid

## carplay (hard stop ⚠️)

apple carplay rules are strict:
- allowed: audio, nav, comms, ev charging
- NOT allowed: interactive games (driver safety)

### possible workarounds
- "communication" entitlement for overspending alerts
- "parking/ev" category as vehicle expense tracker
- full rts view = 99% rejection chance
