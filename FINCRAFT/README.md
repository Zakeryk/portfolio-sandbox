# FinCraft 🏰💰

net worth tracker skinned as a warcraft 3 style RTS. gamifying the "boring middle" of personal finance.

## concept

- **town hall** = net worth (health bar)
- **peons** = income (walk gold to town hall on paydays)
- **enemy units** = expenses (zerglings = daily txns, siege units = rent)
- **towers** = budget categories (ammo = allocated funds)
- **creep/blight** = debt interest (spreads if unpaid)

## stack

| layer | tech |
|-------|------|
| data aggregator | plaid (or mx/finicity) |
| frontend | react + vite |
| game engine | canvas/pixi.js (web) or spritekit (native) |
| backend | firebase/supabase |

## widgets (future)

- **ios home screen**: mini-map showing town hall health + incoming bills
- **lock screen**: resource counters (gold=cash, wood=investments)
- **macos**: menu bar idle animation

## business model

- plaid costs ~$0.30/user/mo + $1.50 link fee
- need ~$100/yr subscription to break even at scale
- target: 1000+ active users

## carplay ⚠️

apple will likely reject interactive games on carplay (safety regs). possible workaround: frame as "communication" app for overspending alerts only.

## docs

- [tech stack details](./docs/STACK.md)
- [game mechanics](./docs/MECHANICS.md)
- [business logic](./docs/BUSINESS.md)

## dev

```bash
npm install
npm run dev
```
