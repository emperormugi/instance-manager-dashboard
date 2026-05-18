import { useEffect, useMemo, useState } from 'react'
import { INITIAL_ACCOUNTS, INITIAL_LOGS, NAV_ITEMS, STATE_META } from './data.js'

function nowTime() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function createLog(level, text) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    time: nowTime(),
    level,
    text
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function StatusBadge({ state }) {
  const meta = STATE_META[state] || { label: state, tone: 'neutral' }
  return <span className={`status-badge ${meta.tone}`}>{meta.label}</span>
}

function StatCard({ label, value, detail, tone }) {
  return (
    <article className={`stat-card ${tone || ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function SectionHeader({ title, description, action }) {
  return (
    <div className="section-header">
      <div>
        <p className="eyebrow">Simulation mode</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

function ProgressBar({ value, label }) {
  return (
    <div className="progress-row">
      <div>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="progress-track">
        <span style={{ width: `${clamp(value, 0, 100)}%` }} />
      </div>
    </div>
  )
}

export default function App() {
  const [activePage, setActivePage] = useState('overview')
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS)
  const [logs, setLogs] = useState(INITIAL_LOGS.map(item => createLog(item.level, item.text)))
  const [inviteLink, setInviteLink] = useState('https://roblox.local/safe-demo-crew-invite')
  const [queue, setQueue] = useState([
    { id: 'Q-101', action: 'Readiness scan', status: 'Complete', accounts: 24 },
    { id: 'Q-102', action: 'Invite tracking sync', status: 'Running', accounts: 14 }
  ])
  const [settings, setSettings] = useState({
    simulationUpdates: true,
    retryFailed: true,
    lowResourceMode: true,
    logVerbose: true
  })

  const addLog = (level, text) => {
    setLogs(current => [createLog(level, text), ...current].slice(0, 80))
  }

  const selectedAccounts = useMemo(() => accounts.filter(account => account.selected), [accounts])
  const stats = useMemo(() => {
    const count = state => accounts.filter(account => account.status === state).length
    const active = accounts.filter(account => account.status !== 'OFFLINE').length
    const avgCpu = Math.round(accounts.reduce((sum, account) => sum + account.cpu, 0) / accounts.length)
    const avgMemory = Math.round(accounts.reduce((sum, account) => sum + account.memory, 0) / accounts.length)
    const serverGroups = new Set(accounts.map(account => account.serverGroup)).size

    return {
      active,
      ready: count('READY'),
      failed: count('FAILED'),
      joined: count('JOINED'),
      queue: queue.filter(item => item.status !== 'Complete').length,
      serverGroups,
      health: count('FAILED') > 4 ? 'Attention' : 'Stable',
      avgCpu,
      avgMemory
    }
  }, [accounts, queue])

  useEffect(() => {
    if (!settings.simulationUpdates) return undefined

    const timer = window.setInterval(() => {
      setAccounts(current => {
        const copy = current.map(account => ({ ...account }))
        const index = Math.floor(Math.random() * copy.length)
        const account = copy[index]

        if (['JOINING', 'JOINED'].includes(account.status)) return copy

        const drift = Math.random()
        account.ping = clamp(account.ping + Math.round(Math.random() * 20 - 10), 20, 180)
        account.fps = clamp(account.fps + Math.round(Math.random() * 6 - 3), 12, 45)
        account.cpu = clamp(account.cpu + Math.round(Math.random() * 8 - 4), 2, 35)
        account.memory = clamp(account.memory + Math.round(Math.random() * 80 - 40), 300, 950)

        if (drift > 0.86 && account.status === 'IN_SERVER') {
          account.status = 'INVITE_PENDING'
          account.lastEvent = 'Invite detected by simulation tick'
        } else if (drift > 0.9 && account.status === 'INVITE_PENDING') {
          account.status = 'READY'
          account.selected = true
          account.lastEvent = 'Marked ready for synchronized join'
        } else if (drift > 0.94 && account.status === 'FAILED') {
          account.status = 'RECOVERING'
          account.lastEvent = 'Recovery workflow started'
        } else if (drift > 0.96 && account.status === 'RECOVERING') {
          account.status = 'IN_SERVER'
          account.lastEvent = 'Recovered into server'
        }

        return copy
      })
    }, 2500)

    return () => window.clearInterval(timer)
  }, [settings.simulationUpdates])

  function toggleAccount(id) {
    setAccounts(current => current.map(account => {
      if (account.id !== id) return account
      return { ...account, selected: !account.selected }
    }))
  }

  function selectReadyAccounts() {
    setAccounts(current => current.map(account => ({
      ...account,
      selected: ['READY', 'INVITE_PENDING'].includes(account.status)
    })))
    addLog('info', 'Selected all ready and invite pending accounts')
  }

  function clearSelection() {
    setAccounts(current => current.map(account => ({ ...account, selected: false })))
    addLog('info', 'Cleared account selection')
  }

  function bootOfflineAccounts() {
    setAccounts(current => current.map(account => {
      if (account.status !== 'OFFLINE') return account
      return {
        ...account,
        status: 'BOOTING',
        lastEvent: 'Manual boot simulation started'
      }
    }))
    addLog('info', 'Started boot simulation for offline accounts')
  }

  function retryFailedAccounts() {
    setAccounts(current => current.map(account => {
      if (account.status !== 'FAILED') return account
      return {
        ...account,
        status: 'RECOVERING',
        lastEvent: 'Manual recovery simulation started'
      }
    }))
    addLog('warn', 'Retry simulation triggered for failed accounts')
  }

  function joinCrew() {
    const runnableIds = selectedAccounts
      .filter(account => ['READY', 'INVITE_PENDING', 'IN_SERVER'].includes(account.status))
      .map(account => account.id)

    if (!inviteLink.trim()) {
      addLog('error', 'Crew invite link is empty')
      return
    }

    if (runnableIds.length === 0) {
      addLog('error', 'No selected accounts are ready for the join simulation')
      return
    }

    const queueItem = {
      id: `Q-${Math.floor(100 + Math.random() * 900)}`,
      action: 'Synchronized crew join simulation',
      status: 'Running',
      accounts: runnableIds.length
    }

    setQueue(current => [queueItem, ...current])
    setAccounts(current => current.map(account => {
      if (!runnableIds.includes(account.id)) return account
      return {
        ...account,
        status: 'JOINING',
        lastEvent: 'Broadcast received from dashboard simulation'
      }
    }))
    addLog('info', `Broadcasted simulated Join Crew event to ${runnableIds.length} selected accounts`)

    window.setTimeout(() => {
      setAccounts(current => current.map(account => {
        if (!runnableIds.includes(account.id)) return account
        const success = Math.random() > 0.13
        return {
          ...account,
          status: success ? 'JOINED' : 'FAILED',
          selected: false,
          lastEvent: success ? 'Join confirmed in simulation' : 'Join failed in simulation'
        }
      }))
      setQueue(current => current.map(item => item.id === queueItem.id ? { ...item, status: 'Complete' } : item))
      addLog('info', 'Synchronized join simulation completed with success and failure reporting')
    }, 1400)
  }

  const serverGroups = useMemo(() => {
    return ['Alpha', 'Bravo', 'Charlie', 'Delta'].map(group => {
      const groupAccounts = accounts.filter(account => account.serverGroup === group)
      return {
        group,
        total: groupAccounts.length,
        ready: groupAccounts.filter(account => account.status === 'READY').length,
        joined: groupAccounts.filter(account => account.status === 'JOINED').length,
        failed: groupAccounts.filter(account => account.status === 'FAILED').length,
        avgPing: Math.round(groupAccounts.reduce((sum, account) => sum + account.ping, 0) / groupAccounts.length)
      }
    })
  }, [accounts])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">IM</div>
          <div>
            <h1>Instance Manager</h1>
            <p>Local MVP dashboard</p>
          </div>
        </div>

        <nav className="nav-list" aria-label="Main navigation">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={activePage === item.id ? 'active' : ''}
              onClick={() => setActivePage(item.id)}
              type="button"
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <span className="pulse-dot" />
          <div>
            <strong>Safe simulation</strong>
            <p>No exploit code, no credential capture, no backend control yet.</p>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Today MVP target</p>
            <h2>Roblox multi instance coordination dashboard</h2>
          </div>
          <div className="topbar-actions">
            <button type="button" className="ghost-button" onClick={retryFailedAccounts}>Retry failed</button>
            <button type="button" className="primary-button" onClick={() => setActivePage('crew')}>Open join control</button>
          </div>
        </header>

        <section className="mobile-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={activePage === item.id ? 'active' : ''}
              onClick={() => setActivePage(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </section>

        {activePage === 'overview' && (
          <div className="page-stack">
            <SectionHeader
              title="Overview dashboard"
              description="Live local simulation of account states, crew readiness, queue activity, and system health."
              action={<button type="button" className="primary-button" onClick={joinCrew}>Join Crew</button>}
            />

            <div className="stats-grid">
              <StatCard label="Active instances" value={stats.active} detail="non offline accounts" tone="blue" />
              <StatCard label="Ready accounts" value={stats.ready} detail="selected or ready to join" tone="green" />
              <StatCard label="Failed accounts" value={stats.failed} detail="need recovery" tone="red" />
              <StatCard label="Joined accounts" value={stats.joined} detail="successful simulation" tone="purple" />
              <StatCard label="Queue status" value={stats.queue} detail="active queue items" tone="amber" />
              <StatCard label="Server groups" value={stats.serverGroups} detail="coordination groups" tone="blue" />
              <StatCard label="System health" value={stats.health} detail="local dashboard status" tone="green" />
            </div>

            <div className="two-column-grid">
              <CrewControl
                inviteLink={inviteLink}
                setInviteLink={setInviteLink}
                selectedAccounts={selectedAccounts}
                selectReadyAccounts={selectReadyAccounts}
                clearSelection={clearSelection}
                joinCrew={joinCrew}
              />
              <PerformanceSummary stats={stats} accounts={accounts} />
            </div>

            <AccountTable accounts={accounts.slice(0, 10)} toggleAccount={toggleAccount} compact />
          </div>
        )}

        {activePage === 'instances' && (
          <div className="page-stack">
            <SectionHeader
              title="Account instances"
              description="Track each local instance state, selected status, telemetry, server group, and last event."
              action={
                <div className="action-row">
                  <button type="button" className="ghost-button" onClick={bootOfflineAccounts}>Boot offline</button>
                  <button type="button" className="ghost-button" onClick={selectReadyAccounts}>Select ready</button>
                </div>
              }
            />
            <AccountTable accounts={accounts} toggleAccount={toggleAccount} />
          </div>
        )}

        {activePage === 'crew' && (
          <div className="page-stack">
            <SectionHeader
              title="Crew invite coordination"
              description="This panel safely simulates centralized event broadcasting and synchronized account state updates."
            />
            <div className="two-column-grid wide-left">
              <CrewControl
                inviteLink={inviteLink}
                setInviteLink={setInviteLink}
                selectedAccounts={selectedAccounts}
                selectReadyAccounts={selectReadyAccounts}
                clearSelection={clearSelection}
                joinCrew={joinCrew}
              />
              <SelectedAccounts accounts={accounts} toggleAccount={toggleAccount} />
            </div>
          </div>
        )}

        {activePage === 'servers' && (
          <div className="page-stack">
            <SectionHeader
              title="Server coordination"
              description="Group accounts by server cluster so the later backend can coordinate invite readiness by server."
            />
            <div className="server-grid">
              {serverGroups.map(group => (
                <article className="server-card" key={group.group}>
                  <div className="server-card-header">
                    <h3>Server group {group.group}</h3>
                    <span>{group.avgPing} ms avg</span>
                  </div>
                  <div className="mini-stats">
                    <span><strong>{group.total}</strong>Total</span>
                    <span><strong>{group.ready}</strong>Ready</span>
                    <span><strong>{group.joined}</strong>Joined</span>
                    <span><strong>{group.failed}</strong>Failed</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {activePage === 'queue' && (
          <div className="page-stack">
            <SectionHeader
              title="Queue management"
              description="Command queue preview for synchronized actions, retries, readiness scans, and future websocket dispatches."
              action={<button type="button" className="primary-button" onClick={joinCrew}>Add join job</button>}
            />
            <div className="queue-list">
              {queue.map(item => (
                <article className="queue-item" key={item.id}>
                  <div>
                    <strong>{item.action}</strong>
                    <p>{item.id} · {item.accounts} accounts</p>
                  </div>
                  <span className={item.status === 'Complete' ? 'queue-done' : 'queue-running'}>{item.status}</span>
                </article>
              ))}
            </div>
          </div>
        )}

        {activePage === 'performance' && (
          <div className="page-stack">
            <SectionHeader
              title="Performance panel"
              description="Local telemetry preview for CPU, memory, FPS caps, ping, and low resource settings."
            />
            <div className="two-column-grid">
              <PerformanceSummary stats={stats} accounts={accounts} />
              <article className="panel-card">
                <h3>Optimization checklist</h3>
                <ul className="check-list">
                  <li>FPS target shown as dashboard data only</li>
                  <li>Process priority control is reserved for the desktop layer</li>
                  <li>Crash recovery is simulated until the backend agent exists</li>
                  <li>Telemetry interval is intentionally lightweight</li>
                </ul>
              </article>
            </div>
          </div>
        )}

        {activePage === 'logs' && (
          <div className="page-stack">
            <SectionHeader
              title="Logs"
              description="Readable local event stream for actions, simulated websocket updates, queue events, and safety notices."
              action={<button type="button" className="ghost-button" onClick={() => setLogs([])}>Clear logs</button>}
            />
            <LogsPanel logs={logs} />
          </div>
        )}

        {activePage === 'settings' && (
          <div className="page-stack">
            <SectionHeader
              title="Settings"
              description="Safe MVP controls. These settings only affect this local browser dashboard right now."
            />
            <SettingsPanel settings={settings} setSettings={setSettings} />
          </div>
        )}
      </main>
    </div>
  )
}

function CrewControl({ inviteLink, setInviteLink, selectedAccounts, selectReadyAccounts, clearSelection, joinCrew }) {
  return (
    <article className="panel-card crew-panel">
      <div className="panel-title-row">
        <div>
          <h3>Synchronized join control</h3>
          <p>Selected accounts receive a single simulated broadcast event.</p>
        </div>
        <span className="mode-pill">Safe UI demo</span>
      </div>

      <label className="field-label" htmlFor="invite-link">Crew invite link</label>
      <input
        id="invite-link"
        className="text-input"
        value={inviteLink}
        onChange={event => setInviteLink(event.target.value)}
        placeholder="Paste a demo invite link"
      />

      <div className="crew-summary-grid">
        <span><strong>{selectedAccounts.length}</strong> Selected</span>
        <span><strong>{selectedAccounts.filter(account => account.status === 'READY').length}</strong> Ready</span>
        <span><strong>{selectedAccounts.filter(account => account.status === 'INVITE_PENDING').length}</strong> Pending</span>
      </div>

      <div className="action-row wrap">
        <button type="button" className="primary-button large" onClick={joinCrew}>Join Crew</button>
        <button type="button" className="ghost-button" onClick={selectReadyAccounts}>Select ready</button>
        <button type="button" className="ghost-button" onClick={clearSelection}>Clear</button>
      </div>

      <p className="safety-note">
        This button updates UI states only. Real Roblox automation, credential handling, anti cheat bypassing, or exploit behavior is not included.
      </p>
    </article>
  )
}

function SelectedAccounts({ accounts, toggleAccount }) {
  return (
    <article className="panel-card">
      <h3>Selected accounts checklist</h3>
      <div className="checklist-panel">
        {accounts.map(account => (
          <label className="account-check" key={account.id}>
            <input
              type="checkbox"
              checked={account.selected}
              onChange={() => toggleAccount(account.id)}
            />
            <span>
              <strong>{account.username}</strong>
              <small>{account.id} · {account.serverGroup}</small>
            </span>
            <StatusBadge state={account.status} />
          </label>
        ))}
      </div>
    </article>
  )
}

function PerformanceSummary({ stats, accounts }) {
  const avgFps = Math.round(accounts.reduce((sum, account) => sum + account.fps, 0) / accounts.length)
  const avgPing = Math.round(accounts.reduce((sum, account) => sum + account.ping, 0) / accounts.length)

  return (
    <article className="panel-card">
      <h3>System health preview</h3>
      <div className="performance-grid">
        <ProgressBar label="Average CPU" value={stats.avgCpu} />
        <ProgressBar label="Memory pressure" value={Math.round((stats.avgMemory / 1000) * 100)} />
        <ProgressBar label="FPS target quality" value={clamp(Math.round((avgFps / 45) * 100), 10, 100)} />
        <ProgressBar label="Network quality" value={clamp(100 - Math.round(avgPing / 2), 5, 100)} />
      </div>
    </article>
  )
}

function AccountTable({ accounts, toggleAccount, compact }) {
  return (
    <article className="panel-card table-card">
      <div className="panel-title-row">
        <div>
          <h3>{compact ? 'Recent account states' : 'All account states'}</h3>
          <p>OFFLINE, BOOTING, IN_SERVER, INVITE_PENDING, READY, JOINING, JOINED, FAILED, RECOVERING</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Account</th>
              <th>Status</th>
              <th>Group</th>
              <th>Ping</th>
              <th>FPS</th>
              <th>CPU</th>
              <th>Memory</th>
              <th>Last event</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(account => (
              <tr key={account.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={account.selected}
                    onChange={() => toggleAccount(account.id)}
                    aria-label={`Select ${account.username}`}
                  />
                </td>
                <td>
                  <strong>{account.username}</strong>
                  <small>{account.id}</small>
                </td>
                <td><StatusBadge state={account.status} /></td>
                <td>{account.serverGroup}</td>
                <td>{account.ping} ms</td>
                <td>{account.fps}</td>
                <td>{account.cpu}%</td>
                <td>{account.memory} MB</td>
                <td>{account.lastEvent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}

function LogsPanel({ logs }) {
  return (
    <article className="panel-card logs-card">
      {logs.length === 0 ? (
        <p className="empty-state">No logs right now.</p>
      ) : logs.map(log => (
        <div className={`log-line ${log.level}`} key={log.id}>
          <span>{log.time}</span>
          <strong>{log.level.toUpperCase()}</strong>
          <p>{log.text}</p>
        </div>
      ))}
    </article>
  )
}

function SettingsPanel({ settings, setSettings }) {
  const options = [
    ['simulationUpdates', 'Simulated websocket style live updates', 'Random local status and telemetry changes every few seconds.'],
    ['retryFailed', 'Automatic retry preference', 'Stored now for the future backend recovery workflow.'],
    ['lowResourceMode', 'Low resource mode preference', 'Keeps the dashboard lightweight and reduces UI update noise.'],
    ['logVerbose', 'Verbose logs preference', 'Keeps more detail visible in the local logs panel.']
  ]

  return (
    <article className="panel-card settings-card">
      {options.map(([key, title, description]) => (
        <label className="setting-row" key={key}>
          <span>
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
          <input
            type="checkbox"
            checked={settings[key]}
            onChange={event => setSettings(current => ({ ...current, [key]: event.target.checked }))}
          />
        </label>
      ))}
    </article>
  )
}
