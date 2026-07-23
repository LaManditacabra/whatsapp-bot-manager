import { useState, useEffect, useCallback } from 'react'
import { api, setToken, getToken } from './api'
import Auth from './components/Auth'
import Sidebar from './components/Sidebar'
import BotList from './components/BotList'
import BotDetail from './components/BotDetail'
import Users from './components/Users'
import GlobalSettings from './components/GlobalSettings'
import Plans from './components/Plans'
import StatsView from './components/StatsView'
import ExtrasView from './components/ExtrasView'
import StockView from './components/StockView'
import OrdersView from './components/OrdersView'
import Support from './components/Support'
import LoadingOverlay from './components/LoadingOverlay'
import ClientModal from './components/ClientModal'
import ProductModal from './components/ProductModal'
import KeywordModal from './components/KeywordModal'
import TicketModal from './components/TicketModal'

import HiddenTriggers from './components/hidden-triggers'
import TourGuide from './components/TourGuide'

export default function App() {
  const [user, setUser] = useState(null)
  const [view, setView] = useState('clients')
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('Cargando...')

  const [currentClientId, setCurrentClientId] = useState(null)
  const [showWelcome, setShowWelcome] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [highlightOrder, setHighlightOrder] = useState(null) // { clientId, orderId }

  const showLoading = useCallback((text) => {
    setLoadingText(text || 'Cargando...')
    setLoading(true)
  }, [])

  const hideLoading = useCallback(() => setLoading(false), [])

  function handleNavigateOrder(clientId, orderId) {
    setHighlightOrder({ clientId, orderId })
    setView('orders')
    setSidebarOpen(false)
  }

  useEffect(() => {
    const t = getToken()
    if (t) {
      api('/api/auth/me')
        .then(u => {
          setUser(u)
          api('/api/clients').then(clients => {
            if (clients.length === 0 && !localStorage.getItem('botar_welcome_done')) {
              setShowWelcome(true)
            }
          }).catch(() => {})
        })
        .catch(() => { setToken(null); setUser(null) })
    }
  }, [])

  const handleLogout = useCallback(() => {
    setToken(null)
    setUser(null)
    setCurrentClientId(null)
  }, [])

  if (!user) return <Auth onLogin={u => { setUser(u); setView('clients') }} showLoading={showLoading} hideLoading={hideLoading} />

  return (
    <div className="flex h-screen">
      <Sidebar user={user} view={view} onView={v => { setView(v); setSidebarOpen(false); if (v !== 'support') setCurrentClientId(null) }} onLogout={handleLogout} sidebarOpen={sidebarOpen} onToggle={() => setSidebarOpen(s => !s)} onNavigateOrder={handleNavigateOrder} />
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {view === 'clients' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-600 hover:text-gray-800 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <h2 className="text-lg font-semibold text-gray-800">Mis Bots</h2>
              </div>
              <button id="createBotBtn" data-tour="createBotBtn" onClick={() => document.getElementById('clientModalTrigger').click()} className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 text-sm font-medium transition-all shadow-sm hover:shadow-md flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                Nuevo Bot
              </button>
            </div>
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
              <div className={`${currentClientId && 'hidden'} md:block md:w-auto flex-1 md:flex-initial`}>
                <BotList user={user} currentClientId={currentClientId} onSelect={setCurrentClientId} showLoading={showLoading} hideLoading={hideLoading} onShowTour={() => setShowWelcome(true)} />
              </div>
              <div className={`${!currentClientId && 'hidden'} md:block flex-1 min-h-0 overflow-y-auto`}>
                <BotDetail user={user} clientId={currentClientId} onBack={() => setCurrentClientId(null)} showLoading={showLoading} hideLoading={hideLoading} />
              </div>
            </div>
          </div>
        )}
        {view !== 'clients' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center shadow-sm">
              <button onClick={() => setSidebarOpen(true)} className="text-gray-600 hover:text-gray-800 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {view === 'users' && <Users showLoading={showLoading} hideLoading={hideLoading} />}
              {view === 'settings' && <GlobalSettings showLoading={showLoading} hideLoading={hideLoading} />}
              {view === 'plans' && <Plans user={user} showLoading={showLoading} hideLoading={hideLoading} />}
              {view === 'stats' && <StatsView user={user} showLoading={showLoading} hideLoading={hideLoading} />}
              {view === 'extras' && <ExtrasView user={user} showLoading={showLoading} hideLoading={hideLoading} />}
              {view === 'stock' && <StockView user={user} showLoading={showLoading} hideLoading={hideLoading} />}
              {view === 'orders' && <OrdersView user={user} highlightOrder={highlightOrder} onClearHighlight={() => setHighlightOrder(null)} />}
              {view === 'support' && <Support user={user} showLoading={showLoading} hideLoading={hideLoading} />}
            </div>
          </div>
        )}
      </main>

      <ClientModal user={user} onSaved={(id) => { setCurrentClientId(id); setView('clients') }} showLoading={showLoading} hideLoading={hideLoading} />
      <ProductModal showLoading={showLoading} hideLoading={hideLoading} />
      <KeywordModal showLoading={showLoading} hideLoading={hideLoading} />
      <TicketModal user={user} showLoading={showLoading} hideLoading={hideLoading} />
      <LoadingOverlay text={loadingText} visible={loading} />
      <HiddenTriggers />
      {showWelcome && <TourGuide onClose={() => setShowWelcome(false)} />}
    </div>
  )
}
