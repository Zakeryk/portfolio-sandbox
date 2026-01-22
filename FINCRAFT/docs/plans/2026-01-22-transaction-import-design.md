# transaction import & timeline playback design

## overview

add csv transaction import with hybrid timeline playback. maintains perpetual ant farm feel while allowing historical transaction replay with timeline scrubbing.

## data structure

### transaction storage (localStorage: `fincraft-transactions`)

```js
{
  transactions: [
    {
      id: "txn_abc123",
      date: "2026-01-21",           // iso date string
      timestamp: 1737417600000,     // unix timestamp for sorting
      name: "Mcdonald's",
      amount: 9.63,                 // always positive
      category: "Restaurants",
      parentCategory: "Food & Drink",
      type: "expense" | "income",   // normalized from csv
      account: "Apple Card"
    }
  ],
  dateRange: {
    earliest: "2026-01-01",
    latest: "2026-01-21"
  },
  categories: ["Restaurants", "Groceries", ...] // extracted for ui
}
```

### csv format (user's export)

```csv
date,name,amount,status,category,parent category,excluded,tags,type,account,account mask,note,recurring
2026-01-21,Mcdonald's,9.63,posted,Restaurants,Food & Drink,false,,regular,Apple Card,,,
```

**parsing rules:**
- negative amounts = income/deposits
- positive amounts = expenses
- filter out `excluded: true` (internal transfers)
- convert to normalized structure

**storage limits:**
- localStorage ~5-10mb browser dependent
- 1.5mb csv fits comfortably
- migrate to indexedDB if needed later

## timeline & playback system

### timeline state

```js
{
  mode: "perpetual" | "playback",     // current mode
  playbackDate: "2026-01-21",         // current position in timeline
  playbackSpeed: 1,                   // multiplier (0.5x, 1x, 2x, 5x)
  dateRange: ["2026-01-01", "2026-01-21"], // selected slice
  isPaused: false
}
```

### modes

**perpetual mode** (default ant farm):
- current behavior unchanged
- manual account balances
- sim panel for manual events
- no transaction playback

**playback mode** (after csv import):
- scrub through transaction history
- transactions trigger game events at timestamps
- expenses → spawn creeps (size/type based on amount/category)
- income → spawn peons with gold
- visualize financial patterns over time

### event scheduling

- pre-process transactions into event queue sorted by timestamp
- playback advances virtual time
- when virtual time >= next event timestamp, trigger it
- reuse existing EventQueue, feed from transactions
- event mapping:
  - expenses → `pushEvent('expense', amount)`
  - income → `pushEvent('income', amount)` (new event type)

## ui components

### import panel (left sidebar)

```
┌─────────────────────────┐
│ IMPORT TRANSACTIONS     │
│ [📁 Upload CSV]         │
│                         │
│ Status: No data loaded  │
│ or                      │
│ ✓ 1,247 transactions    │
│   2025-01-01 to         │
│   2026-01-21            │
└─────────────────────────┘
```

### timeline panel (bottom overlay on canvas)

```
┌─────────────────────────────────────────┐
│ TIMELINE                                │
│ [◀◀] [◀] [⏸] [▶] [▶▶]  Speed: [1x▼]   │
│ ━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│ Jan 1, 2025        Jan 21, 2026         │
│                                         │
│ Date Range: [Jan 1▼] to [Jan 21▼]      │
│ Mode: [Perpetual] [Playback]           │
└─────────────────────────────────────────┘
```

### upload flow

1. user clicks upload button
2. file picker opens
3. parse csv with papaparse lib
4. validate required columns exist
5. store in localStorage as `fincraft-transactions`
6. show success + transaction count
7. enable timeline panel
8. switch to playback mode

## implementation approach

### dependencies

- add `papaparse` for csv parsing (lightweight, battle-tested)

### new files

- `src/utils/csvParser.js` - parse & validate csv
- `src/components/ImportPanel.jsx` - upload ui
- `src/components/TimelinePanel.jsx` - timeline controls
- `src/game/TransactionPlayback.js` - playback engine

### modifications

- `App.jsx` - add transaction state, import/timeline panels
- `GameEngine.js` - add income event handler, playback mode

### phases

1. csv parsing infrastructure
2. import ui & storage
3. timeline ui components
4. playback engine integration
5. income event visualization
