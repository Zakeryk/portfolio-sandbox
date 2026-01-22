# game mechanics 🎮

mapping financial data to rts entities

## buildings

### town hall (net worth)
- central building
- health bar = total net worth
- **level up milestones**: $10k → $50k → $100k → etc
- visual upgrades at each tier

### gold mines (income sources)

| income type | game entity |
|-------------|-------------|
| paycheck | peons walking gold on 1st/15th |
| investments | passive mines (auto trickle) |
| side income | secondary mines |

## enemies (expenses)

### unit types

| expense | enemy unit | behavior |
|---------|------------|----------|
| daily txns (coffee, gas) | zerglings/grunts | small, frequent, chip damage |
| rent/mortgage | siege units | big hit once/month |
| subscriptions | recurring spawns | predictable waves |

### creep/blight (debt)
- represents interest on debt
- **spreads** if you don't clean it (pay it off)
- visual corruption on map
- increases spawn rate of enemies

## defenses (budgeting)

### towers = budget categories
- example: "food tower", "transport tower"
- **ammo** = allocated budget for that category
- when transaction (enemy) comes in, tower shoots it down
- tower runs out of ammo → enemy gets through → damages town hall

### walls = emergency fund
- buffer protection
- takes hits before town hall
- visual: higher walls = bigger e-fund

## game loop

```
1. income event → peons spawn, walk gold to town hall
2. transaction event → enemy unit spawns
3. tower auto-targets matching category
4. if budget exceeded → enemy reaches town hall
5. net worth updates → town hall health changes
6. milestones → level up animations
```

## visual feedback

- **green particles**: money in
- **red particles**: money out
- **screen shake**: big expense hit
- **celebration**: milestone reached
- **alarm**: budget category exceeded
