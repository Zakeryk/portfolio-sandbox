/**
 * EventQueue - buffers transaction events and handles aggregation
 */
export class EventQueue {
  constructor() {
    this.events = []
    this.timeView = '1M'
    this.lastPopTime = 0
    this.popInterval = 1000 // ms between pops at 1x speed
  }

  setTimeView(timeView) {
    this.timeView = timeView
  }

  setPlaybackSpeed(speed) {
    this.popInterval = 1000 / speed
  }

  push(event) {
    // event: { type: 'expense'|'debt-payment', amount: number, category?: string, targetId?: string }
    const shouldAggregate = ['3M', 'YTD', '1Y'].includes(this.timeView)

    if (shouldAggregate) {
      // find existing event of same type/category to merge
      const existing = this.events.find(e =>
        e.type === event.type &&
        e.category === event.category &&
        e.targetId === event.targetId
      )
      if (existing) {
        existing.amount += event.amount
        existing.count = (existing.count || 1) + 1
        return
      }
    }

    this.events.push({ ...event, count: 1, timestamp: Date.now() })
  }

  pop() {
    if (this.events.length === 0) return null
    return this.events.shift()
  }

  peek() {
    return this.events[0] || null
  }

  isEmpty() {
    return this.events.length === 0
  }

  clear() {
    this.events = []
  }

  size() {
    return this.events.length
  }

  // check if enough time passed to pop next event
  canPop(currentTime) {
    if (this.isEmpty()) return false
    return (currentTime - this.lastPopTime) >= this.popInterval
  }

  popIfReady(currentTime) {
    if (this.canPop(currentTime)) {
      this.lastPopTime = currentTime
      return this.pop()
    }
    return null
  }
}
