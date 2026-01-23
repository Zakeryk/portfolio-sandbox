import * as PIXI from 'pixi.js'
import { SPRITES } from './sprites.js'
import { EventQueue } from './EventQueue.js'

export class GameEngine {
  constructor(container) {
    this.container = container
    this.app = null

    this.entities = {
      townHall: null,
      mine: null,     // income spawn point
      buildings: [],  // account-based buildings
      peons: [],      // gold carriers (income units)
      demons: [],     // debt enemies
      creeps: [],     // expense attackers
      infantry: [],   // debt payment attackers
      transactionNpcs: [], // transaction-driven npcs
    }

    // transaction npc system
    this.transactionPool = []
    this.transactionIndex = 0 // current position in sorted pool
    this.currentSimDay = null // track current day for imp spawning
    this.lastTransactionSpawn = 0
    this.transactionSpawnInterval = 1000 // ms, recalculated on load

    this.eventQueue = new EventQueue()

    this.accounts = {
      depository: [],
      investments: [],
      creditCards: [],
      loans: [],
      others: []
    }

    this.timeView = '1M'
    this.playbackSpeed = 1
    this.buildMode = false
    this.netWorth = 0
    this.draggingBuilding = null

    this.tileWidth = 64
    this.tileHeight = 32
    this.mapWidth = 32
    this.mapHeight = 32
    this.tickCount = 0

    // building zones (grid positions relative to center)
    this.zones = {
      depository: { x: -8, y: -4 },
      investments: { x: -4, y: -8 },
      creditCards: { x: 8, y: -4 },
      loans: { x: 4, y: 8 },
      others: { x: -8, y: 8 }
    }
  }

  toIso(x, y) {
    return {
      x: (x - y) * (this.tileWidth / 2),
      y: (x + y) * (this.tileHeight / 2)
    }
  }

  fromIso(screenX, screenY) {
    // convert screen coordinates back to grid coordinates
    const x = (screenX / (this.tileWidth / 2) + screenY / (this.tileHeight / 2)) / 2
    const y = (screenY / (this.tileHeight / 2) - screenX / (this.tileWidth / 2)) / 2
    return { x, y }
  }

  async init() {
    const rect = this.container.getBoundingClientRect()
    this.width = rect.width || 900
    this.height = rect.height || 700

    this.app = new PIXI.Application({
      width: this.width,
      height: this.height,
      backgroundColor: 0x1a1a2e,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      resizeTo: this.container
    })

    this.container.appendChild(this.app.view)

    // handle resize
    this.resizeObserver = new ResizeObserver(() => {
      const newRect = this.container.getBoundingClientRect()
      this.width = newRect.width
      this.height = newRect.height
      this.centerOnTownHall()
    })
    this.resizeObserver.observe(this.container)

    this.worldContainer = new PIXI.Container()
    this.app.stage.addChild(this.worldContainer)

    this.groundLayer = new PIXI.Container()
    this.gameObjectLayer = new PIXI.Container() // merged buildings + units for proper z-sorting
    this.effectLayer = new PIXI.Container()

    // aliases for backwards compat
    this.buildingLayer = this.gameObjectLayer
    this.unitLayer = this.gameObjectLayer

    this.worldContainer.addChild(this.groundLayer)
    this.worldContainer.addChild(this.gameObjectLayer)
    this.worldContainer.addChild(this.effectLayer)

    const centerTile = this.toIso(this.mapWidth / 2, this.mapHeight / 2)
    this.worldContainer.x = (this.width / 2) - centerTile.x
    this.worldContainer.y = (this.height / 2) - centerTile.y

    this.setupPanning()
    this.createTooltip()
    this.drawIsometricGrid()
    await this.createTownHall()
    await this.createMine()
    await this.loadSkeletonTextures()
    await this.loadHumanGoldTextures()
    await this.loadBarbarianTextures()
    await this.loadImpTextures()
    this.loadTransactionPool()

    this.app.ticker.add(() => this.gameLoop())
  }

  async loadSkeletonTextures() {
    try {
      const spriteConfig = SPRITES.units.skeleton
      const baseTexture = await PIXI.Assets.load(spriteConfig.path)

      // create individual frame textures from sprite sheet
      this.skeletonTextures = []
      for (let row = 0; row < spriteConfig.rows; row++) {
        for (let col = 0; col < spriteConfig.framesPerRow; col++) {
          const frame = new PIXI.Rectangle(
            col * spriteConfig.frameWidth,
            row * spriteConfig.frameHeight,
            spriteConfig.frameWidth,
            spriteConfig.frameHeight
          )
          const texture = new PIXI.Texture(baseTexture, frame)
          this.skeletonTextures.push(texture)
        }
      }
      console.log(`Loaded ${this.skeletonTextures.length} skeleton frames`)
    } catch (e) {
      console.warn('Failed to load skeleton textures:', e)
      this.skeletonTextures = null
    }
  }

  async loadHumanGoldTextures() {
    try {
      const spriteConfig = SPRITES.units.humanGold
      const baseTexture = await PIXI.Assets.load(spriteConfig.path)

      this.humanGoldTextures = []
      for (let row = 0; row < spriteConfig.rows; row++) {
        for (let col = 0; col < spriteConfig.framesPerRow; col++) {
          const frame = new PIXI.Rectangle(
            col * spriteConfig.frameWidth,
            row * spriteConfig.frameHeight,
            spriteConfig.frameWidth,
            spriteConfig.frameHeight
          )
          const texture = new PIXI.Texture(baseTexture, frame)
          this.humanGoldTextures.push(texture)
        }
      }
      console.log(`Loaded ${this.humanGoldTextures.length} human gold frames`)
    } catch (e) {
      console.warn('Failed to load human gold textures:', e)
      this.humanGoldTextures = null
    }
  }

  async loadBarbarianTextures() {
    try {
      const spriteConfig = SPRITES.units.barbarian
      const baseTexture = await PIXI.Assets.load(spriteConfig.path)

      this.barbarianTextures = []
      for (let row = 0; row < spriteConfig.rows; row++) {
        for (let col = 0; col < spriteConfig.framesPerRow; col++) {
          const frame = new PIXI.Rectangle(
            col * spriteConfig.frameWidth,
            row * spriteConfig.frameHeight,
            spriteConfig.frameWidth,
            spriteConfig.frameHeight
          )
          const texture = new PIXI.Texture(baseTexture, frame)
          this.barbarianTextures.push(texture)
        }
      }
      console.log(`Loaded ${this.barbarianTextures.length} barbarian frames`)
    } catch (e) {
      console.warn('Failed to load barbarian textures:', e)
      this.barbarianTextures = null
    }
  }

  async loadImpTextures() {
    try {
      const spriteConfig = SPRITES.units.imp
      const baseTexture = await PIXI.Assets.load(spriteConfig.path)

      this.impTextures = []
      for (let row = 0; row < spriteConfig.rows; row++) {
        for (let col = 0; col < spriteConfig.framesPerRow; col++) {
          const frame = new PIXI.Rectangle(
            col * spriteConfig.frameWidth,
            row * spriteConfig.frameHeight,
            spriteConfig.frameWidth,
            spriteConfig.frameHeight
          )
          const texture = new PIXI.Texture(baseTexture, frame)
          this.impTextures.push(texture)
        }
      }
      console.log(`Loaded ${this.impTextures.length} imp frames`)
    } catch (e) {
      console.warn('Failed to load imp textures:', e)
      this.impTextures = null
    }
  }

  // === Transaction NPC System ===

  loadTransactionPool() {
    try {
      const saved = localStorage.getItem('fincraft-transactions')
      if (!saved) return

      const transactions = JSON.parse(saved)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)

      // filter to last 30 days and sort by date
      this.transactionPool = transactions
        .filter(t => {
          const date = new Date(t.date || t.Date)
          return date.getTime() >= thirtyDaysAgo
        })
        .sort((a, b) => {
          const dateA = new Date(a.date || a.Date)
          const dateB = new Date(b.date || b.Date)
          return dateA - dateB
        })

      // reset playback position
      this.transactionIndex = 0
      this.currentSimDay = null

      // calculate spawn interval based on pool size
      // baseline: 30 transactions = 1 spawn every 2 seconds (slower, more ambient)
      if (this.transactionPool.length > 0) {
        const spawnsPerSecond = this.transactionPool.length / 60 // halved rate
        this.transactionSpawnInterval = 1000 / Math.max(0.3, Math.min(2, spawnsPerSecond))
      }

      console.log(`Transaction pool loaded: ${this.transactionPool.length} transactions (sorted by date), spawn interval: ${this.transactionSpawnInterval}ms`)
    } catch (e) {
      console.warn('Failed to load transaction pool:', e)
    }
  }

  normalizeAccountName(name) {
    if (!name) return ''
    return name.toLowerCase()
      .replace(/\b(card|account|checking|savings|credit|debit|bank)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  findMatchingBuilding(csvAccount) {
    if (!csvAccount) return null
    const normalized = this.normalizeAccountName(csvAccount)
    return this.entities.buildings.find(b => {
      const buildingNorm = this.normalizeAccountName(b.name)
      return normalized.includes(buildingNorm) || buildingNorm.includes(normalized)
    })
  }

  // Try to find a building mentioned in transaction text (name, note, etc.)
  findBuildingFromText(text) {
    if (!text) return null
    const normalized = text.toLowerCase()

    // Check each building name against the text
    for (const building of this.entities.buildings) {
      const buildingNorm = this.normalizeAccountName(building.name)
      if (buildingNorm.length >= 3 && normalized.includes(buildingNorm)) {
        return building
      }
      // Also check common variations
      const words = building.name.toLowerCase().split(/\s+/)
      for (const word of words) {
        if (word.length >= 4 && normalized.includes(word)) {
          return building
        }
      }
    }
    return null
  }

  getTransactionType(transaction) {
    // check if internal transfer - multiple indicators
    const type = (transaction.type || transaction.Type || '').toLowerCase()
    const category = (transaction.category || transaction.Category || '').toLowerCase()
    const name = (transaction.name || transaction.Name || '').toLowerCase()
    const excluded = transaction.excluded || transaction.Excluded

    // keywords that indicate internal movement, not real income/expense
    const transferKeywords = [
      'transfer', 'payment', 'deposit', 'withdrawal', 'contribution',
      'autopay', 'bill pay', 'billpay', 'ach', 'direct dep',
      'payoff', 'pay off', 'internal', 'moving money',
      'from checking', 'from savings', 'to checking', 'to savings',
      'credit card payment', 'card payment', 'loan payment',
      'ira', 'roth', '401k', '401(k)', 'brokerage'
    ]

    // check explicit transfer indicators
    if (type === 'transfer' || type === 'internal' ||
      category.includes('transfer') ||
      excluded === 'true' || excluded === true) {
      return 'transfer'
    }

    // check name for transfer keywords
    for (const keyword of transferKeywords) {
      if (name.includes(keyword)) {
        return 'transfer'
      }
    }

    // check if name contains a known bank/financial institution (likely internal)
    const bankKeywords = [
      'chase', 'wells fargo', 'bank of america', 'citi', 'capital one',
      'amex', 'american express', 'discover', 'apple card', 'venmo',
      'paypal', 'zelle', 'schwab', 'fidelity', 'vanguard', 'robinhood',
      'coinbase', 'sofi', 'marcus', 'ally', 'betterment', 'wealthfront'
    ]
    for (const bank of bankKeywords) {
      if (name.includes(bank)) {
        return 'transfer'
      }
    }

    // check amount - negative = income, positive = expense
    const amountStr = transaction.amount || transaction.Amount || '0'
    const amount = parseFloat(amountStr.replace(/[,$]/g, ''))
    return amount < 0 ? 'income' : 'expense'
  }

  spawnTransactionNpc() {
    if (this.transactionPool.length === 0) return

    // get next transaction in chronological order
    const transaction = this.transactionPool[this.transactionIndex]

    // check for day change - spawn imps from debt buildings
    const txDate = new Date(transaction.date || transaction.Date)
    const txDay = txDate.toDateString()
    if (this.currentSimDay && txDay !== this.currentSimDay) {
      // new day - spawn imps from all debt buildings
      this.entities.buildings.forEach(building => {
        if (building.isDebt && building.balance > 0) {
          this.spawnDemon(building)
        }
      })
    }
    this.currentSimDay = txDay

    // advance index, loop back to start
    this.transactionIndex = (this.transactionIndex + 1) % this.transactionPool.length

    let type = this.getTransactionType(transaction)
    const amountStr = transaction.amount || transaction.Amount || '0'
    const amount = Math.abs(parseFloat(amountStr.replace(/[,$]/g, '')))
    const name = transaction.name || transaction.Name || transaction.description || 'Unknown'
    const account = transaction.account || transaction.Account || ''

    // payroll always comes from income mine
    if (name.toLowerCase().includes('payroll')) {
      type = 'income'
    }

    // find matching building
    const matchedBuilding = this.findMatchingBuilding(account)

    let spawnGridX, spawnGridY, targetGridX, targetGridY, color
    let targetBuilding = null // track target building for sprite selection
    const centerX = Math.floor(this.mapWidth / 2)
    const centerY = Math.floor(this.mapHeight / 2)

    if (type === 'income') {
      // income: spawn from mine, walk to matched building or town hall
      spawnGridX = centerX - 5
      spawnGridY = centerY - 3
      if (matchedBuilding) {
        targetGridX = matchedBuilding.gridX
        targetGridY = matchedBuilding.gridY
        targetBuilding = matchedBuilding
      } else {
        targetGridX = centerX
        targetGridY = centerY
      }
      color = 0xffd93d // gold
    } else if (type === 'transfer') {
      // TRANSFER: Building to Building
      // Try to find both source and destination accounts

      const rawAmount = parseFloat(amountStr.replace(/[,$]/g, ''))

      // Try to extract destination from transaction name
      // e.g., "Apple Card Payment", "Transfer to Savings", "Roth IRA Contribution"
      const destBuilding = this.findBuildingFromText(name)

      if (matchedBuilding && destBuilding && matchedBuilding !== destBuilding) {
        // Found both source and destination - path between them
        if (rawAmount > 0) {
          // Outflow from this account -> goes to destination
          spawnGridX = matchedBuilding.gridX
          spawnGridY = matchedBuilding.gridY
          targetGridX = destBuilding.gridX
          targetGridY = destBuilding.gridY
          targetBuilding = destBuilding
        } else {
          // Inflow to this account <- comes from destination (which is actually source)
          spawnGridX = destBuilding.gridX
          spawnGridY = destBuilding.gridY
          targetGridX = matchedBuilding.gridX
          targetGridY = matchedBuilding.gridY
          targetBuilding = matchedBuilding
        }
      } else if (matchedBuilding) {
        // Only found one building - use town hall as hub
        if (rawAmount < 0) {
          spawnGridX = centerX
          spawnGridY = centerY
          targetGridX = matchedBuilding.gridX
          targetGridY = matchedBuilding.gridY
          targetBuilding = matchedBuilding
        } else {
          spawnGridX = matchedBuilding.gridX
          spawnGridY = matchedBuilding.gridY
          targetGridX = centerX
          targetGridY = centerY
        }
      } else if (destBuilding) {
        // Found destination in name but not source
        spawnGridX = centerX
        spawnGridY = centerY
        targetGridX = destBuilding.gridX
        targetGridY = destBuilding.gridY
        targetBuilding = destBuilding
      } else {
        // No buildings matched - default to townhall ↔ depository/investment
        // Prefer depository, fallback to investment
        const depositoryBuildings = this.entities.buildings.filter(b => b.category === 'depository')
        const investmentBuildings = this.entities.buildings.filter(b => b.category === 'investments')

        // Pick building: prefer depository, then investment
        let targetBuilding = null
        if (depositoryBuildings.length > 0) {
          targetBuilding = depositoryBuildings[Math.floor(Math.random() * depositoryBuildings.length)]
        } else if (investmentBuildings.length > 0) {
          targetBuilding = investmentBuildings[Math.floor(Math.random() * investmentBuildings.length)]
        }

        if (targetBuilding) {
          // Random direction: townhall → building or building → townhall
          if (Math.random() > 0.5) {
            spawnGridX = centerX
            spawnGridY = centerY
            targetGridX = targetBuilding.gridX
            targetGridY = targetBuilding.gridY
          } else {
            spawnGridX = targetBuilding.gridX
            spawnGridY = targetBuilding.gridY
            targetGridX = centerX
            targetGridY = centerY
          }
        } else {
          // No depository/investment buildings - townhall to mine
          spawnGridX = centerX
          spawnGridY = centerY
          targetGridX = centerX - 5
          targetGridY = centerY - 3
        }
      }
      color = 0x44ccff // Cyan
    } else {
      // EXPENSE: Spawn from edge, attack depository building (checking preferred)
      // Spawn from random edge
      const edge = Math.floor(Math.random() * 4)
      switch (edge) {
        case 0: spawnGridX = Math.floor(Math.random() * this.mapWidth); spawnGridY = 0; break
        case 1: spawnGridX = this.mapWidth - 1; spawnGridY = Math.floor(Math.random() * this.mapHeight); break
        case 2: spawnGridX = Math.floor(Math.random() * this.mapWidth); spawnGridY = this.mapHeight - 1; break
        case 3: spawnGridX = 0; spawnGridY = Math.floor(Math.random() * this.mapHeight); break
      }

      // Target: matched building > checking > other depository > town hall
      let expenseTarget = matchedBuilding
      if (!expenseTarget) {
        const depositoryBuildings = this.entities.buildings.filter(b => b.category === 'depository')
        // Prefer checking accounts
        const checkingBuildings = depositoryBuildings.filter(b =>
          b.name.toLowerCase().includes('checking')
        )
        const savingsBuildings = depositoryBuildings.filter(b =>
          !b.name.toLowerCase().includes('checking')
        )

        if (checkingBuildings.length > 0) {
          expenseTarget = checkingBuildings[Math.floor(Math.random() * checkingBuildings.length)]
        } else if (savingsBuildings.length > 0) {
          expenseTarget = savingsBuildings[Math.floor(Math.random() * savingsBuildings.length)]
        }
      }

      if (expenseTarget) {
        targetGridX = expenseTarget.gridX
        targetGridY = expenseTarget.gridY
      } else {
        // No depository - attack town hall
        targetGridX = centerX
        targetGridY = centerY
      }
      color = 0xff6b6b // red
    }

    // create npc at grid position
    const spawnPos = this.toIso(spawnGridX, spawnGridY)
    const npc = new PIXI.Container()
    npc.x = spawnPos.x
    npc.y = spawnPos.y

    // size based on amount: tiny units - $1 scales up for larger amounts
    const sizeScale = 0.8 + Math.min(0.6, Math.log10(amount + 1) * 0.2)

    if (type === 'expense' && this.skeletonTextures) {
      // use animated skeleton sprite for expenses
      const spriteConfig = SPRITES.units.skeleton
      const sprite = new PIXI.Sprite(this.skeletonTextures[0])
      sprite.anchor.set(spriteConfig.anchorX, spriteConfig.anchorY)
      sprite.width = spriteConfig.displayWidth * sizeScale
      sprite.height = spriteConfig.displayHeight * sizeScale

      // isometric shadow
      const shadow = new PIXI.Graphics()
      shadow.beginFill(0x000000, 0.25)
      const shadowSize = spriteConfig.displayWidth * sizeScale * 0.4
      shadow.moveTo(0, shadowSize * 0.3)
      shadow.lineTo(shadowSize, 0)
      shadow.lineTo(0, -shadowSize * 0.3)
      shadow.lineTo(-shadowSize, 0)
      shadow.closePath()
      shadow.endFill()
      shadow.y = spriteConfig.displayHeight * sizeScale * 0.1
      npc.addChild(shadow)
      npc.addChild(sprite)

      npc.animSprite = sprite
      npc.animFrame = 0
      npc.animTimer = 0
      npc.animSpeed = spriteConfig.animSpeed
    } else if (targetBuilding?.isDebt && this.barbarianTextures) {
      // use barbarian sprite when going TO debt buildings (credit cards, loans)
      const spriteConfig = SPRITES.units.barbarian
      const sprite = new PIXI.Sprite(this.barbarianTextures[0])
      sprite.anchor.set(spriteConfig.anchorX, spriteConfig.anchorY)
      sprite.width = spriteConfig.displayWidth * sizeScale
      sprite.height = spriteConfig.displayHeight * sizeScale

      const shadow = new PIXI.Graphics()
      shadow.beginFill(0x000000, 0.25)
      const shadowSize = spriteConfig.displayWidth * sizeScale * 0.4
      shadow.moveTo(0, shadowSize * 0.3)
      shadow.lineTo(shadowSize, 0)
      shadow.lineTo(0, -shadowSize * 0.3)
      shadow.lineTo(-shadowSize, 0)
      shadow.closePath()
      shadow.endFill()
      shadow.y = spriteConfig.displayHeight * sizeScale * 0.1
      npc.addChild(shadow)
      npc.addChild(sprite)

      npc.animSprite = sprite
      npc.animFrame = 0
      npc.animTimer = 0
      npc.animSpeed = spriteConfig.animSpeed
      npc.useBarbarian = true
    } else if ((type === 'income' || type === 'transfer') && this.humanGoldTextures) {
      // use animated human gold sprite for income/transfer
      const spriteConfig = SPRITES.units.humanGold
      const sprite = new PIXI.Sprite(this.humanGoldTextures[0])
      sprite.anchor.set(spriteConfig.anchorX, spriteConfig.anchorY)
      sprite.width = spriteConfig.displayWidth * sizeScale
      sprite.height = spriteConfig.displayHeight * sizeScale

      // isometric shadow
      const shadow = new PIXI.Graphics()
      shadow.beginFill(0x000000, 0.25)
      const shadowSize = spriteConfig.displayWidth * sizeScale * 0.4
      shadow.moveTo(0, shadowSize * 0.3)
      shadow.lineTo(shadowSize, 0)
      shadow.lineTo(0, -shadowSize * 0.3)
      shadow.lineTo(-shadowSize, 0)
      shadow.closePath()
      shadow.endFill()
      shadow.y = spriteConfig.displayHeight * sizeScale * 0.1
      npc.addChild(shadow)
      npc.addChild(sprite)

      npc.animSprite = sprite
      npc.animFrame = 0
      npc.animTimer = 0
      npc.animSpeed = spriteConfig.animSpeed
      npc.useHumanGold = true
    } else {
      // fallback: simple colored circle
      const size = 2 + Math.min(3, Math.log10(amount + 1) * 1.2)

      const shadow = new PIXI.Graphics()
      shadow.beginFill(0x000000, 0.2)
      shadow.moveTo(0, size * 0.6)
      shadow.lineTo(size * 0.8, size * 0.3)
      shadow.lineTo(0, 0)
      shadow.lineTo(-size * 0.8, size * 0.3)
      shadow.closePath()
      shadow.endFill()
      shadow.y = size * 0.5
      npc.addChild(shadow)

      const body = new PIXI.Graphics()
      body.beginFill(color)
      body.drawCircle(0, 0, size)
      body.endFill()
      npc.addChild(body)
    }

    // store grid-based movement data
    npc.gridX = spawnGridX
    npc.gridY = spawnGridY
    npc.targetGridX = targetGridX
    npc.targetGridY = targetGridY
    npc.currentTileX = spawnPos.x
    npc.currentTileY = spawnPos.y
    npc.nextTileX = spawnPos.x
    npc.nextTileY = spawnPos.y
    npc.moveProgress = 1 // 1 = ready for next tile
    npc.speed = 0.015 + Math.random() * 0.008 // progress per frame
    npc.npcType = type
    npc.npcColor = color

    // store transaction data for tooltips
    npc.transactionData = {
      name,
      amount,
      type,
      account,
      date: transaction.date || transaction.Date
    }

    // make interactive (always, for hover tooltips)
    npc.eventMode = 'static'
    npc.cursor = 'default' // changed from 'pointer'

    npc.on('pointerover', () => {
      // if build mode is on, gameLoop handles the label already
      if (this.buildMode) return

      if (!npc.hoverLabel) {
        // match edit mode style exactly
        const label = new PIXI.Text(name.substring(0, 15), {
          fontSize: 7,
          fill: 0xffffff,
          fontWeight: 'bold'
        })
        label.anchor.set(0.5)
        label.y = -10
        npc.addChild(label)
        npc.hoverLabel = label
      }
      npc.hoverLabel.visible = true
    })

    npc.on('pointerout', () => {
      if (npc.hoverLabel) {
        npc.hoverLabel.visible = false
      }
    })

    // Convert target grid coords to pixel coords so gameLoop can move it
    const targetPos = this.toIso(targetGridX, targetGridY)
    npc.targetX = targetPos.x
    npc.targetY = targetPos.y

    // Initialize movement variables required by gameLoop
    npc.wanderOffset = { x: 0, y: 0 }
    npc.wanderTimer = 0
    // --- MISSING LOGIC END ---

    this.unitLayer.addChild(npc)
    this.entities.transactionNpcs.push(npc)
  }

  // get next grid tile toward target, avoiding buildings
  getNextTile(npc) {
    const dx = npc.targetGridX - npc.gridX
    const dy = npc.targetGridY - npc.gridY

    if (dx === 0 && dy === 0) return null // at target

    // possible moves - 8 directions including diagonals
    const moves = [
      { x: 1, y: 0 },   // east
      { x: -1, y: 0 },  // west
      { x: 0, y: 1 },   // south
      { x: 0, y: -1 },  // north
      { x: 1, y: 1 },   // SE
      { x: -1, y: -1 }, // NW
      { x: 1, y: -1 },  // NE
      { x: -1, y: 1 },  // SW
    ]

    // score each move by distance to target
    let bestMove = null
    let bestScore = Infinity
    let bestBlockedMove = null
    let bestBlockedScore = Infinity

    for (const move of moves) {
      const newX = npc.gridX + move.x
      const newY = npc.gridY + move.y

      // bounds check
      if (newX < 0 || newX >= this.mapWidth || newY < 0 || newY >= this.mapHeight) continue

      // euclidean distance to target (better for diagonals)
      const distX = npc.targetGridX - newX
      const distY = npc.targetGridY - newY
      const score = Math.sqrt(distX * distX + distY * distY)

      // check if tile is blocked
      const isBlocked = this.isTileOccupied(newX, newY, npc.targetGridX, npc.targetGridY)

      if (!isBlocked) {
        if (score < bestScore) {
          bestScore = score
          bestMove = { x: newX, y: newY }
        }
      } else {
        // track best blocked move as fallback
        if (score < bestBlockedScore) {
          bestBlockedScore = score
          bestBlockedMove = { x: newX, y: newY }
        }
      }
    }

    // if no unblocked move, use blocked move (prevents getting stuck)
    return bestMove || bestBlockedMove
  }

  // check if a tile is occupied by a building
  isTileOccupied(gridX, gridY, targetX, targetY) {
    // don't block tiles near the target (allows NPCs to reach destination)
    const distToTarget = Math.abs(gridX - targetX) + Math.abs(gridY - targetY)
    if (distToTarget <= 2) return false

    const centerX = Math.floor(this.mapWidth / 2)
    const centerY = Math.floor(this.mapHeight / 2)

    // town hall occupies 3x3 area
    if (gridX >= centerX - 1 && gridX <= centerX + 1 &&
      gridY >= centerY - 1 && gridY <= centerY + 1) {
      return true
    }

    // mine
    const mineX = centerX - 5
    const mineY = centerY - 3
    if (gridX >= mineX - 1 && gridX <= mineX && gridY >= mineY - 1 && gridY <= mineY) {
      return true
    }

    // check account buildings (each occupies ~2x2)
    for (const building of this.entities.buildings) {
      if (gridX >= building.gridX - 1 && gridX <= building.gridX &&
        gridY >= building.gridY - 1 && gridY <= building.gridY) {
        return true
      }
    }

    return false
  }

  // check if screen position is near a building (for obstacle avoidance)
  isNearBuilding(screenX, screenY, excludeTarget = null) {
    const checkRadius = 40 // pixels

    // check town hall
    if (this.entities.townHall) {
      const dx = screenX - this.entities.townHall.x
      const dy = screenY - this.entities.townHall.y
      if (Math.sqrt(dx * dx + dy * dy) < checkRadius * 1.5) {
        if (!excludeTarget || (excludeTarget.x !== this.entities.townHall.x || excludeTarget.y !== this.entities.townHall.y)) {
          return true
        }
      }
    }

    // check mine
    if (this.entities.mine) {
      const dx = screenX - this.entities.mine.x
      const dy = screenY - this.entities.mine.y
      if (Math.sqrt(dx * dx + dy * dy) < checkRadius) {
        if (!excludeTarget || (excludeTarget.x !== this.entities.mine.x || excludeTarget.y !== this.entities.mine.y)) {
          return true
        }
      }
    }

    // check account buildings
    for (const building of this.entities.buildings) {
      const dx = screenX - building.container.x
      const dy = screenY - building.container.y
      if (Math.sqrt(dx * dx + dy * dy) < checkRadius) {
        if (!excludeTarget || (excludeTarget.x !== building.container.x || excludeTarget.y !== building.container.y)) {
          return true
        }
      }
    }

    return false
  }

  // get avoidance steering vector
  getAvoidanceVector(npc) {
    const avoidRadius = 50
    let avoidX = 0
    let avoidY = 0

    const checkBuilding = (bx, by) => {
      const dx = npc.x - bx
      const dy = npc.y - by
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < avoidRadius && dist > 0) {
        // push away from building, stronger when closer
        const strength = (avoidRadius - dist) / avoidRadius
        avoidX += (dx / dist) * strength
        avoidY += (dy / dist) * strength
      }
    }

    // avoid town hall
    if (this.entities.townHall &&
      (npc.targetX !== this.entities.townHall.x || npc.targetY !== this.entities.townHall.y)) {
      checkBuilding(this.entities.townHall.x, this.entities.townHall.y)
    }

    // avoid mine
    if (this.entities.mine &&
      (npc.targetX !== this.entities.mine.x || npc.targetY !== this.entities.mine.y)) {
      checkBuilding(this.entities.mine.x, this.entities.mine.y)
    }

    // avoid account buildings
    for (const building of this.entities.buildings) {
      if (npc.targetX !== building.container.x || npc.targetY !== building.container.y) {
        checkBuilding(building.container.x, building.container.y)
      }
    }

    return { x: avoidX, y: avoidY }
  }

  getRandomEdgePosition() {
    const edge = Math.floor(Math.random() * 4)
    let gridX, gridY
    switch (edge) {
      case 0: gridX = Math.floor(Math.random() * this.mapWidth); gridY = 0; break
      case 1: gridX = this.mapWidth - 1; gridY = Math.floor(Math.random() * this.mapHeight); break
      case 2: gridX = Math.floor(Math.random() * this.mapWidth); gridY = this.mapHeight - 1; break
      case 3: gridX = 0; gridY = Math.floor(Math.random() * this.mapHeight); break
    }
    return this.toIso(gridX, gridY)
  }

  setupPanning() {
    const view = this.app.view
    this.isPanning = false
    this.lastPanPos = { x: 0, y: 0 }
    this.zoomLevel = 1
    this.clickedBuilding = false
    this.hoveringBuilding = false
    this.minZoom = 0.4
    this.maxZoom = 2
    this.keysPressed = new Set()
    this.targetZoom = 1
    this.zoomVelocity = 0

    view.addEventListener('mousedown', (e) => {
      // don't pan if hovering a building
      if (this.hoveringBuilding) return
      this.clickedBuilding = false
      setTimeout(() => {
        if (this.clickedBuilding) return
        // dismiss tooltip when clicking ground
        if (this.activeTooltipEntity) {
          this.hideTooltip()
          this.activeTooltipEntity = null
        }
        this.isPanning = true
        this.lastPanPos = { x: e.clientX, y: e.clientY }
        view.style.cursor = 'grabbing'
      }, 0)
    })

    view.addEventListener('mousemove', (e) => {
      // handle building drag in build mode
      if (this.draggingBuilding) {
        const rect = view.getBoundingClientRect()
        const worldMouseX = (e.clientX - rect.left - this.worldContainer.x) / this.zoomLevel
        const worldMouseY = (e.clientY - rect.top - this.worldContainer.y) / this.zoomLevel
        this.draggingBuilding.x = worldMouseX + this.dragOffset.x
        this.draggingBuilding.y = worldMouseY + this.dragOffset.y

        // show drag preview tile
        const gridX = Math.round(this.draggingBuilding.x / (this.tileWidth / 2) / 2 + (this.draggingBuilding.y + 20) / (this.tileHeight / 2) / 2)
        const gridY = Math.round((this.draggingBuilding.y + 20) / (this.tileHeight / 2) / 2 - this.draggingBuilding.x / (this.tileWidth / 2) / 2)
        const isBlocked = this.isTownHallZone(gridX, gridY)
        this.showDragPreview(gridX, gridY, isBlocked)
        return
      }

      if (!this.isPanning) return
      const dx = e.clientX - this.lastPanPos.x
      const dy = e.clientY - this.lastPanPos.y
      this.worldContainer.x += dx
      this.worldContainer.y += dy
      this.lastPanPos = { x: e.clientX, y: e.clientY }
      // close tooltip when panning
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        this.hideTooltip()
        this.activeTooltipEntity = null
      }
    })

    view.addEventListener('mouseup', () => {
      if (this.draggingBuilding) {
        // calculate grid position
        const gridX = Math.round(this.draggingBuilding.x / (this.tileWidth / 2) / 2 + (this.draggingBuilding.y + 20) / (this.tileHeight / 2) / 2)
        const gridY = Math.round((this.draggingBuilding.y + 20) / (this.tileHeight / 2) / 2 - this.draggingBuilding.x / (this.tileWidth / 2) / 2)

        // check if in town hall protected zone
        if (this.isTownHallZone(gridX, gridY)) {
          // revert to original position
          this.draggingBuilding.x = this.dragStartPos.x
          this.draggingBuilding.y = this.dragStartPos.y
          this.draggingBuilding.gridX = this.dragStartGrid.x
          this.draggingBuilding.gridY = this.dragStartGrid.y
        } else {
          // snap to grid
          const pos = this.toIso(gridX, gridY)
          this.draggingBuilding.x = pos.x
          this.draggingBuilding.y = pos.y - 20
          this.draggingBuilding.gridX = gridX
          this.draggingBuilding.gridY = gridY
          this.draggingBuilding.zIndex = pos.y - 30

          // update building in entities array
          const building = this.entities.buildings.find(b => b.container === this.draggingBuilding)
          if (building) {
            building.gridX = gridX
            building.gridY = gridY
            this.saveBuildingPosition(building.accountId, gridX, gridY)
          }
        }

        this.draggingBuilding = null
        this.hideDragPreview()
      }
      this.isPanning = false
      view.style.cursor = this.hoveringBuilding ? 'pointer' : 'default'
    })

    view.addEventListener('mouseleave', () => {
      this.isPanning = false
      view.style.cursor = 'default'
    })

    window.addEventListener('keydown', (e) => {
      // ignore when typing in inputs
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return
      if (e.key === '0') this.centerOnTownHall()
      if (e.key === '=' || e.key === '+') this.zoomBy(1.35)
      if (e.key === '-' || e.key === '_') this.zoomBy(0.65)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'].includes(e.key)) {
        this.keysPressed.add(e.key.toLowerCase())
      }
    })

    window.addEventListener('keyup', (e) => {
      this.keysPressed.delete(e.key.toLowerCase())
    })

    view.addEventListener('wheel', (e) => {
      e.preventDefault()

      // ctrlKey is true for pinch-to-zoom on trackpads
      if (e.ctrlKey) {
        // zoom - pinch gesture
        const zoomSpeed = 0.01
        const delta = -e.deltaY * zoomSpeed
        const newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoomLevel + delta))

        if (Math.abs(newZoom - this.zoomLevel) > 0.001) {
          const rect = view.getBoundingClientRect()
          const mouseX = e.clientX - rect.left
          const mouseY = e.clientY - rect.top
          const worldX = (mouseX - this.worldContainer.x) / this.zoomLevel
          const worldY = (mouseY - this.worldContainer.y) / this.zoomLevel

          this.zoomLevel = newZoom
          this.worldContainer.scale.set(this.zoomLevel)
          this.worldContainer.x = mouseX - worldX * this.zoomLevel
          this.worldContainer.y = mouseY - worldY * this.zoomLevel
        }
      } else {
        // pan - two finger scroll
        this.worldContainer.x -= e.deltaX
        this.worldContainer.y -= e.deltaY

        // close tooltip when panning
        if (Math.abs(e.deltaX) > 2 || Math.abs(e.deltaY) > 2) {
          this.hideTooltip()
          this.activeTooltipEntity = null
        }
      }
    }, { passive: false })
  }

  zoomBy(factor) {
    this.targetZoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoomLevel * factor))
  }

  centerOnTownHall() {
    this.zoomLevel = 1
    this.targetZoom = 1
    this.worldContainer.scale.set(1)
    const centerTile = this.toIso(this.mapWidth / 2, this.mapHeight / 2)
    this.worldContainer.x = (this.width / 2) - centerTile.x
    this.worldContainer.y = (this.height / 2) - centerTile.y
  }

  createTooltip() {
    this.tooltip = new PIXI.Container()
    this.tooltip.visible = false
    this.tooltip.alpha = 0
    this.activeTooltipEntity = null
    this.tooltipAnim = { targetAlpha: 0, targetY: 0, baseY: 0 }

    const bg = new PIXI.Graphics()
    bg.beginFill(0x1a1a2e, 0.95)
    bg.lineStyle(1, 0x4a4a6e)
    bg.drawRoundedRect(0, 0, 140, 80, 6)
    bg.endFill()

    const title = new PIXI.Text('', { fontSize: 11, fill: 0xffffff, fontWeight: 'bold', align: 'center' })
    title.anchor.set(0.5, 0)

    const content = new PIXI.Text('', { fontSize: 10, fill: 0xcccccc, lineHeight: 14, align: 'center' })
    content.anchor.set(0.5, 0)

    this.tooltip.addChild(bg)
    this.tooltip.titleText = title
    this.tooltip.contentText = content
    this.tooltip.bg = bg
    this.tooltip.addChild(title)
    this.tooltip.addChild(content)

    this.app.stage.addChild(this.tooltip)
  }

  showTooltip(x, y, title, lines) {
    this.tooltip.titleText.text = title
    this.tooltip.contentText.text = lines.join('\n')
    const width = Math.max(140, this.tooltip.contentText.width + 32, this.tooltip.titleText.width + 32)
    const height = 32 + lines.length * 14

    this.tooltip.bg.clear()
    this.tooltip.bg.beginFill(0x1a1a2e, 0.95)
    this.tooltip.bg.lineStyle(1, 0x4a4a6e)
    this.tooltip.bg.drawRoundedRect(-width / 2, -height, width, height, 8)
    this.tooltip.bg.endFill()

    this.tooltip.titleText.x = 0
    this.tooltip.titleText.y = -height + 8
    this.tooltip.contentText.x = 0
    this.tooltip.contentText.y = -height + 26

    // center above building
    this.tooltip.x = x
    this.tooltipAnim.baseY = y - 30
    this.tooltip.y = this.tooltipAnim.baseY + 15 // start slightly below
    this.tooltipAnim.targetAlpha = 1
    this.tooltip.visible = true
  }

  hideTooltip() {
    this.tooltipAnim.targetAlpha = 0
    if (this.highlightTile) {
      this.groundLayer.removeChild(this.highlightTile)
      this.highlightTile = null
    }
  }

  updateTooltipAnim() {
    const ease = 0.35
    // alpha
    this.tooltip.alpha += (this.tooltipAnim.targetAlpha - this.tooltip.alpha) * ease

    // track active entity position and scale with zoom
    if (this.activeTooltipEntity && this.tooltipAnim.targetAlpha > 0) {
      const screenX = this.activeTooltipEntity.x * this.zoomLevel + this.worldContainer.x
      const screenY = this.activeTooltipEntity.y * this.zoomLevel + this.worldContainer.y
      this.tooltip.x = screenX
      this.tooltip.y = screenY - 30 * this.zoomLevel
      this.tooltip.scale.set(this.zoomLevel)
    } else {
      // fade out in place - no y movement
    }

    if (this.tooltip.alpha < 0.01 && this.tooltipAnim.targetAlpha === 0) {
      this.tooltip.visible = false
      this.tooltip.alpha = 0
    }
  }

  makeInteractive(entity, getTooltipData, buildingId = null) {
    entity.eventMode = 'static'
    entity.cursor = 'pointer'
    entity.tooltipData = getTooltipData
    entity.buildingId = buildingId

    entity.on('pointerover', () => {
      this.hoveringBuilding = true
    })

    entity.on('pointerout', () => {
      this.hoveringBuilding = false
    })

    entity.on('pointerdown', (e) => {
      this.clickedBuilding = true

      // build mode dragging (not for town hall)
      if (this.buildMode && !entity.isTownHall) {
        this.draggingBuilding = entity
        this.dragStartPos = { x: entity.x, y: entity.y }
        this.dragStartGrid = { x: entity.gridX, y: entity.gridY }
        // calculate offset in world space
        const worldMouseX = (e.global.x - this.worldContainer.x) / this.zoomLevel
        const worldMouseY = (e.global.y - this.worldContainer.y) / this.zoomLevel
        this.dragOffset = {
          x: entity.x - worldMouseX,
          y: entity.y - worldMouseY
        }
        this.hideTooltip()
        return
      }

      // clear previous highlight
      if (this.highlightTile) {
        this.groundLayer.removeChild(this.highlightTile)
        this.highlightTile = null
      }

      // close other tooltips first
      if (this.activeTooltipEntity && this.activeTooltipEntity !== entity) {
        this.hideTooltip()
      }

      if (this.activeTooltipEntity === entity) {
        // toggle off if clicking same building
        this.hideTooltip()
        this.activeTooltipEntity = null
      } else {
        const data = getTooltipData()
        // get entity center in screen coords
        const screenX = entity.x * this.zoomLevel + this.worldContainer.x
        const screenY = entity.y * this.zoomLevel + this.worldContainer.y
        this.showTooltip(screenX, screenY, data.title, data.lines)
        this.activeTooltipEntity = entity

        // highlight tile under building
        if (entity.gridX !== undefined && entity.gridY !== undefined) {
          if (entity.isTownHall) {
            // 3x3 highlight for town hall
            this.highlightTile = this.createHighlightTile(entity.gridX, entity.gridY, 3, -3, -3)
          } else {
            // 2x2 highlight positioned above the building tile
            this.highlightTile = this.createHighlightTile(entity.gridX, entity.gridY, 2, -1, -1)
          }
          this.groundLayer.addChild(this.highlightTile)
        }
      }
    })
  }

  createHighlightTile(gridX, gridY, size = 1, offsetX = 0, offsetY = 0) {
    const container = new PIXI.Container()

    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const pos = this.toIso(gridX + offsetX + dx, gridY + offsetY + dy)
        const tile = new PIXI.Graphics()

        tile.beginFill(0xffffff, 0.2)
        tile.moveTo(0, 0)
        tile.lineTo(this.tileWidth / 2, this.tileHeight / 2)
        tile.lineTo(0, this.tileHeight)
        tile.lineTo(-this.tileWidth / 2, this.tileHeight / 2)
        tile.closePath()
        tile.endFill()

        tile.lineStyle(2, 0xffffff, 0.6)
        tile.moveTo(0, 0)
        tile.lineTo(this.tileWidth / 2, this.tileHeight / 2)
        tile.lineTo(0, this.tileHeight)
        tile.lineTo(-this.tileWidth / 2, this.tileHeight / 2)
        tile.closePath()

        tile.x = pos.x
        tile.y = pos.y
        container.addChild(tile)
      }
    }

    return container
  }

  showDragPreview(gridX, gridY, isBlocked) {
    // remove existing preview
    if (this.dragPreviewTile) {
      this.groundLayer.removeChild(this.dragPreviewTile)
    }

    const container = new PIXI.Container()
    const color = isBlocked ? 0xff4444 : 0x44ff44
    const size = 2

    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const pos = this.toIso(gridX - 1 + dx, gridY - 1 + dy)
        const tile = new PIXI.Graphics()

        tile.beginFill(color, 0.3)
        tile.moveTo(0, 0)
        tile.lineTo(this.tileWidth / 2, this.tileHeight / 2)
        tile.lineTo(0, this.tileHeight)
        tile.lineTo(-this.tileWidth / 2, this.tileHeight / 2)
        tile.closePath()
        tile.endFill()

        tile.lineStyle(2, color, 0.8)
        tile.moveTo(0, 0)
        tile.lineTo(this.tileWidth / 2, this.tileHeight / 2)
        tile.lineTo(0, this.tileHeight)
        tile.lineTo(-this.tileWidth / 2, this.tileHeight / 2)
        tile.closePath()

        tile.x = pos.x
        tile.y = pos.y
        container.addChild(tile)
      }
    }

    this.dragPreviewTile = container
    this.groundLayer.addChild(container)
  }

  hideDragPreview() {
    if (this.dragPreviewTile) {
      this.groundLayer.removeChild(this.dragPreviewTile)
      this.dragPreviewTile = null
    }
  }

  drawIsometricGrid() {
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const tile = this.createIsometricTile(x, y)
        this.groundLayer.addChild(tile)
      }
    }
  }

  createIsometricTile(gridX, gridY) {
    const pos = this.toIso(gridX, gridY)
    const tile = new PIXI.Graphics()
    const baseColor = 0x2d5a27
    const shade = Math.random() * 0.1
    const color = this.adjustBrightness(baseColor, shade)

    tile.beginFill(color)
    tile.moveTo(0, 0)
    tile.lineTo(this.tileWidth / 2, this.tileHeight / 2)
    tile.lineTo(0, this.tileHeight)
    tile.lineTo(-this.tileWidth / 2, this.tileHeight / 2)
    tile.closePath()
    tile.endFill()

    tile.lineStyle(1, 0x1a4a1a, 0.3)
    tile.moveTo(0, 0)
    tile.lineTo(this.tileWidth / 2, this.tileHeight / 2)
    tile.lineTo(0, this.tileHeight)
    tile.lineTo(-this.tileWidth / 2, this.tileHeight / 2)
    tile.closePath()

    tile.x = pos.x
    tile.y = pos.y
    return tile
  }

  adjustBrightness(color, amount) {
    const r = Math.min(255, ((color >> 16) & 0xff) * (1 + amount))
    const g = Math.min(255, ((color >> 8) & 0xff) * (1 + amount))
    const b = Math.min(255, (color & 0xff) * (1 + amount))
    return (r << 16) | (g << 8) | b
  }

  async createTownHall() {
    const centerX = Math.floor(this.mapWidth / 2)
    const centerY = Math.floor(this.mapHeight / 2)
    const pos = this.toIso(centerX, centerY)

    const townHall = new PIXI.Container()
    townHall.x = pos.x
    townHall.y = pos.y - 40
    townHall.zIndex = pos.y - 30 // offset so units below midpoint show in front
    townHall.sortableChildren = true

    await this.drawTownHallSprite(townHall, 0)

    townHall.gridX = centerX
    townHall.gridY = centerY
    townHall.isTownHall = true

    this.buildingLayer.addChild(townHall)
    this.entities.townHall = townHall
    this.townHallLevel = 0

    this.makeInteractive(townHall, () => {
      const level = Math.floor(this.netWorth / 1000)
      return {
        title: 'TOWN HALL',
        lines: [`Level ${level}`, 'Net Worth']
      }
    }, 'townHall')
  }

  async drawTownHallSprite(container, level) {
    const spriteConfig = SPRITES.buildings.townHall

    // remove old sprite if exists
    const oldSprite = container.children.find(c => c instanceof PIXI.Sprite)
    if (oldSprite) container.removeChild(oldSprite)

    try {
      const texture = await this.tryLoadLevelSprite(spriteConfig, level)
      const sprite = new PIXI.Sprite(texture)
      sprite.anchor.set(spriteConfig.anchorX, spriteConfig.anchorY)
      sprite.width = spriteConfig.displayWidth || spriteConfig.width
      sprite.height = spriteConfig.displayHeight || spriteConfig.height
      container.addChildAt(sprite, 0)
    } catch (e) {
      // fallback procedural
      const body = new PIXI.Graphics()
      body.beginFill(0x6a8ccc)
      body.moveTo(-40, -20)
      body.lineTo(-40, 30)
      body.lineTo(0, 50)
      body.lineTo(40, 30)
      body.lineTo(40, -20)
      body.lineTo(0, -40)
      body.closePath()
      body.endFill()
      container.addChildAt(body, 0)
    }
  }

  async createMine() {
    const centerX = Math.floor(this.mapWidth / 2)
    const centerY = Math.floor(this.mapHeight / 2)
    const mineX = centerX - 5
    const mineY = centerY - 3
    const pos = this.toIso(mineX, mineY)
    const spriteConfig = SPRITES.buildings.mine

    const mine = new PIXI.Container()
    mine.x = pos.x
    mine.y = pos.y - 20
    mine.zIndex = pos.y - 30

    try {
      const texture = await PIXI.Assets.load(spriteConfig.path)
      const sprite = new PIXI.Sprite(texture)
      sprite.anchor.set(spriteConfig.anchorX, spriteConfig.anchorY)

      const baseHeight = spriteConfig.displayHeight || spriteConfig.height
      const stretchFactor = -0.1 // -10%

      sprite.width = spriteConfig.displayWidth || spriteConfig.width

      // stretch y axis
      sprite.height = baseHeight * (1 + stretchFactor)

      // offset y to fake "center" scaling
      // original offset was 0.35. we add half the stretch (0.05) to push it down 
      // balancing the upward growth
      sprite.y = (baseHeight * 0.4) + (baseHeight * (stretchFactor / 2))

      mine.addChild(sprite)
    } catch (e) {
      // ... keep existing fallback ...
      const body = new PIXI.Graphics()
      body.beginFill(0x8B4513)
      body.moveTo(-25, -10)
      body.lineTo(-25, 15)
      body.lineTo(0, 25)
      body.lineTo(25, 15)
      body.lineTo(25, -10)
      body.lineTo(0, -20)
      body.closePath()
      body.endFill()
      body.y = 14
      mine.addChild(body)
    }

    mine.gridX = mineX
    mine.gridY = mineY
    mine.isMine = true

    this.buildingLayer.addChild(mine)
    this.entities.mine = mine

    this.makeInteractive(mine, () => ({
      title: 'GOLD MINE',
      lines: ['Income']
    }))
  }

  setNetWorth(value) {
    const oldLevel = Math.floor(this.netWorth / 1000)
    const newLevel = Math.floor(value / 1000)
    this.netWorth = value

    // refresh town hall sprite if level changed
    if (oldLevel !== newLevel && this.entities.townHall) {
      this.drawTownHallSprite(this.entities.townHall, newLevel)
    }
  }

  // === Account-based building system ===

  async setAccounts(accounts) {
    this.accounts = accounts
    await this.syncBuildings()
  }

  setTimeView(timeView) {
    this.timeView = timeView
  }

  setPlaybackSpeed(speed) {
    this.playbackSpeed = speed
  }

  setBuildMode(enabled) {
    this.buildMode = enabled
    if (!enabled) {
      this.draggingBuilding = null
    }
    // toggle building label and flip arrow visibility
    for (const b of this.entities.buildings) {
      if (b.label) b.label.visible = enabled
      if (b.flipArrows) b.flipArrows.visible = enabled
    }
  }

  saveBuildingDirection(accountId, facingRight) {
    const saved = JSON.parse(localStorage.getItem('fincraft-building-directions') || '{}')
    saved[accountId] = facingRight
    localStorage.setItem('fincraft-building-directions', JSON.stringify(saved))
  }

  loadBuildingDirection(accountId) {
    const saved = JSON.parse(localStorage.getItem('fincraft-building-directions') || '{}')
    return saved[accountId] ?? false // default facing left
  }

  flipBuilding(building) {
    building.facingRight = !building.facingRight
    this.applyBuildingFlip(building)
    this.saveBuildingDirection(building.accountId, building.facingRight)
  }

  applyBuildingFlip(building) {
    // find and flip all sprites/graphics (but exclude Text objects and arrows)
    for (const child of building.container.children) {
      // Check if Sprite but NOT Text
      if ((child instanceof PIXI.Sprite && !(child instanceof PIXI.Text)) ||
        (child instanceof PIXI.Graphics && !child.isFlipArrow)) {

        child.scale.x = building.facingRight ? -Math.abs(child.scale.x) : Math.abs(child.scale.x)
      }
    }
  }

  createFlipArrows(building) {
    const arrows = new PIXI.Container()
    arrows.zIndex = 200
    arrows.visible = this.buildMode

    // left arrow
    const leftArrow = new PIXI.Text('◀', { fontSize: 14, fill: 0xffffff })
    leftArrow.anchor.set(0.5)
    leftArrow.x = -35
    leftArrow.y = -20
    leftArrow.eventMode = 'static'
    leftArrow.cursor = 'pointer'
    leftArrow.on('pointerdown', (e) => {
      e.stopPropagation()
      if (!building.facingRight) return // already facing left
      this.flipBuilding(building)
    })

    // right arrow
    const rightArrow = new PIXI.Text('▶', { fontSize: 14, fill: 0xffffff })
    rightArrow.anchor.set(0.5)
    rightArrow.x = 35
    rightArrow.y = -20
    rightArrow.eventMode = 'static'
    rightArrow.cursor = 'pointer'
    rightArrow.on('pointerdown', (e) => {
      e.stopPropagation()
      if (building.facingRight) return // already facing right
      this.flipBuilding(building)
    })

    arrows.addChild(leftArrow)
    arrows.addChild(rightArrow)
    return arrows
  }

  isTownHallZone(gridX, gridY) {
    // town hall protected area - only where 3x3 hover tiles show
    const centerX = Math.floor(this.mapWidth / 2)
    const centerY = Math.floor(this.mapHeight / 2)

    // building at gridX, gridY occupies 2x2 area: [gridX-1 to gridX, gridY-1 to gridY]
    // town hall 3x3 highlight occupies: [centerX-3 to centerX-1, centerY-3 to centerY-1]
    // check if they overlap
    return gridX >= centerX - 3 && gridX <= centerX &&
      gridY >= centerY - 3 && gridY <= centerY
  }

  getTimeMultiplier() {
    const multipliers = {
      '1W': 0.2,
      '1M': 1,
      '3M': 3,
      'YTD': 6,
      '1Y': 12
    }
    return multipliers[this.timeView] || 1
  }

  async syncBuildings() {
    // remove buildings that no longer exist
    this.entities.buildings = this.entities.buildings.filter(b => {
      const category = b.category
      const exists = this.accounts[category]?.some(a => a.id === b.accountId)
      if (!exists) {
        this.buildingLayer.removeChild(b.container)
      }
      return exists
    })

    // add/update buildings for each account
    const categories = ['depository', 'investments', 'creditCards', 'loans', 'others']
    for (const category of categories) {
      const accounts = this.accounts[category] || []
      for (let idx = 0; idx < accounts.length; idx++) {
        const account = accounts[idx]
        let building = this.entities.buildings.find(b => b.accountId === account.id)
        if (!building) {
          building = await this.createAccountBuilding(account, category, idx)
          this.entities.buildings.push(building)
        } else {
          // update existing building
          const oldLevel = Math.floor(building.balance / 1000)
          const newLevel = Math.floor(account.balance / 1000)
          building.balance = account.balance
          building.apr = account.apr || 0
          building.name = account.name

          // refresh sprite if level changed
          if (oldLevel !== newLevel) {
            await this.refreshBuildingSprite(building, category, newLevel)
          }
        }
      }
    }
  }

  saveBuildingPosition(accountId, gridX, gridY) {
    const positions = JSON.parse(localStorage.getItem('fincraft-building-positions') || '{}')
    positions[accountId] = { gridX, gridY }
    localStorage.setItem('fincraft-building-positions', JSON.stringify(positions))
  }

  loadBuildingPosition(accountId) {
    const positions = JSON.parse(localStorage.getItem('fincraft-building-positions') || '{}')
    return positions[accountId] || null
  }

  async refreshBuildingSprite(building, category, level) {
    const container = building.container
    // remove old sprite (first PIXI.Sprite child)
    const oldSprite = container.children.find(c => c instanceof PIXI.Sprite)
    if (oldSprite) {
      container.removeChild(oldSprite)
    }

    // redraw with new level
    const isDebt = category === 'creditCards' || category === 'loans'
    if (isDebt) {
      await this.drawDebtBuilding(container, level)
    } else if (category === 'depository') {
      await this.drawStorehouse(container, level)
    } else if (category === 'investments') {
      await this.drawTower(container, level)
    } else if (category === 'others') {
      await this.drawStatue(container, level)
    }

    // reapply flip state
    this.applyBuildingFlip(building)
  }

  async createAccountBuilding(account, category, index) {
    const isDebt = category === 'creditCards' || category === 'loans'
    const centerX = Math.floor(this.mapWidth / 2)
    const centerY = Math.floor(this.mapHeight / 2)

    // check for saved position first
    const savedPos = this.loadBuildingPosition(account.id)
    let gridX, gridY

    if (savedPos) {
      gridX = savedPos.gridX
      gridY = savedPos.gridY
    } else {
      const zone = this.zones[category]
      const offsetX = zone.x + (index % 3) * 2
      const offsetY = zone.y + Math.floor(index / 3) * 2
      gridX = centerX + offsetX
      gridY = centerY + offsetY
    }

    const pos = this.toIso(gridX, gridY)

    const container = new PIXI.Container()
    container.x = pos.x
    container.y = pos.y - 20
    container.zIndex = pos.y - 30
    container.gridX = gridX
    container.gridY = gridY

    const level = Math.floor(account.balance / 1000)
    if (isDebt) {
      await this.drawDebtBuilding(container, level)
    } else if (category === 'depository') {
      await this.drawStorehouse(container, level)
    } else if (category === 'investments') {
      await this.drawTower(container, level)
    } else if (category === 'others') {
      await this.drawStatue(container, level)
    } else {
      this.drawGoodBuilding(container, category)
    }

    // label (ensure it renders above sprite, only visible in edit mode)
    container.sortableChildren = true
    const label = new PIXI.Text(account.name, {
      fontSize: 8,
      fill: isDebt ? 0xff6666 : 0xaaffaa,
      fontWeight: 'bold'
    })
    label.anchor.set(0.5)
    label.y = isDebt ? 50 : 35
    label.zIndex = 100
    label.visible = this.buildMode
    container.addChild(label)

    this.buildingLayer.addChild(container)

    const building = {
      accountId: account.id,
      category,
      name: account.name,
      balance: account.balance,
      apr: account.apr || 0,
      isDebt,
      container,
      label,
      gridX,
      gridY,
      lastSpawn: 0,
      facingRight: this.loadBuildingDirection(account.id)
    }

    // add flip arrows (only visible in edit mode)
    const flipArrows = this.createFlipArrows(building)
    container.addChild(flipArrows)
    building.flipArrows = flipArrows

    // apply saved flip state
    this.applyBuildingFlip(building)

    this.makeInteractive(container, () => ({
      title: account.name,
      lines: [
        `Level ${Math.floor(building.balance / 1000)}`,
        `Balance: $${building.balance.toLocaleString()}`,
        ...(building.apr ? [`APR: ${building.apr}%`] : []),
        isDebt ? 'Debt' : (category === 'others' ? 'Asset' : 'Holding')
      ]
    }))

    return building
  }

  drawGoodBuilding(container, category) {
    const colors = {
      depository: 0x4a90d9,
      investments: 0xffd700,
      others: 0x90ee90
    }
    const color = colors[category] || 0x888888

    // shadow
    const shadow = new PIXI.Graphics()
    shadow.beginFill(0x000000, 0.3)
    shadow.drawEllipse(0, 25, 20, 8)
    shadow.endFill()
    container.addChild(shadow)

    // building body
    const body = new PIXI.Graphics()
    body.beginFill(color)
    body.moveTo(-20, -15)
    body.lineTo(-20, 15)
    body.lineTo(0, 25)
    body.lineTo(20, 15)
    body.lineTo(20, -15)
    body.lineTo(0, -25)
    body.closePath()
    body.endFill()

    // darker side
    body.beginFill(this.adjustBrightness(color, -0.3))
    body.moveTo(0, -25)
    body.lineTo(20, -15)
    body.lineTo(20, 15)
    body.lineTo(0, 25)
    body.closePath()
    body.endFill()

    container.addChild(body)
  }

  getLevelSpritePath(basePath, level) {
    // convert /assets/buildings/building-debt.png to /assets/buildings/building-debt-lvl0.png
    const ext = basePath.match(/\.[^.]+$/) || ['.png']
    const base = basePath.replace(/\.[^.]+$/, '')
    return `${base}-lvl${level}${ext[0]}`
  }

  async tryLoadLevelSprite(spriteConfig, level) {
    // try level-specific sprite first, then fall back to base
    // clamp to 0 minimum so negative balances use lvl0 sprites
    const clampedLevel = Math.max(0, level)
    const levelPath = this.getLevelSpritePath(spriteConfig.path, clampedLevel)
    try {
      const texture = await PIXI.Assets.load(levelPath)
      return texture
    } catch (e) {
      // level sprite not found, try base
    }
    return await PIXI.Assets.load(spriteConfig.path)
  }

  async drawDebtBuilding(container, level = 0) {
    const spriteConfig = SPRITES.buildings.debt

    try {
      const texture = await this.tryLoadLevelSprite(spriteConfig, level)
      const sprite = new PIXI.Sprite(texture)
      sprite.anchor.set(spriteConfig.anchorX, spriteConfig.anchorY)
      sprite.width = (spriteConfig.displayWidth || spriteConfig.width) * 1.08
      sprite.height = (spriteConfig.displayHeight || spriteConfig.height) * 0.95
      sprite.y = 26  // offset to align with tile
      container.addChild(sprite)
    } catch (e) {
      // fallback procedural portal
      const ground = new PIXI.Graphics()
      ground.beginFill(0x330033, 0.5)
      ground.drawEllipse(0, 20, 25, 12)
      ground.endFill()
      container.addChild(ground)

      const portal = new PIXI.Graphics()
      portal.beginFill(0x800080, 0.6)
      portal.drawEllipse(0, -5, 15, 20)
      portal.endFill()
      container.addChild(portal)

      const inner = new PIXI.Graphics()
      inner.beginFill(0x000000)
      inner.drawEllipse(0, -5, 8, 12)
      inner.endFill()
      container.addChild(inner)
    }
  }

  async drawStorehouse(container, level = 0) {
    const spriteConfig = SPRITES.buildings.storehouse

    try {
      const texture = await this.tryLoadLevelSprite(spriteConfig, level)
      const sprite = new PIXI.Sprite(texture)
      sprite.anchor.set(spriteConfig.anchorX, spriteConfig.anchorY)
      sprite.width = spriteConfig.displayWidth || spriteConfig.width
      sprite.height = (spriteConfig.displayHeight || spriteConfig.height) * 0.9  // 10% shorter vertically
      sprite.y = 23  // moved down 5%
      container.addChild(sprite)
    } catch (e) {
      // fallback to procedural
      this.drawGoodBuilding(container, 'depository')
    }
  }

  async drawTower(container, level = 0) {
    const spriteConfig = SPRITES.buildings.tower

    try {
      const texture = await this.tryLoadLevelSprite(spriteConfig, level)
      const sprite = new PIXI.Sprite(texture)
      sprite.anchor.set(spriteConfig.anchorX, spriteConfig.anchorY)
      sprite.width = spriteConfig.displayWidth || spriteConfig.width
      sprite.height = spriteConfig.displayHeight || spriteConfig.height
      sprite.y = 7.5  // moved up 10%
      container.addChild(sprite)
    } catch (e) {
      // fallback to procedural
      this.drawGoodBuilding(container, 'investments')
    }
  }

  async drawStatue(container, level = 0) {
    const spriteConfig = SPRITES.buildings.statue

    try {
      const texture = await this.tryLoadLevelSprite(spriteConfig, level)
      const sprite = new PIXI.Sprite(texture)
      sprite.anchor.set(spriteConfig.anchorX, spriteConfig.anchorY)
      sprite.width = spriteConfig.displayWidth || spriteConfig.width
      sprite.height = spriteConfig.displayHeight || spriteConfig.height
      sprite.y = 7.5  // moved up 10%
      container.addChild(sprite)
    } catch (e) {
      // fallback to procedural
      this.drawGoodBuilding(container, 'others')
    }
  }

  // === Unit spawning ===

  spawnPeon(building) {
    const pos = this.toIso(building.gridX, building.gridY)

    const peon = new PIXI.Container()
    peon.x = pos.x
    peon.y = pos.y

    // shadow
    const shadow = new PIXI.Graphics()
    shadow.beginFill(0x000000, 0.3)
    shadow.drawEllipse(0, 5, 6, 3)
    shadow.endFill()
    peon.addChild(shadow)

    // body
    const body = new PIXI.Graphics()
    body.beginFill(0xffd93d)
    body.drawEllipse(0, -3, 6, 8)
    body.endFill()
    peon.addChild(body)

    // gold bag
    const bag = new PIXI.Graphics()
    bag.beginFill(0xffd700)
    bag.drawCircle(5, 0, 4)
    bag.endFill()
    peon.addChild(bag)

    peon.targetX = this.entities.townHall.x
    peon.targetY = this.entities.townHall.y
    peon.speed = 1 + Math.random() * 0.5
    peon.wanderOffset = { x: 0, y: 0 }
    peon.wanderTimer = 0

    this.unitLayer.addChild(peon)
    this.entities.peons.push(peon)
  }

  spawnDemon(building) {
    const pos = this.toIso(building.gridX, building.gridY)

    const demon = new PIXI.Container()
    demon.x = pos.x
    demon.y = pos.y

    const intensity = Math.min(1, building.apr / 25)
    const sizeScale = 0.8 + intensity * 0.4

    if (this.impTextures) {
      const spriteConfig = SPRITES.units.imp
      const sprite = new PIXI.Sprite(this.impTextures[0])
      sprite.anchor.set(spriteConfig.anchorX, spriteConfig.anchorY)
      sprite.width = spriteConfig.displayWidth * sizeScale
      sprite.height = spriteConfig.displayHeight * sizeScale

      const shadow = new PIXI.Graphics()
      shadow.beginFill(0x000000, 0.25)
      const shadowSize = spriteConfig.displayWidth * sizeScale * 0.4
      shadow.moveTo(0, shadowSize * 0.3)
      shadow.lineTo(shadowSize, 0)
      shadow.lineTo(0, -shadowSize * 0.3)
      shadow.lineTo(-shadowSize, 0)
      shadow.closePath()
      shadow.endFill()
      shadow.y = spriteConfig.displayHeight * sizeScale * 0.1
      demon.addChild(shadow)
      demon.addChild(sprite)

      demon.animSprite = sprite
      demon.animFrame = 0
      demon.animTimer = 0
      demon.animSpeed = spriteConfig.animSpeed
    } else {
      // fallback placeholder
      const size = 8 + intensity * 6
      const shadow = new PIXI.Graphics()
      shadow.beginFill(0x000000, 0.4)
      shadow.drawEllipse(0, size / 2, size, size / 3)
      shadow.endFill()
      demon.addChild(shadow)

      const body = new PIXI.Graphics()
      body.beginFill(0xff0000 + Math.floor(intensity * 0x000066))
      body.drawCircle(0, 0, size)
      body.endFill()
      demon.addChild(body)

      const eyes = new PIXI.Graphics()
      eyes.beginFill(0xffff00)
      eyes.drawCircle(-3, -2, 2)
      eyes.drawCircle(3, -2, 2)
      eyes.endFill()
      demon.addChild(eyes)
    }

    demon.targetX = this.entities.townHall.x
    demon.targetY = this.entities.townHall.y
    demon.speed = 0.5 + Math.random() * 0.3
    demon.wanderOffset = { x: 0, y: 0 }
    demon.wanderTimer = 0

    // make interactive for hover label
    demon.eventMode = 'static'
    demon.cursor = 'default'

    demon.on('pointerover', () => {
      if (this.buildMode) return
      if (!demon.hoverLabel) {
        const label = new PIXI.Text('Interest', {
          fontSize: 7,
          fill: 0xffffff,
          fontWeight: 'bold'
        })
        label.anchor.set(0.5)
        label.y = -10
        demon.addChild(label)
        demon.hoverLabel = label
      }
      demon.hoverLabel.visible = true
    })

    demon.on('pointerout', () => {
      if (demon.hoverLabel) {
        demon.hoverLabel.visible = false
      }
    })

    this.unitLayer.addChild(demon)
    this.entities.demons.push(demon)
  }

  spawnCreep(amount) {
    // spawn from random map edge
    const edge = Math.floor(Math.random() * 4) // 0=top, 1=right, 2=bottom, 3=left
    let gridX, gridY

    switch (edge) {
      case 0: gridX = Math.floor(Math.random() * this.mapWidth); gridY = 0; break
      case 1: gridX = this.mapWidth - 1; gridY = Math.floor(Math.random() * this.mapHeight); break
      case 2: gridX = Math.floor(Math.random() * this.mapWidth); gridY = this.mapHeight - 1; break
      case 3: gridX = 0; gridY = Math.floor(Math.random() * this.mapHeight); break
    }

    const pos = this.toIso(gridX, gridY)
    const creep = new PIXI.Container()
    creep.x = pos.x
    creep.y = pos.y

    // size based on amount ($20 = small, $1500 = big)
    const size = Math.min(20, 6 + Math.log10(amount + 1) * 4)

    // shadow
    const shadow = new PIXI.Graphics()
    shadow.beginFill(0x000000, 0.3)
    shadow.drawEllipse(0, size / 2, size, size / 3)
    shadow.endFill()
    creep.addChild(shadow)

    // body - sickly green
    const body = new PIXI.Graphics()
    body.beginFill(0x44aa44)
    body.drawCircle(0, 0, size)
    body.endFill()
    creep.addChild(body)

    // angry eyes
    const eyes = new PIXI.Graphics()
    eyes.beginFill(0xff0000)
    eyes.drawCircle(-size / 3, -size / 4, size / 5)
    eyes.drawCircle(size / 3, -size / 4, size / 5)
    eyes.endFill()
    creep.addChild(eyes)

    creep.targetX = this.entities.townHall.x
    creep.targetY = this.entities.townHall.y
    creep.speed = 0.8 + Math.random() * 0.4
    creep.amount = amount
    creep.wanderOffset = { x: 0, y: 0 }
    creep.wanderTimer = 0

    this.unitLayer.addChild(creep)
    this.entities.creeps.push(creep)
  }

  spawnInfantry(amount, targetBuilding) {
    if (!targetBuilding) return

    // spawn from town hall
    const pos = {
      x: this.entities.townHall.x,
      y: this.entities.townHall.y
    }

    const infantry = new PIXI.Container()
    infantry.x = pos.x
    infantry.y = pos.y

    // size based on payment amount
    const size = Math.min(16, 5 + Math.log10(amount + 1) * 3)

    // shadow
    const shadow = new PIXI.Graphics()
    shadow.beginFill(0x000000, 0.3)
    shadow.drawEllipse(0, size / 2, size * 0.8, size / 3)
    shadow.endFill()
    infantry.addChild(shadow)

    // body - blue warrior
    const body = new PIXI.Graphics()
    body.beginFill(0x4488ff)
    body.drawEllipse(0, 0, size * 0.7, size)
    body.endFill()
    infantry.addChild(body)

    // shield
    const shield = new PIXI.Graphics()
    shield.beginFill(0xcccccc)
    shield.drawEllipse(-size * 0.6, 0, size * 0.3, size * 0.5)
    shield.endFill()
    infantry.addChild(shield)

    // sword
    const sword = new PIXI.Graphics()
    sword.beginFill(0xffdd44)
    sword.drawRect(size * 0.4, -size * 0.8, 3, size * 1.2)
    sword.endFill()
    infantry.addChild(sword)

    const targetPos = this.toIso(targetBuilding.gridX, targetBuilding.gridY)
    infantry.targetX = targetPos.x
    infantry.targetY = targetPos.y - 20
    infantry.speed = 1.2 + Math.random() * 0.3
    infantry.amount = amount
    infantry.targetBuilding = targetBuilding
    infantry.wanderOffset = { x: 0, y: 0 }
    infantry.wanderTimer = 0

    this.unitLayer.addChild(infantry)
    this.entities.infantry.push(infantry)
  }

  // === Game loop ===

  gameLoop() {
    this.tickCount++

    // smooth keyboard panning
    const panSpeed = 8
    if (this.keysPressed.has('ArrowUp') || this.keysPressed.has('w')) this.worldContainer.y += panSpeed
    if (this.keysPressed.has('ArrowDown') || this.keysPressed.has('s')) this.worldContainer.y -= panSpeed
    if (this.keysPressed.has('ArrowLeft') || this.keysPressed.has('a')) this.worldContainer.x += panSpeed
    if (this.keysPressed.has('ArrowRight') || this.keysPressed.has('d')) this.worldContainer.x -= panSpeed

    // tooltip animation
    this.updateTooltipAnim()

    // smooth zoom for keyboard only (eased, no overshoot)
    const zoomDiff = this.targetZoom - this.zoomLevel
    if (Math.abs(zoomDiff) > 0.001 && this.targetZoom !== 1) {
      const ease = 0.15
      const centerX = this.width / 2
      const centerY = this.height / 2
      const worldX = (centerX - this.worldContainer.x) / this.zoomLevel
      const worldY = (centerY - this.worldContainer.y) / this.zoomLevel

      this.zoomLevel += zoomDiff * ease
      this.zoomLevel = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoomLevel))
      this.worldContainer.scale.set(this.zoomLevel)
      this.worldContainer.x = centerX - worldX * this.zoomLevel
      this.worldContainer.y = centerY - worldY * this.zoomLevel
    } else if (Math.abs(zoomDiff) <= 0.001) {
      this.targetZoom = this.zoomLevel
    }

    // process event queue
    const event = this.eventQueue.popIfReady(Date.now())
    if (event) {
      if (event.type === 'expense') {
        this.spawnCreep(event.amount)
      } else if (event.type === 'debt-payment') {
        const targetBuilding = this.entities.buildings.find(b => b.accountId === event.targetId)
        if (targetBuilding) {
          this.spawnInfantry(event.amount, targetBuilding)
        }
      }
    }

    // move peons toward town hall with wandering
    const townHallX = this.entities.townHall?.x || 0
    const townHallY = this.entities.townHall?.y || 0

    this.entities.peons = this.entities.peons.filter(peon => {
      // wandering behavior
      peon.wanderTimer++
      if (peon.wanderTimer > 30) {
        peon.wanderOffset.x = (Math.random() - 0.5) * 20
        peon.wanderOffset.y = (Math.random() - 0.5) * 10
        peon.wanderTimer = 0
      }

      const targetX = townHallX + peon.wanderOffset.x
      const targetY = townHallY + peon.wanderOffset.y
      const dx = targetX - peon.x
      const dy = targetY - peon.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < 30) {
        this.unitLayer.removeChild(peon)
        this.spawnGoldParticle(peon.x, peon.y)
        return false
      }

      peon.x += (dx / dist) * peon.speed * this.playbackSpeed
      peon.y += (dy / dist) * peon.speed * this.playbackSpeed
      peon.zIndex = peon.y
      return true
    })

    // move demons toward town hall
    this.entities.demons = this.entities.demons.filter(demon => {
      demon.wanderTimer++
      if (demon.wanderTimer > 40) {
        demon.wanderOffset.x = (Math.random() - 0.5) * 30
        demon.wanderOffset.y = (Math.random() - 0.5) * 15
        demon.wanderTimer = 0
      }

      const targetX = townHallX + demon.wanderOffset.x
      const targetY = townHallY + demon.wanderOffset.y
      const dx = targetX - demon.x
      const dy = targetY - demon.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < 35) {
        this.unitLayer.removeChild(demon)
        this.spawnDebtParticle(demon.x, demon.y)
        return false
      }

      demon.x += (dx / dist) * demon.speed * this.playbackSpeed
      demon.y += (dy / dist) * demon.speed * this.playbackSpeed
      demon.zIndex = demon.y

      // animate imp sprite
      if (demon.animSprite && this.impTextures) {
        demon.animTimer += demon.animSpeed * this.playbackSpeed
        if (demon.animTimer >= 1) {
          demon.animTimer = 0
          demon.animFrame = (demon.animFrame + 1) % 4
          demon.animSprite.texture = this.impTextures[demon.animFrame]
        }
        // mirror sprite based on movement direction
        demon.animSprite.scale.x = (dx < 0) ? -Math.abs(demon.animSprite.scale.x) : Math.abs(demon.animSprite.scale.x)
      }

      return true
    })

    // move creeps toward town hall
    this.entities.creeps = this.entities.creeps.filter(creep => {
      creep.wanderTimer++
      if (creep.wanderTimer > 35) {
        creep.wanderOffset.x = (Math.random() - 0.5) * 25
        creep.wanderOffset.y = (Math.random() - 0.5) * 12
        creep.wanderTimer = 0
      }

      const targetX = townHallX + creep.wanderOffset.x
      const targetY = townHallY + creep.wanderOffset.y
      const dx = targetX - creep.x
      const dy = targetY - creep.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < 35) {
        this.unitLayer.removeChild(creep)
        this.spawnExpenseParticle(creep.x, creep.y, creep.amount)
        return false
      }

      creep.x += (dx / dist) * creep.speed * this.playbackSpeed
      creep.y += (dy / dist) * creep.speed * this.playbackSpeed
      creep.zIndex = creep.y
      return true
    })

    // move infantry toward target debt building
    this.entities.infantry = this.entities.infantry.filter(infantry => {
      infantry.wanderTimer++
      if (infantry.wanderTimer > 25) {
        infantry.wanderOffset.x = (Math.random() - 0.5) * 15
        infantry.wanderOffset.y = (Math.random() - 0.5) * 8
        infantry.wanderTimer = 0
      }

      const targetX = infantry.targetX + infantry.wanderOffset.x
      const targetY = infantry.targetY + infantry.wanderOffset.y
      const dx = targetX - infantry.x
      const dy = targetY - infantry.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < 30) {
        this.unitLayer.removeChild(infantry)
        this.spawnPaymentParticle(infantry.x, infantry.y, infantry.amount)
        return false
      }

      infantry.x += (dx / dist) * infantry.speed * this.playbackSpeed
      infantry.y += (dy / dist) * infantry.speed * this.playbackSpeed
      infantry.zIndex = infantry.y
      return true
    })

    // spawn transaction npcs at interval
    const now = Date.now()
    if (this.transactionPool.length > 0 && now - this.lastTransactionSpawn >= this.transactionSpawnInterval / this.playbackSpeed) {
      this.spawnTransactionNpc()
      this.lastTransactionSpawn = now
    }

    // move transaction npcs along isometric grid - continuous movement
    this.entities.transactionNpcs = this.entities.transactionNpcs.filter(npc => {
      // get target position in screen coords
      const targetPos = this.toIso(npc.targetGridX, npc.targetGridY)
      const dx = targetPos.x - npc.x
      const dy = targetPos.y - npc.y
      const distToTarget = Math.sqrt(dx * dx + dy * dy)

      // check if reached target
      if (distToTarget < 15) {
        this.unitLayer.removeChild(npc)
        if (npc.npcType === 'income') {
          this.spawnTransactionParticle(npc.x, npc.y, npc.transactionData.amount, 'income')
        } else if (npc.npcType === 'transfer') {
          this.spawnTransactionParticle(npc.x, npc.y, npc.transactionData.amount, 'transfer')
        } else {
          this.spawnTransactionParticle(npc.x, npc.y, npc.transactionData.amount, 'expense')
        }
        return false
      }

      // update grid position from screen position
      const currentGrid = this.fromIso(npc.x, npc.y)
      npc.gridX = Math.round(currentGrid.x)
      npc.gridY = Math.round(currentGrid.y)

      // initialize direction if needed
      if (!npc.moveDir) {
        npc.moveDir = { x: 0, y: 0 }
        npc.targetDir = { x: dx / distToTarget, y: dy / distToTarget }
      }

      // recalculate target direction less frequently (every 30 frames)
      npc.pathTimer = (npc.pathTimer || 0) + 1
      if (npc.pathTimer > 30) {
        npc.pathTimer = 0

        // look ahead 2-3 tiles for smoother pathing
        let targetDir = { x: dx / distToTarget, y: dy / distToTarget }
        const nextTile = this.getNextTile(npc)
        if (nextTile) {
          // look one more step ahead
          const tempNpc = { gridX: nextTile.x, gridY: nextTile.y, targetGridX: npc.targetGridX, targetGridY: npc.targetGridY }
          const nextNextTile = this.getNextTile(tempNpc)
          if (nextNextTile) {
            const farPos = this.toIso(nextNextTile.x, nextNextTile.y)
            const fdx = farPos.x - npc.x
            const fdy = farPos.y - npc.y
            const fdist = Math.sqrt(fdx * fdx + fdy * fdy)
            if (fdist > 0) {
              targetDir = { x: fdx / fdist, y: fdy / fdist }
            }
          } else {
            const nextPos = this.toIso(nextTile.x, nextTile.y)
            const ndx = nextPos.x - npc.x
            const ndy = nextPos.y - npc.y
            const ndist = Math.sqrt(ndx * ndx + ndy * ndy)
            if (ndist > 0) {
              targetDir = { x: ndx / ndist, y: ndy / ndist }
            }
          }
        }
        npc.targetDir = targetDir
      }

      // smoothly ease current direction toward target direction
      const easing = 0.08
      npc.moveDir.x += (npc.targetDir.x - npc.moveDir.x) * easing
      npc.moveDir.y += (npc.targetDir.y - npc.moveDir.y) * easing

      // normalize to prevent speed changes
      const dirMag = Math.sqrt(npc.moveDir.x * npc.moveDir.x + npc.moveDir.y * npc.moveDir.y)
      if (dirMag > 0.01) {
        npc.moveDir.x /= dirMag
        npc.moveDir.y /= dirMag
      }

      // continuous movement
      const moveSpeed = 0.5 * this.playbackSpeed
      npc.x += npc.moveDir.x * moveSpeed
      npc.y += npc.moveDir.y * moveSpeed

      npc.zIndex = npc.y

      // animate sprite if present
      if (npc.animSprite) {
        const textures = npc.useBarbarian ? this.barbarianTextures :
                         npc.useHumanGold ? this.humanGoldTextures : this.skeletonTextures
        if (textures) {
          npc.animTimer += npc.animSpeed * this.playbackSpeed
          if (npc.animTimer >= 1) {
            npc.animTimer = 0
            npc.animFrame = (npc.animFrame + 1) % 4
            npc.animSprite.texture = textures[npc.animFrame]
          }
          // mirror sprite if npc is to the right of target
          npc.animSprite.scale.x = (npc.x > npc.targetX) ? -Math.abs(npc.animSprite.scale.x) : Math.abs(npc.animSprite.scale.x)
        }
      }

      // show name label in edit mode
      if (this.buildMode && !npc.nameLabel) {
        const label = new PIXI.Text(npc.transactionData.name.substring(0, 15), {
          fontSize: 7,
          fill: 0xffffff,
          fontWeight: 'bold'
        })
        label.anchor.set(0.5)
        label.y = -10
        npc.addChild(label)
        npc.nameLabel = label
      } else if (!this.buildMode && npc.nameLabel) {
        npc.removeChild(npc.nameLabel)
        npc.nameLabel = null
      }

      // timeout - remove if stuck for too long
      npc.lifetime = (npc.lifetime || 0) + 1
      if (npc.lifetime > 3000) { // ~50 seconds at 60fps
        this.unitLayer.removeChild(npc)
        return false
      }

      return true
    })

    // sort by depth
    this.gameObjectLayer.children.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
  }

  spawnGoldParticle(x, y) {
    const particle = new PIXI.Text('+$', {
      fontSize: 10,
      fill: 0xffd700,
      fontWeight: 'bold'
    })
    particle.anchor.set(0.5)
    particle.x = x
    particle.y = y
    this.effectLayer.addChild(particle)

    let frames = 0
    const animate = () => {
      frames++
      particle.y -= 0.8
      particle.alpha -= 0.025
      if (particle.alpha <= 0 || frames > 40) {
        this.effectLayer.removeChild(particle)
        this.app.ticker.remove(animate)
      }
    }
    this.app.ticker.add(animate)
  }

  spawnDebtParticle(x, y) {
    const particle = new PIXI.Text('-$', {
      fontSize: 10,
      fill: 0xff4444,
      fontWeight: 'bold'
    })
    particle.anchor.set(0.5)
    particle.x = x
    particle.y = y
    this.effectLayer.addChild(particle)

    let frames = 0
    const animate = () => {
      frames++
      particle.y -= 0.8
      particle.alpha -= 0.025
      if (particle.alpha <= 0 || frames > 40) {
        this.effectLayer.removeChild(particle)
        this.app.ticker.remove(animate)
      }
    }
    this.app.ticker.add(animate)
  }

  spawnExpenseParticle(x, y, amount) {
    const particle = new PIXI.Text(`-$${amount}`, {
      fontSize: 12,
      fill: 0xff6644,
      fontWeight: 'bold'
    })
    particle.anchor.set(0.5)
    particle.x = x
    particle.y = y
    this.effectLayer.addChild(particle)

    let frames = 0
    const animate = () => {
      frames++
      particle.y -= 1
      particle.alpha -= 0.02
      if (particle.alpha <= 0 || frames > 50) {
        this.effectLayer.removeChild(particle)
        this.app.ticker.remove(animate)
      }
    }
    this.app.ticker.add(animate)
  }

  spawnPaymentParticle(x, y, amount) {
    const particle = new PIXI.Text(`+$${amount}`, {
      fontSize: 12,
      fill: 0x44ff88,
      fontWeight: 'bold'
    })
    particle.anchor.set(0.5)
    particle.x = x
    particle.y = y
    this.effectLayer.addChild(particle)

    let frames = 0
    const animate = () => {
      frames++
      particle.y -= 1
      particle.scale.set(1 + frames * 0.01)
      particle.alpha -= 0.02
      if (particle.alpha <= 0 || frames > 50) {
        this.effectLayer.removeChild(particle)
        this.app.ticker.remove(animate)
      }
    }
    this.app.ticker.add(animate)
  }

  spawnTransactionParticle(x, y, amount, type) {
    const colors = {
      income: 0xffd700,   // gold
      expense: 0xff6b6b, // red
      transfer: 0x44ccff // cyan
    }
    const signs = {
      income: '+',
      expense: '-',
      transfer: ''
    }

    const particle = new PIXI.Text(`${signs[type]}$${Math.round(amount)}`, {
      fontSize: 11,
      fill: colors[type] || 0xffffff,
      fontWeight: 'bold'
    })
    particle.anchor.set(0.5)
    particle.x = x
    particle.y = y
    this.effectLayer.addChild(particle)

    let frames = 0
    const animate = () => {
      frames++
      particle.y -= 0.8
      particle.alpha -= 0.02
      if (particle.alpha <= 0 || frames > 50) {
        this.effectLayer.removeChild(particle)
        this.app.ticker.remove(animate)
      }
    }
    this.app.ticker.add(animate)
  }

  // public method to push events from UI
  pushEvent(event) {
    this.eventQueue.push(event)
  }

  // reload transaction pool (call when new csv imported)
  reloadTransactions() {
    this.loadTransactionPool()
  }

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }
    if (this.app) {
      this.app.destroy(true)
    }
  }
}
