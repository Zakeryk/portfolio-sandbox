import * as PIXI from 'pixi.js'
import { SPRITES } from './sprites.js'

export class GameEngine {
  constructor(container) {
    this.container = container
    this.app = null

    this.entities = {
      townHall: null,
      buildings: [],  // account-based buildings
      peons: [],      // gold carriers
      demons: [],     // debt enemies
    }

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
    this.buildingLayer = new PIXI.Container()
    this.unitLayer = new PIXI.Container()
    this.effectLayer = new PIXI.Container()

    this.worldContainer.addChild(this.groundLayer)
    this.worldContainer.addChild(this.buildingLayer)
    this.worldContainer.addChild(this.unitLayer)
    this.worldContainer.addChild(this.effectLayer)

    const centerTile = this.toIso(this.mapWidth / 2, this.mapHeight / 2)
    this.worldContainer.x = (this.width / 2) - centerTile.x
    this.worldContainer.y = (this.height / 2) - centerTile.y

    this.setupPanning()
    this.createTooltip()
    this.drawIsometricGrid()
    await this.createTownHall()

    this.app.ticker.add(() => this.gameLoop())
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

    view.addEventListener('mousedown', (e) => {
      // don't pan if hovering a building
      if (this.hoveringBuilding) return
      this.clickedBuilding = false
      setTimeout(() => {
        if (this.clickedBuilding) return
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
          this.draggingBuilding.zIndex = pos.y

          // update building in entities array
          const building = this.entities.buildings.find(b => b.container === this.draggingBuilding)
          if (building) {
            building.gridX = gridX
            building.gridY = gridY
          }
        }

        this.draggingBuilding = null
        this.hideDragPreview()
      }
      this.isPanning = false
      view.style.cursor = 'default'
    })

    view.addEventListener('mouseleave', () => {
      this.isPanning = false
      view.style.cursor = 'default'
    })

    window.addEventListener('keydown', (e) => {
      if (e.key === '0') this.centerOnTownHall()
    })

    view.addEventListener('wheel', (e) => {
      e.preventDefault()
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoomLevel * zoomFactor))
      if (newZoom !== this.zoomLevel) {
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
    }, { passive: false })
  }

  centerOnTownHall() {
    this.zoomLevel = 1
    this.worldContainer.scale.set(1)
    const centerTile = this.toIso(this.mapWidth / 2, this.mapHeight / 2)
    this.worldContainer.x = (this.width / 2) - centerTile.x
    this.worldContainer.y = (this.height / 2) - centerTile.y
  }

  createTooltip() {
    this.tooltip = new PIXI.Container()
    this.tooltip.visible = false
    this.activeTooltipEntity = null

    const bg = new PIXI.Graphics()
    bg.beginFill(0x1a1a2e, 0.95)
    bg.lineStyle(1, 0x4a4a6e)
    bg.drawRoundedRect(0, 0, 140, 80, 6)
    bg.endFill()

    const title = new PIXI.Text('', { fontSize: 11, fill: 0xffffff, fontWeight: 'bold' })
    title.x = 8
    title.y = 6

    const content = new PIXI.Text('', { fontSize: 10, fill: 0xcccccc, lineHeight: 14 })
    content.x = 8
    content.y = 24

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
    const width = Math.max(120, this.tooltip.contentText.width + 16, this.tooltip.titleText.width + 16)
    const height = 28 + lines.length * 14
    this.tooltip.bg.clear()
    this.tooltip.bg.beginFill(0x1a1a2e, 0.95)
    this.tooltip.bg.lineStyle(1, 0x4a4a6e)
    this.tooltip.bg.drawRoundedRect(0, 0, width, height, 6)
    this.tooltip.bg.endFill()
    this.tooltip.x = x + 15
    this.tooltip.y = y - 10
    this.tooltip.visible = true
  }

  hideTooltip() {
    this.tooltip.visible = false
    if (this.highlightTile) {
      this.groundLayer.removeChild(this.highlightTile)
      this.highlightTile = null
    }
  }

  makeInteractive(entity, getTooltipData) {
    entity.eventMode = 'static'
    entity.cursor = 'pointer'
    entity.tooltipData = getTooltipData

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
        this.showTooltip(e.global.x, e.global.y, data.title, data.lines)
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
    const spriteConfig = SPRITES.buildings.townHall

    const townHall = new PIXI.Container()
    townHall.x = pos.x
    townHall.y = pos.y - 40
    townHall.zIndex = pos.y

    try {
      const texture = await PIXI.Assets.load(spriteConfig.path)
      const sprite = new PIXI.Sprite(texture)
      sprite.anchor.set(spriteConfig.anchorX, spriteConfig.anchorY)
      sprite.width = spriteConfig.displayWidth || spriteConfig.width
      sprite.height = spriteConfig.displayHeight || spriteConfig.height
      townHall.addChild(sprite)
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
      townHall.addChild(body)
    }

    townHall.gridX = centerX
    townHall.gridY = centerY
    townHall.isTownHall = true

    this.buildingLayer.addChild(townHall)
    this.entities.townHall = townHall

    this.makeInteractive(townHall, () => ({
      title: '🏰 TOWN HALL',
      lines: ['Center of your financial kingdom']
    }))
  }

  // === Account-based building system ===

  setAccounts(accounts) {
    this.accounts = accounts
    this.syncBuildings()
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
  }

  isTownHallZone(gridX, gridY) {
    // town hall protected area - 5 tile buffer around center
    const centerX = Math.floor(this.mapWidth / 2)
    const centerY = Math.floor(this.mapHeight / 2)
    const buffer = 5

    return gridX >= centerX - buffer && gridX <= centerX + buffer &&
           gridY >= centerY - buffer && gridY <= centerY + buffer
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

  syncBuildings() {
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
    categories.forEach(category => {
      const accounts = this.accounts[category] || []
      accounts.forEach((account, idx) => {
        let building = this.entities.buildings.find(b => b.accountId === account.id)
        if (!building) {
          building = this.createAccountBuilding(account, category, idx)
          this.entities.buildings.push(building)
        } else {
          // update existing building
          building.balance = account.balance
          building.apr = account.apr || 0
          building.name = account.name
        }
      })
    })
  }

  createAccountBuilding(account, category, index) {
    const isDebt = category === 'creditCards' || category === 'loans'
    const centerX = Math.floor(this.mapWidth / 2)
    const centerY = Math.floor(this.mapHeight / 2)

    const zone = this.zones[category]
    const offsetX = zone.x + (index % 3) * 2
    const offsetY = zone.y + Math.floor(index / 3) * 2

    const gridX = centerX + offsetX
    const gridY = centerY + offsetY
    const pos = this.toIso(gridX, gridY)

    const container = new PIXI.Container()
    container.x = pos.x
    container.y = pos.y - 20
    container.zIndex = pos.y
    container.gridX = gridX
    container.gridY = gridY

    if (isDebt) {
      this.drawDebtBuilding(container)
    } else {
      this.drawGoodBuilding(container, category)
    }

    // label
    const label = new PIXI.Text(account.name, {
      fontSize: 8,
      fill: isDebt ? 0xff6666 : 0xaaffaa,
      fontWeight: 'bold'
    })
    label.anchor.set(0.5)
    label.y = 35
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
      gridX,
      gridY,
      lastSpawn: 0
    }

    this.makeInteractive(container, () => ({
      title: isDebt ? `🔥 ${account.name}` : `🏦 ${account.name}`,
      lines: [
        `Balance: $${building.balance.toLocaleString()}`,
        ...(building.apr ? [`APR: ${building.apr}%`] : []),
        isDebt ? 'Spawns demons' : 'Holding'
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

  async drawDebtBuilding(container) {
    const spriteConfig = SPRITES.buildings.debt

    try {
      const texture = await PIXI.Assets.load(spriteConfig.path)
      const sprite = new PIXI.Sprite(texture)
      sprite.anchor.set(spriteConfig.anchorX, spriteConfig.anchorY)
      sprite.width = spriteConfig.displayWidth || spriteConfig.width
      sprite.height = spriteConfig.displayHeight || spriteConfig.height
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
    const size = 8 + intensity * 6

    // shadow
    const shadow = new PIXI.Graphics()
    shadow.beginFill(0x000000, 0.4)
    shadow.drawEllipse(0, size/2, size, size/3)
    shadow.endFill()
    demon.addChild(shadow)

    // body
    const body = new PIXI.Graphics()
    body.beginFill(0xff0000 + Math.floor(intensity * 0x000066))
    body.drawCircle(0, 0, size)
    body.endFill()
    demon.addChild(body)

    // eyes
    const eyes = new PIXI.Graphics()
    eyes.beginFill(0xffff00)
    eyes.drawCircle(-3, -2, 2)
    eyes.drawCircle(3, -2, 2)
    eyes.endFill()
    demon.addChild(eyes)

    demon.targetX = this.entities.townHall.x
    demon.targetY = this.entities.townHall.y
    demon.speed = 0.5 + Math.random() * 0.3
    demon.wanderOffset = { x: 0, y: 0 }
    demon.wanderTimer = 0

    this.unitLayer.addChild(demon)
    this.entities.demons.push(demon)
  }

  // === Game loop ===

  gameLoop() {
    this.tickCount++

    // spawn demons from debt buildings only (credit cards + loans)
    // depository/investments/others are static holdings - no spawning
    this.entities.buildings.forEach(building => {
      if (!building.isDebt) return  // only debt spawns

      building.lastSpawn++

      const spawnRate = this.calculateSpawnRate(building.balance)
      const effectiveRate = spawnRate / (this.playbackSpeed * this.getTimeMultiplier())

      if (building.lastSpawn >= effectiveRate && building.balance > 0) {
        this.spawnDemon(building)
        building.lastSpawn = 0
      }
    })

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
      return true
    })

    // sort by depth
    this.buildingLayer.children.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    this.unitLayer.children.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
  }

  calculateSpawnRate(balance) {
    // higher balance = faster spawns (lower tick count)
    // base: $1000 = spawn every 120 ticks
    if (balance <= 0) return 99999
    return Math.max(30, 120000 / balance)
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

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }
    if (this.app) {
      this.app.destroy(true)
    }
  }
}
