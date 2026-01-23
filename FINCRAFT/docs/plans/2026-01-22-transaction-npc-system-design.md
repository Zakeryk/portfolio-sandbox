# transaction npc system design

## overview

ambient ant-farm simulation where NPCs represent real transactions from the last 30 days. spawns are proportional to transaction frequency - busy spender = busy city.

## npc types by transaction

- **expenses** (positive amounts) - spawn from matched account building (or map edge if no match), walk toward town hall
- **income** (negative amounts) - spawn from mine, walk toward matched account building (or town hall if no match)
- **internal transfers** - spawn from source account building, walk to destination account building

## spawn logic

**spawn pool:** on load, filter transactions to last 30 days. this becomes the "spawn pool" that npcs randomly pull from.

**spawn rate formula:**
```
baseInterval = 1000ms (1 npc per second at baseline)
spawnInterval = baseInterval / (poolSize / 30) / playbackSpeed
```
90 transactions in 30 days = 3 npcs/second. 300 transactions = 10 npcs/second.

**spawn selection:** each spawn randomly picks a transaction from the pool. same transaction can spawn multiple times (ambient, not replay).

## account matching (fuzzy)

1. normalize both strings: lowercase, remove "card", "account", "checking", "savings", "credit", "debit"
2. check if normalized csv account contains normalized building name (or vice versa)
3. no match = spawn from map edge (expenses) or mine (income)

## npc paths & movement

**expense npcs:**
- spawn at matched account building (or random map edge if no match)
- walk toward town hall
- on arrival: despawn + particle effect "-$X"

**income npcs:**
- spawn at mine
- walk toward matched account building (or town hall if no match)
- on arrival: despawn + particle effect "+$X"

**internal transfer npcs:**
- spawn at source account building
- walk toward destination account building
- on arrival: despawn + neutral particle effect (no +/-)
- visually distinct color (blue/cyan)

**movement:** reuse existing wandering behavior. speed scales with playback speed.

## npc visuals & interaction

**size scaling:**
- min size: $1-$20 transactions (tiny, ~8px)
- max size: $2000+ transactions (chonky, ~24px)
- formula: `size = 8 + Math.min(16, Math.log10(amount) * 6)`

**colors by type:**
- expense: red/orange (existing creep color)
- income: gold/yellow (existing peon color)
- internal transfer: blue/cyan (new)

**edit mode features:**
- hovering npc shows floating label with transaction name
- clicking npc shows tooltip with full details (name, amount, date, account)

**normal mode:**
- npcs are anonymous, no labels
- clean ambient vibe

## implementation approach

**new code:**
- `TransactionNPCSystem` in GameEngine.js or separate file
- handles spawn pool, spawn timing, fuzzy matching, npc creation

**modifications:**
- `GameEngine.init()` - initialize transaction system, load from localStorage
- `GameEngine.gameLoop()` - tick the transaction spawner
- reuse existing unit movement/despawn logic

**fuzzy match helper:**
```js
normalizeAccountName(name) {
  return name.toLowerCase()
    .replace(/\b(card|account|checking|savings|credit|debit)\b/g, '')
    .replace(/\s+/g, ' ').trim()
}

findMatchingBuilding(csvAccount) {
  const normalized = this.normalizeAccountName(csvAccount)
  return this.entities.buildings.find(b => {
    const buildingNorm = this.normalizeAccountName(b.name)
    return normalized.includes(buildingNorm) || buildingNorm.includes(normalized)
  })
}
```

**data flow:**
1. on init: load transactions from localStorage, filter to last 30 days
2. calculate spawn interval from pool size
3. each tick: check if spawn timer elapsed, pick random transaction, spawn npc
4. npc walks to target, despawns on arrival
