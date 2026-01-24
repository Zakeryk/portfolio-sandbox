import { useEffect, useRef, useState } from 'react'
import { GameEngine } from './game/GameEngine'
import './index.css'

const generateId = () => Math.random().toString(36).substr(2, 9)

const defaultAccounts = {
  depository: [],
  investments: [],
  creditCards: [],
  loans: [],
  others: []
}

function Accordion({ title, isOpen, onToggle, children, total, isDebt }) {
  return (
    <div className="bg-[#1a1a2e] rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-[#252542] cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">{isOpen ? '▼' : '▶'}</span>
          <span className="text-xs font-bold text-gray-400">{title}</span>
        </div>
        <span className={`text-xs font-bold ${isDebt ? 'text-red-400' : 'text-green-400'}`}>
          ${Math.abs(total).toLocaleString()}
        </span>
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

function LineItem({ item, onUpdate, onDelete, showApr }) {
  const [editing, setEditing] = useState(null)
  const [editValue, setEditValue] = useState('')

  const startEdit = (field, value) => {
    setEditing(field)
    setEditValue(String(value))
  }

  const saveEdit = () => {
    if (editing === 'name') {
      onUpdate({ ...item, name: editValue })
    } else if (editing === 'balance') {
      onUpdate({ ...item, balance: parseFloat(editValue) || 0 })
    } else if (editing === 'apr') {
      onUpdate({ ...item, apr: parseFloat(editValue) || 0 })
    }
    setEditing(null)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') saveEdit()
    if (e.key === 'Escape') setEditing(null)
  }

  return (
    <div className="flex items-center justify-between py-1.5 group">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {editing === 'name' ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            className="bg-[#0f0f1a] text-white text-xs px-2 py-1 rounded w-full"
            autoFocus
          />
        ) : (
          <span
            onClick={() => startEdit('name', item.name)}
            className="text-xs text-gray-300 truncate cursor-pointer hover:text-white"
          >
            {item.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {showApr && (
          editing === 'apr' ? (
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleKeyDown}
              className="bg-[#0f0f1a] text-white text-xs px-2 py-1 rounded w-16"
              autoFocus
            />
          ) : (
            <span
              onClick={() => startEdit('apr', item.apr || 0)}
              className="text-xs text-orange-400 cursor-pointer hover:text-orange-300"
            >
              {item.apr || 0}%
            </span>
          )
        )}
        {editing === 'balance' ? (
          <input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={handleKeyDown}
            className="bg-[#0f0f1a] text-white text-xs px-2 py-1 rounded w-24"
            autoFocus
          />
        ) : (
          <span
            onClick={() => startEdit('balance', item.balance)}
            className="text-xs text-white cursor-pointer hover:text-blue-300 font-mono"
          >
            ${item.balance.toLocaleString()}
          </span>
        )}
        <button
          onClick={() => onDelete(item.id)}
          className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition text-xs"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function App() {
  const gameContainerRef = useRef(null)
  const gameRef = useRef(null)

  const [accounts, setAccounts] = useState(() => {
    const saved = localStorage.getItem('fincraft-accounts')
    return saved ? JSON.parse(saved) : defaultAccounts
  })
  const [timeView, setTimeView] = useState(() => {
    return localStorage.getItem('fincraft-timeView') || '1M'
  })
  const [playbackSpeed, setPlaybackSpeed] = useState(() => {
    return parseFloat(localStorage.getItem('fincraft-speed')) || 1
  })
  const [buildMode, setBuildMode] = useState(false)
  const [showSimPanel, setShowSimPanel] = useState(() => {
    return localStorage.getItem('fincraft-sim-panel') === 'true'
  })
  const [simPanelCollapsed, setSimPanelCollapsed] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [isDraggingCsv, setIsDraggingCsv] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [panelView, setPanelView] = useState('portfolio') // 'portfolio' | 'transactions'
  const [dateFilter, setDateFilter] = useState('all') // 'all' | '7d' | '30d' | '90d'
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('fincraft-transactions')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch { return [] }
    }
    return []
  })
  const transactionCount = transactions.length
  const [openAccordions, setOpenAccordions] = useState({
    depository: false,
    investments: false,
    creditCards: false,
    loans: false,
    others: false
  })
  const [isFullscreen, setIsFullscreen] = useState(false)

  // persist to localStorage
  useEffect(() => {
    localStorage.setItem('fincraft-accounts', JSON.stringify(accounts))
  }, [accounts])

  useEffect(() => {
    localStorage.setItem('fincraft-timeView', timeView)
  }, [timeView])

  useEffect(() => {
    localStorage.setItem('fincraft-speed', playbackSpeed.toString())
  }, [playbackSpeed])

  // sync with game engine
  useEffect(() => {
    if (gameRef.current) {
      gameRef.current.setAccounts(accounts)
      gameRef.current.setTimeView(timeView)
      gameRef.current.setPlaybackSpeed(playbackSpeed)
      gameRef.current.setBuildMode(buildMode)
      // net worth = assets - debt
      const assets = accounts.depository.reduce((s, a) => s + a.balance, 0) +
                     accounts.investments.reduce((s, a) => s + a.balance, 0) +
                     accounts.others.reduce((s, a) => s + a.balance, 0)
      const debt = accounts.creditCards.reduce((s, a) => s + a.balance, 0) +
                   accounts.loans.reduce((s, a) => s + a.balance, 0)
      gameRef.current.setNetWorth(assets - debt)
    }
  }, [accounts, timeView, playbackSpeed, buildMode])

  useEffect(() => {
    if (gameContainerRef.current && !gameRef.current) {
      const game = new GameEngine(gameContainerRef.current)
      gameRef.current = game
      game.init().then(() => {
        game.setAccounts(accounts)
        game.setTimeView(timeView)
        game.setPlaybackSpeed(playbackSpeed)
        game.setBuildMode(buildMode)
        const assets = accounts.depository.reduce((s, a) => s + a.balance, 0) +
                       accounts.investments.reduce((s, a) => s + a.balance, 0) +
                       accounts.others.reduce((s, a) => s + a.balance, 0)
        const debt = accounts.creditCards.reduce((s, a) => s + a.balance, 0) +
                     accounts.loans.reduce((s, a) => s + a.balance, 0)
        game.setNetWorth(assets - debt)
      })
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy()
        gameRef.current = null
      }
    }
  }, [])

  // keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // ignore when typing in inputs
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') {
        if (buildMode) setBuildMode(false)
        if (isFullscreen) setIsFullscreen(false)
      }
      if (e.key === 'e' || e.key === 'E') {
        setBuildMode(prev => !prev)
      }
      if (e.key === 'f' || e.key === 'F') {
        setIsFullscreen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [buildMode, isFullscreen])

  // csv drag and drop
  useEffect(() => {
    let dragCounter = 0

    const handleDragEnter = (e) => {
      e.preventDefault()
      dragCounter++
      if (e.dataTransfer.types.includes('Files')) {
        setIsDraggingCsv(true)
      }
    }

    const handleDragLeave = (e) => {
      e.preventDefault()
      dragCounter--
      if (dragCounter === 0) {
        setIsDraggingCsv(false)
      }
    }

    const handleDragOver = (e) => {
      e.preventDefault()
    }

    const handleDrop = (e) => {
      e.preventDefault()
      dragCounter = 0
      setIsDraggingCsv(false)

      const file = e.dataTransfer.files[0]
      if (file && file.name.endsWith('.csv')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const csvText = event.target.result
          // parse csv - simple parser for now
          const lines = csvText.split('\n').filter(l => l.trim())
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
          const transactions = lines.slice(1).map(line => {
            const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || []
            const obj = {}
            headers.forEach((h, i) => {
              obj[h] = values[i]?.replace(/"/g, '').trim() || ''
            })
            return obj
          }).filter(t => Object.keys(t).length > 0)

          localStorage.setItem('fincraft-transactions', JSON.stringify(transactions))
          setTransactions(transactions)
          // reload transaction pool in game engine
          if (gameRef.current) {
            gameRef.current.reloadTransactions()
          }
        }
        reader.readAsText(file)
      }
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [])

  const toggleAccordion = (key) => {
    setOpenAccordions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const addAccount = (category, hasApr = false) => {
    const newAccount = {
      id: generateId(),
      name: 'New Account',
      balance: 0,
      ...(hasApr && { apr: 0 })
    }
    setAccounts(prev => ({
      ...prev,
      [category]: [...prev[category], newAccount]
    }))
  }

  const updateAccount = (category, updated) => {
    setAccounts(prev => ({
      ...prev,
      [category]: prev[category].map(a => a.id === updated.id ? updated : a)
    }))
  }

  const deleteAccount = (category, id) => {
    setAccounts(prev => ({
      ...prev,
      [category]: prev[category].filter(a => a.id !== id)
    }))
  }

  const getTotal = (category) => {
    return accounts[category].reduce((sum, a) => sum + a.balance, 0)
  }

  const netWorth = getTotal('depository') + getTotal('investments') + getTotal('others')
  const totalDebt = getTotal('creditCards') + getTotal('loans')

  const timeViews = ['1W', '1M', '3M', 'YTD', '1Y']
  const speeds = [1, 1.5, 2]

  const pushEvent = (type, amount, targetId = null) => {
    if (gameRef.current) {
      gameRef.current.pushEvent({ type, amount, targetId })
    }
  }

  const toggleSimPanel = () => {
    const newVal = !showSimPanel
    setShowSimPanel(newVal)
    localStorage.setItem('fincraft-sim-panel', newVal.toString())
  }

  // get first debt account for quick test buttons
  const firstDebtAccount = accounts.creditCards[0] || accounts.loans[0]

  return (
    <div className="h-screen bg-[#0f0f1a] text-white p-4 flex flex-col overflow-hidden relative">
      {/* CSV Drop Overlay */}
      {isDraggingCsv && (
        <div className="absolute inset-0 z-50 bg-[#0f0f1a]/90 flex items-center justify-center pointer-events-none">
          <div className="border-2 border-dashed border-blue-500 rounded-2xl p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="text-xl font-bold text-blue-400">Drop CSV to import transactions</div>
            <div className="text-sm text-gray-500 mt-2">File will be stored for simulation playback</div>
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-h-0 w-full">

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Fullscreen Tab - shows when sidebar hidden */}
          {isFullscreen && (
            <div
              onClick={() => setIsFullscreen(false)}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-30 bg-[#1a1a2e] hover:bg-[#252542] border border-[#3a3a5e] border-l-0 rounded-r-lg px-1 py-4 cursor-pointer transition-all"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          )}

          {/* Control Panel */}
          <div className={`w-80 flex flex-col gap-3 flex-shrink-0 overflow-hidden relative transition-all duration-300 ${isFullscreen ? '-ml-80 opacity-0' : 'ml-0 opacity-100'}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="text-gray-400 hover:text-white p-1 cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <img
                  src="/assets/ui/fincraft.png"
                  alt="Fincraft"
                  className="h-6"
                  style={{ cursor: 'pointer' }}
                  onClick={() => window.location.reload()}
                />
              </div>
              <button
                disabled
                className="text-gray-600 p-1 opacity-50"
                title="Close (disabled)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Menu Backdrop */}
            <div
              className={`absolute top-12 left-0 right-0 bottom-0 bg-[#0f0f1a] rounded-lg z-[5] transition-opacity duration-200 ${menuOpen ? 'opacity-80' : 'opacity-0 pointer-events-none'}`}
              onClick={() => setMenuOpen(false)}
            />

            {/* Slide-in Menu */}
            <div className={`absolute top-[38px] left-0 right-0 bg-[#1a1a2e] rounded-lg z-20 p-2 transition-all duration-200 ${menuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
              <div
                onClick={() => { setPanelView('portfolio'); setMenuOpen(false) }}
                className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-[#252542] ${panelView === 'portfolio' ? 'text-blue-400' : 'text-gray-300'}`}
                style={{ cursor: 'pointer' }}
              >
                Portfolio
              </div>
              <div
                onClick={() => { setPanelView('transactions'); setMenuOpen(false) }}
                className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-[#252542] ${panelView === 'transactions' ? 'text-blue-400' : 'text-gray-300'}`}
                style={{ cursor: 'pointer' }}
              >
                Transactions {transactionCount > 0 && <span className="text-gray-500 ml-1">({transactionCount})</span>}
              </div>
            </div>

            {/* Portfolio View */}
            <div className={`flex-1 flex flex-col gap-3 overflow-hidden ${panelView === 'portfolio' ? '' : 'opacity-0 absolute pointer-events-none'}`}>
              {/* Accordions */}
              <div className="flex-1 overflow-y-auto space-y-2">
              {/* Depository */}
              <Accordion
                title="DEPOSITORY"
                isOpen={openAccordions.depository}
                onToggle={() => toggleAccordion('depository')}
                total={getTotal('depository')}
              >
                {accounts.depository.map(item => (
                  <LineItem
                    key={item.id}
                    item={item}
                    onUpdate={(u) => updateAccount('depository', u)}
                    onDelete={(id) => deleteAccount('depository', id)}
                  />
                ))}
                <button
                  onClick={() => addAccount('depository')}
                  className="text-xs text-blue-400 hover:text-blue-300 mt-2"
                >
                  + Add Account
                </button>
              </Accordion>

              {/* Investments */}
              <Accordion
                title="INVESTMENTS"
                isOpen={openAccordions.investments}
                onToggle={() => toggleAccordion('investments')}
                total={getTotal('investments')}
              >
                {accounts.investments.map(item => (
                  <LineItem
                    key={item.id}
                    item={item}
                    onUpdate={(u) => updateAccount('investments', u)}
                    onDelete={(id) => deleteAccount('investments', id)}
                  />
                ))}
                <button
                  onClick={() => addAccount('investments')}
                  className="text-xs text-blue-400 hover:text-blue-300 mt-2"
                >
                  + Add Account
                </button>
              </Accordion>

              {/* Credit Cards */}
              <Accordion
                title="CREDIT CARDS"
                isOpen={openAccordions.creditCards}
                onToggle={() => toggleAccordion('creditCards')}
                total={getTotal('creditCards')}
                isDebt
              >
                {accounts.creditCards.map(item => (
                  <LineItem
                    key={item.id}
                    item={item}
                    onUpdate={(u) => updateAccount('creditCards', u)}
                    onDelete={(id) => deleteAccount('creditCards', id)}
                    showApr
                  />
                ))}
                <button
                  onClick={() => addAccount('creditCards', true)}
                  className="text-xs text-blue-400 hover:text-blue-300 mt-2"
                >
                  + Add Card
                </button>
              </Accordion>

              {/* Loans */}
              <Accordion
                title="LOANS"
                isOpen={openAccordions.loans}
                onToggle={() => toggleAccordion('loans')}
                total={getTotal('loans')}
                isDebt
              >
                {accounts.loans.map(item => (
                  <LineItem
                    key={item.id}
                    item={item}
                    onUpdate={(u) => updateAccount('loans', u)}
                    onDelete={(id) => deleteAccount('loans', id)}
                    showApr
                  />
                ))}
                <button
                  onClick={() => addAccount('loans', true)}
                  className="text-xs text-blue-400 hover:text-blue-300 mt-2"
                >
                  + Add Loan
                </button>
              </Accordion>

              {/* Others */}
              <Accordion
                title="ASSETS"
                isOpen={openAccordions.others}
                onToggle={() => toggleAccordion('others')}
                total={getTotal('others')}
                isDebt={getTotal('others') < 0}
              >
                {accounts.others.map(item => (
                  <LineItem
                    key={item.id}
                    item={item}
                    onUpdate={(u) => updateAccount('others', u)}
                    onDelete={(id) => deleteAccount('others', id)}
                  />
                ))}
                <button
                  onClick={() => addAccount('others')}
                  className="text-xs text-blue-400 hover:text-blue-300 mt-2"
                >
                  + Add Item
                </button>
              </Accordion>
              </div>

              {/* Summary */}
              <div className="bg-[#1a1a2e] rounded-lg p-3 flex-shrink-0">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Net Worth</span>
                  <span className="text-green-400 font-bold">${netWorth.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Total Debt</span>
                  <span className="text-red-400 font-bold">${totalDebt.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-[#2a2a4e] pt-2 mt-2">
                  <span className="text-gray-500">Transactions</span>
                  <span className="text-gray-500">{transactionCount > 0 ? `${transactionCount} Loaded` : 'Drop CSV'}</span>
                </div>
              </div>

            </div>

            {/* Transactions View */}
            <div className={`flex-1 flex flex-col gap-3 overflow-hidden ${panelView === 'transactions' ? '' : 'opacity-0 absolute pointer-events-none'}`}>
              {/* Date Filter */}
              <div className="flex gap-1">
                {[['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This Week'], ['month', 'This Month']].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setDateFilter(key)}
                    className={`flex-1 text-xs py-1.5 rounded font-bold cursor-pointer transition ${
                      dateFilter === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#252542] text-gray-400 hover:bg-[#2a2a4e]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Transaction List */}
              <div className="flex-1 overflow-y-auto space-y-1">
                {transactions.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-8">
                    Drop a CSV file to import transactions
                  </div>
                ) : (
                  transactions
                    .filter(t => {
                      const dateField = t.Date || t.date || t.DATE || Object.values(t)[0]
                      if (!dateField) return true
                      const txDate = new Date(dateField)
                      const now = new Date()
                      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

                      if (dateFilter === 'today') {
                        return txDate >= today
                      } else if (dateFilter === 'yesterday') {
                        return txDate >= yesterday && txDate < today
                      } else if (dateFilter === 'week') {
                        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
                        return txDate >= weekAgo
                      } else if (dateFilter === 'month') {
                        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
                        return txDate >= monthAgo
                      }
                      return true
                    })
                    .map((t, i) => {
                      const amount = parseFloat(t.Amount || t.amount || t.AMOUNT || 0)
                      const desc = t.Description || t.description || t.Name || t.name || t.Merchant || t.merchant || Object.values(t)[1] || ''
                      const date = t.Date || t.date || t.DATE || Object.values(t)[0] || ''
                      const isExpense = amount < 0
                      return (
                        <div key={i} className="bg-[#1a1a2e] rounded px-3 py-2 flex justify-between items-center">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-300 truncate">{desc}</div>
                            <div className="text-xs text-gray-500">{date}</div>
                          </div>
                          <div className={`text-xs font-mono font-bold ${isExpense ? 'text-green-400' : 'text-red-400'}`}>
                            {isExpense ? '+' : '-'}{Math.abs(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            </div>
          </div>

          {/* Game Canvas */}
          <div className="relative flex-1 min-h-0 min-w-0">
            <div
              ref={gameContainerRef}
              className="rounded-lg overflow-hidden border-2 border-[#2a2a4e] w-full h-full"
            />
            <button
              onClick={() => setBuildMode(!buildMode)}
              className={`absolute top-2 right-2 text-xs px-3 py-1.5 rounded font-bold transition ${
                buildMode
                  ? 'bg-orange-600 text-white'
                  : 'bg-[#1a1a2e] text-gray-400 hover:bg-[#2a2a4e] border border-[#3a3a5e]'
              }`}
            >
              {buildMode ? 'EXIT EDIT' : 'EDIT'}
            </button>

            {/* Top Left Controls */}
            <div className="absolute top-2 left-2 flex gap-1">
              {/* Fullscreen Toggle */}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="text-xs px-2 py-1 rounded bg-[#1a1a2e] text-gray-500 hover:text-gray-300 border border-[#3a3a5e]"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0v5m0-5h5m6 6l5 5m0 0v-5m0 5h-5M9 15l-5 5m0 0h5m-5 0v-5m11-6l5-5m0 0h-5m5 0v5" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5" />
                  </svg>
                )}
              </button>

              {/* Sim Panel Toggle */}
              <button
                onClick={toggleSimPanel}
                className="text-xs px-2 py-1 rounded bg-[#1a1a2e] text-gray-500 hover:text-gray-300 border border-[#3a3a5e]"
              >
                SIM
              </button>
            </div>

            {/* Sim Panel */}
            {showSimPanel && (
              <div className="absolute bottom-2 left-2 bg-[#1a1a2e]/95 border border-[#3a3a5e] rounded-lg p-2 text-xs">
                <div
                  className="flex items-center justify-between cursor-pointer mb-2"
                  onClick={() => setSimPanelCollapsed(!simPanelCollapsed)}
                >
                  <span className="font-bold text-gray-400">SIM PANEL</span>
                  <span className="text-gray-500">{simPanelCollapsed ? '▶' : '▼'}</span>
                </div>

                {!simPanelCollapsed && (
                  <div className="space-y-2">
                    {/* Expenses */}
                    <div>
                      <div className="text-gray-500 mb-1">Expenses</div>
                      <div className="flex gap-1 flex-wrap">
                        <button
                          onClick={() => pushEvent('expense', 25)}
                          className="px-2 py-1 bg-red-900/50 hover:bg-red-800/50 rounded text-red-300"
                        >
                          Gas $25
                        </button>
                        <button
                          onClick={() => pushEvent('expense', 50)}
                          className="px-2 py-1 bg-red-900/50 hover:bg-red-800/50 rounded text-red-300"
                        >
                          Food $50
                        </button>
                        <button
                          onClick={() => pushEvent('expense', 1500)}
                          className="px-2 py-1 bg-red-900/50 hover:bg-red-800/50 rounded text-red-300"
                        >
                          Rent $1500
                        </button>
                      </div>
                    </div>

                    {/* Debt Payments */}
                    {firstDebtAccount && (
                      <div>
                        <div className="text-gray-500 mb-1">Debt Payments</div>
                        <div className="flex gap-1 flex-wrap">
                          <button
                            onClick={() => pushEvent('debt-payment', 100, firstDebtAccount.id)}
                            className="px-2 py-1 bg-green-900/50 hover:bg-green-800/50 rounded text-green-300"
                          >
                            $100
                          </button>
                          <button
                            onClick={() => pushEvent('debt-payment', 500, firstDebtAccount.id)}
                            className="px-2 py-1 bg-green-900/50 hover:bg-green-800/50 rounded text-green-300"
                          >
                            $500
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Custom */}
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        placeholder="$"
                        className="w-16 px-2 py-1 bg-[#0f0f1a] rounded border border-[#3a3a5e] text-white"
                      />
                      <button
                        onClick={() => {
                          const amt = parseFloat(customAmount)
                          if (amt > 0) {
                            pushEvent('expense', amt)
                            setCustomAmount('')
                          }
                        }}
                        className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
