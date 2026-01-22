# business logic 💸

## cost structure

### plaid api
- ~$0.30/user/month (varies by volume/contract)
- one-time link fees: $1.50+ per new connection
- costs scale with active users

### server
- firebase/supabase: negligible at small scale
- ~$25/mo baseline for reasonable traffic

### apple dev
- $99/yr for ios app store

## pricing math

at 1,000 active users:
```
plaid:   1000 × $0.30 = $300/mo
server:  ~$25/mo
total:   ~$325/mo = ~$4k/yr

break even @ $100/yr subscription = $100k revenue
profit margin after costs: ~96%
```

### pricing tiers (proposed)

| tier | price | features |
|------|-------|----------|
| free | $0 | manual entry only, no bank sync |
| basic | $8/mo | 2 bank connections |
| pro | $12/mo | unlimited connections + widgets |

## user acquisition

### target demo
- 20-35 yo
- into gaming aesthetics
- wants to save but finds finance apps boring
- copilot/mint users who churned

### marketing angles
- "your bank account but make it warcraft"
- tiktok/reels showing the animations
- reddit r/personalfinance, r/gaming crossover

## risks

1. **plaid cost creep**: negotiate volume discount early
2. **apple rejection**: carplay dreams may die
3. **bank api changes**: plaid abstracts this but still risky
4. **copilot competition**: they have funding, we have vibes

## milestones

- [ ] mvp: web app w/ mock data
- [ ] alpha: plaid integration
- [ ] beta: ios app + widgets
- [ ] v1: subscription launch
- [ ] v2: social features (guild = shared household budget)
