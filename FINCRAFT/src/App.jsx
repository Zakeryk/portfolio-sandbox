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
        className="w-full flex items-center justify-between p-3 hover:bg-[#252542] transition"
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
  const [openAccordions, setOpenAccordions] = useState({
    depository: true,
    investments: false,
    creditCards: false,
    loans: false,
    others: false
  })

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
    }
  }, [accounts, timeView, playbackSpeed, buildMode])

  useEffect(() => {
    if (gameContainerRef.current && !gameRef.current) {
      const game = new GameEngine(gameContainerRef.current)
      game.init()
      game.setAccounts(accounts)
      game.setTimeView(timeView)
      game.setPlaybackSpeed(playbackSpeed)
      game.setBuildMode(buildMode)
      gameRef.current = game
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy()
        gameRef.current = null
      }
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

  return (
    <div className="h-screen bg-[#0f0f1a] text-white py-4 flex flex-col overflow-hidden">
      <div className="flex flex-col flex-1 min-h-0 w-full">

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Control Panel */}
          <div className="w-80 flex flex-col gap-3 flex-shrink-0 overflow-hidden">
            {/* Time View & Speed */}
            <div className="bg-[#1a1a2e] rounded-lg p-3">
              <div className="flex gap-1 mb-2">
                {timeViews.map(tv => (
                  <button
                    key={tv}
                    onClick={() => setTimeView(tv)}
                    className={`flex-1 text-xs py-1.5 rounded font-bold transition ${
                      timeView === tv
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#252542] text-gray-400 hover:bg-[#2a2a4e]'
                    }`}
                  >
                    {tv}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {speeds.map(s => (
                  <button
                    key={s}
                    onClick={() => setPlaybackSpeed(s)}
                    className={`flex-1 text-xs py-1 rounded transition ${
                      playbackSpeed === s
                        ? 'bg-green-600 text-white font-bold'
                        : 'bg-[#252542] text-gray-400 hover:bg-[#2a2a4e]'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

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
                title="OTHERS"
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
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Debt</span>
                <span className="text-red-400 font-bold">${totalDebt.toLocaleString()}</span>
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
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
