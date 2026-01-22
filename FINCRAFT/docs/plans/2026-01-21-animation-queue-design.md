# Animation Queue System

## Overview
Event-driven animation system that visualizes financial transactions as game units. Expenses spawn creeps that attack town hall, debt payments spawn infantry that attack debt buildings.

## Core Architecture

### EventQueue Class
- Buffer between transaction sources (test UI now, Plaid later) and game engine
- Handles aggregation based on time view
- Methods: `push(event)`, `pop()`, `aggregate()`

### Event Types
- `expense` - spawns wild creep targeting town hall
- `debt-payment` - spawns infantry targeting specific debt building

### Aggregation Logic
- 1W/1M: show individual events
- 3M/YTD/1Y: merge same-category events, sum amounts, scale unit size

## Unit Types

### Wild Creep (expenses)
- Spawns from random map edge
- Marches toward town hall
- Size scales with amount ($20 small, $1500 chonky)
- Damage particle on arrival

### Infantry (debt payments)
- Spawns from town hall
- Targets specific debt building
- Size scales with payment amount
- Attack animation + positive particle on arrival

## Pacing
- ~1 event/second at 1x speed
- Playback speed multiplier applies
- Idle when queue empty

## Test UI Panel
Bottom-left, collapsible. Buttons for common expenses/payments plus custom amount field.

```
[SIM] v
|- Expenses: [Gas $25] [Food $50] [Rent $1500]
|- Debt Payments: [CC $100] [Loan $200]
|- [Custom $___] [Send]
```

Show via localStorage flag `fincraft-sim-panel`.

## Data Flow
```
Button click
-> EventQueue.push({ type, amount, targetId? })
-> Queue aggregates based on timeView
-> GameLoop pops & spawns units
```

## Implementation Order
1. EventQueue class in new file
2. Wild creep unit + spawning
3. Infantry unit + spawning
4. Test UI panel in App.jsx
5. Wire up queue processing in game loop
