# FINCRAFT Ant Farm Redesign

## Overview

Transform from button-based game simulation to data-driven financial visualization. Each financial account becomes a building. Activity flows continuously based on balances. Feels like an ant farm / second life that reflects your finances.

## Data Model

```js
{
  accounts: {
    creditCards: [
      { id: string, name: string, balance: number, apr: number }
    ],
    depository: [
      { id: string, name: string, balance: number }
    ],
    investments: [
      { id: string, name: string, balance: number }
    ],
    loans: [
      { id: string, name: string, balance: number, apr: number }
    ],
    others: [
      { id: string, name: string, balance: number }
    ]
  },
  timeView: '1W' | '1M' | '3M' | 'YTD' | '1Y',
  playbackSpeed: 1 | 1.5 | 2
}
```

Data persists to localStorage.

## Building Types & Lore

### Good Buildings (depository/investments)
- Spawn worker peons carrying gold to town hall
- Higher balance = more frequent spawns
- Visual: mines, workshops, farms, banks
- Placed west/north of town hall

### Hell Portals (credit cards/loans)
- Spawn demons that drain from town hall
- Higher balance = larger/more frequent enemies
- APR affects enemy strength
- Visual: glowing portals, corrupted ground
- Placed east/south of town hall

### Others
- Positive balance = good building
- Negative balance = hell portal

## Spawn Rate Formula

```
spawnsPerMinute = (balance / 1000) * timeMultiplier * playbackSpeed
```

## UI Layout

```
┌─────────────────────────┐
│ [1W] [1M] [3M] [YTD] [1Y] │  time view tabs
│ [1x] [1.5x] [2x]          │  speed controls
├─────────────────────────┤
│ ▼ DEPOSITORY            │  accordion
│   Checking      $5,000  │
│   [+ Add Account]       │
├─────────────────────────┤
│ ▶ INVESTMENTS           │
├─────────────────────────┤
│ ▶ CREDIT CARDS          │
├─────────────────────────┤
│ ▶ LOANS                 │
├─────────────────────────┤
│ ▶ OTHERS                │
├─────────────────────────┤
│ NET WORTH: $XX,XXX      │
│ TOTAL DEBT: $XX,XXX     │
└─────────────────────────┘
```

### Line Item Interactions
- Click to edit name/amount inline
- Delete button on hover
- "+ Add" at bottom of each section

## Building Placement

```
        [INVESTMENTS]
             ↓
[DEPOSITORY] 🏰 [CREDIT CARDS]
             ↑
         [LOANS]

[OTHERS scattered based on +/-]
```

- Auto-placed in zone with random offset
- No overlap
- Fade out on delete
- Scale adjusts with balance

## Time Views

| View | Days | Density |
|------|------|---------|
| 1W   | 7    | sparse  |
| 1M   | 30   | moderate|
| 3M   | 90   | busy    |
| YTD  | varies| varies |
| 1Y   | 365  | chaos   |

Time compression: viewDays / 60 seconds base loop

## Playback Speed
- 1x = normal
- 1.5x = 50% faster
- 2x = double speed

## Ant Farm Behavior
- Always units moving
- Idle workers wander near buildings
- Demons patrol near portals
- Constant ambient activity

## Implementation Notes
- Buildings: procedural graphics initially
- Sound: none for now
- Future: individual transaction support for day/week loops
