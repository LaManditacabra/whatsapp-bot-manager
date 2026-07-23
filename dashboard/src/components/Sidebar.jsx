import { useState, useEffect, useRef } from 'react'
import { api } from '../api.js'

export default function Sidebar({ user, view, onView, onLogout, sidebarOpen, onToggle, onNavigateOrder }) {
  const [platformsOpen, setPlatformsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notifUnread, setNotifUnread] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifTimer = useRef(null)
  const notifRef = useRef(null)

  useEffect(() => {
    async function fetchNotifs() {
      try {
        const d = await api('/api/notifications?limit=10')
        setNotifications(d.notifications || [])
        setNotifUnread(d.unread || 0)
      } catch {}
    }
    fetchNotifs()
    notifTimer.current = setInterval(fetchNotifs, 30000)
    return () => { if (notifTimer.current) clearInterval(notifTimer.current) }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function markRead() {
    try { await api('/api/notifications/read', { method: 'PUT' }); setNotifUnread(0) } catch {}
  }

  function handleNotifClick() {
    if (notifOpen) { setNotifOpen(false); return }
    setNotifOpen(true)
    markRead()
  }

  function handleNotifNavigate(n) {
    setNotifOpen(false)
    try {
      const data = JSON.parse(n.data || '{}')
      if (onNavigateOrder && data.clientId && data.orderId) {
        onNavigateOrder(data.clientId, data.orderId)
      } else {
        onView('orders')
      }
    } catch { onView('orders') }
  }

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={onToggle} />
      )}
      <aside className={`fixed md:relative inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-blue-800 to-blue-900 text-white flex flex-col shadow-xl transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="px-5 py-3 md:py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="BotAr" className="w-8 h-8" />
            <div className="flex-1">
              <h1 className="text-lg font-bold tracking-tight leading-none">BotAr</h1>
              <button onClick={() => setPlatformsOpen(!platformsOpen)}
                className="flex items-center gap-1 text-[10px] text-white/40 font-medium uppercase tracking-widest mt-0.5 hover:text-white/60 transition-colors">
                Plataformas
                <svg className={`w-3 h-3 transition-transform duration-200 ${platformsOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            <div className="relative" ref={notifRef}>
              <button onClick={handleNotifClick} className="text-white/50 hover:text-white transition-colors p-1 relative" title="Notificaciones">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notifUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center shadow">
                    {notifUnread > 9 ? '9+' : notifUnread}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="fixed md:absolute right-4 md:right-auto md:left-full md:ml-2 top-16 md:top-auto md:mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-[100] max-h-96 overflow-y-auto">
                  <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-xl">
                    <span className="text-sm font-semibold text-gray-700">Notificaciones</span>
                    <span className="text-xs text-gray-400">{notifications.length}</span>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-8">Sin notificaciones</p>
                  ) : notifications.map(n => (
                    <button key={n.id} onClick={() => handleNotifNavigate(n)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors ${!n.read ? 'bg-blue-50/70' : ''}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-base mt-0.5 shrink-0">{n.type === 'order' ? '🛵' : n.type === 'ticket' ? '🎫' : '🔔'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">{n.title}</p>
                          <p className="text-xs text-gray-500 truncate">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at + 'Z').toLocaleString('es-AR')}</p>
                        </div>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button onClick={onToggle} className="md:hidden text-white/60 hover:text-white p-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-4 pt-1 pb-4">
          <div className="flex items-center gap-3 bg-white/[0.06] rounded-xl px-3 py-2.5 border border-white/5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-base shrink-0">
              {(user.name || user.email || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.name || 'Usuario'}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[10px] text-white/40 truncate">{user.email}</p>
                <span className="text-[8px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                  {user.plan === 'free' ? 'Gratis' : user.plan === 'premium' ? 'Premium' : 'Ilimitado'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {platformsOpen && (
          <div className="border-b border-white/10 px-3 py-2 space-y-1">
            <button onClick={() => { onView('clients'); onToggle() }}
              className="w-full text-left px-3 py-2 rounded-xl bg-white/10 text-white flex items-center gap-2.5 text-sm font-medium transition-all duration-200">
              <span className="text-base">💬</span> WhatsApp Bot
            </button>
            {['📸', '🎵', '👍'].map((icon, i) => (
              <button key={i} disabled
                className="w-full text-left px-3 py-2 rounded-xl text-white/30 flex items-center gap-2.5 text-sm font-medium cursor-not-allowed">
                <span className="text-base opacity-50">{icon}</span>
                {['Instagram Bot', 'TikTok Bot', 'Facebook Bot'][i]}
                <span className="ml-auto text-[9px] bg-white/10 px-1.5 py-0.5 rounded">Pronto</span>
              </button>
            ))}
          </div>
        )}

        <nav className="flex-1 p-3 space-y-1">
          <NavBtn icon="📱" label="Mis Bots" active={view === 'clients'} onClick={() => { onView('clients'); onToggle() }} />
          {user.role === 'admin' && (
            <div className="space-y-1 pt-2 border-t border-white/10">
              <NavBtn icon="👥" label="Usuarios" active={view === 'users'} onClick={() => { onView('users'); onToggle() }} />
              <NavBtn icon="⚙️" label="Configuración" active={view === 'settings'} onClick={() => { onView('settings'); onToggle() }} />
            </div>
          )}
          <NavBtn icon="💎" label="Planes" active={view === 'plans'} onClick={() => { onView('plans'); onToggle() }} />
          <NavBtn icon="⚡" label="Funciones" active={view === 'extras'} onClick={() => { onView('extras'); onToggle() }} />
          <NavBtn icon="📦" label="Stock" active={view === 'stock'} onClick={() => { onView('stock'); onToggle() }} />
          <NavBtn icon="🛵" label="Pedidos" active={view === 'orders'} onClick={() => { onView('orders'); onToggle() }} />
          <NavBtn icon="📊" label="Estadísticas" active={view === 'stats'} onClick={() => { onView('stats'); onToggle() }} />
          <NavBtn icon="🎫" label="Soporte" active={view === 'support'} onClick={() => { onView('support'); onToggle() }} />
        </nav>

        <div className="p-4 border-t border-white/10 text-sm">
          <p className="text-white/50">Plan: {user.plan}</p>
          <button onClick={onLogout}
            className="text-red-300 hover:text-red-200 mt-1.5 text-sm font-medium transition-colors">
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}

function NavBtn({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-3 text-sm font-medium ${active ? 'bg-white/10' : 'hover:bg-white/10'}`}>
      <span className="text-lg">{icon}</span> {label}
    </button>
  )
}
