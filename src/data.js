export const ACCOUNT_STATES = [
  'OFFLINE',
  'BOOTING',
  'IN_SERVER',
  'INVITE_PENDING',
  'READY',
  'JOINING',
  'JOINED',
  'FAILED',
  'RECOVERING'
]

export const STATE_META = {
  OFFLINE: { label: 'Offline', tone: 'neutral' },
  BOOTING: { label: 'Booting', tone: 'info' },
  IN_SERVER: { label: 'In server', tone: 'info' },
  INVITE_PENDING: { label: 'Invite pending', tone: 'warn' },
  READY: { label: 'Ready', tone: 'good' },
  JOINING: { label: 'Joining', tone: 'active' },
  JOINED: { label: 'Joined', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  RECOVERING: { label: 'Recovering', tone: 'warn' }
}

export const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: '◈' },
  { id: 'instances', label: 'Instances', icon: '▦' },
  { id: 'crew', label: 'Crew Invite', icon: '◎' },
  { id: 'servers', label: 'Servers', icon: '◇' },
  { id: 'queue', label: 'Queue', icon: '▤' },
  { id: 'performance', label: 'Performance', icon: '▰' },
  { id: 'logs', label: 'Logs', icon: '≋' },
  { id: 'settings', label: 'Settings', icon: '⚙' }
]

export const INITIAL_ACCOUNTS = Array.from({ length: 24 }, (_, index) => {
  const states = [
    'READY',
    'READY',
    'INVITE_PENDING',
    'IN_SERVER',
    'JOINED',
    'FAILED',
    'RECOVERING',
    'BOOTING',
    'OFFLINE'
  ]

  const serverGroups = ['Alpha', 'Bravo', 'Charlie', 'Delta']
  const status = states[index % states.length]

  return {
    id: `ACC-${String(index + 1).padStart(2, '0')}`,
    username: `EmperorAlt${String(index + 1).padStart(2, '0')}`,
    status,
    serverGroup: serverGroups[index % serverGroups.length],
    serverId: `BF-${1000 + index}`,
    ping: 35 + ((index * 7) % 90),
    fps: 18 + ((index * 3) % 22),
    cpu: 4 + ((index * 5) % 17),
    memory: 380 + ((index * 41) % 440),
    selected: ['READY', 'INVITE_PENDING'].includes(status),
    lastEvent: status === 'READY' ? 'Invite received and ready' : 'Waiting for next sync tick'
  }
})

export const INITIAL_LOGS = [
  { level: 'info', text: 'Dashboard started in safe simulation mode' },
  { level: 'info', text: 'Live updates are local UI simulations until backend websocket is added' },
  { level: 'warn', text: 'Credential storage and game automation are disabled in this MVP' }
]
