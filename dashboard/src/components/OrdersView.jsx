import { useState, useEffect, useRef } from 'react'
import { api } from '../api'

const STATUS_ICONS = { pending: '⏳', confirmed: '✅', completed: '✔️', cancelled: '❌' }
const STATUS_COLORS = { pending: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' }

export default function OrdersView({ user, highlightOrder, onClearHighlight }) {
  const [bots, setBots] = useState([])
  const [selectedBotId, setSelectedBotId] = useState('')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(null)
  const highlightRef = useRef(null)

  useEffect(() => {
    api('/api/clients').then(setBots).catch(() => {})
  }, [])

  // Auto-select bot when highlightOrder changes
  useEffect(() => {
    if (highlightOrder?.clientId) {
      setSelectedBotId(highlightOrder.clientId)
    }
  }, [highlightOrder])

  useEffect(() => {
    if (!selectedBotId) return
    setLoading(true)
    api(`/api/clients/${selectedBotId}/orders`).then(setOrders).catch(() => setOrders([])).finally(() => setLoading(false))
  }, [selectedBotId])

  // Scroll to highlighted order after orders load
  useEffect(() => {
    if (highlightOrder && orders.length > 0) {
      const el = document.getElementById(`order-${highlightOrder.orderId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('ring-2', 'ring-blue-400', 'bg-blue-50')
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-blue-400', 'bg-blue-50')
          if (onClearHighlight) onClearHighlight()
        }, 3000)
      }
    }
  }, [orders, highlightOrder])

  async function updateStatus(orderId, status) {
    setUpdating(orderId)
    try {
      await api(`/api/clients/${selectedBotId}/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
    } catch (e) { alert('Error: ' + e.message) }
    setUpdating(null)
  }

  const botOptions = bots.filter(b => b.user_id === user?.id || user?.role === 'admin')

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-5">🛵 Pedidos</h2>

      <div className="mb-6 max-w-xs">
        <select value={selectedBotId} onChange={e => setSelectedBotId(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm bg-white shadow-sm">
          <option value="">Seleccioná un bot</option>
          {botOptions.map(b => (
            <option key={b.id} value={b.id}>{b.business_name || b.name}</option>
          ))}
        </select>
      </div>

      {!selectedBotId && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">🛵</div>
          <p>Seleccioná un bot para ver sus pedidos</p>
        </div>
      )}

      {loading && <p className="text-gray-400">Cargando pedidos...</p>}

      {selectedBotId && !loading && orders.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">📭 Sin pedidos aún</p>
          <p className="text-sm">Los pedidos aparecerán acá cuando los clientes usen <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">!pedido</code></p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="space-y-3 max-w-2xl">
          {orders.map(order => (
            <div key={order.id} id={`order-${order.id}`} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 transition-all duration-500">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-800">{order.user_name || 'Anónimo'}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_ICONS[order.status] || '⏳'} {order.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 mt-1">{order.items}</p>
                  {order.total && <p className="text-sm font-medium text-gray-700 mt-1">💰 ${Number(order.total).toLocaleString('es-AR')}</p>}
                  <p className="text-[10px] text-gray-400 mt-1.5">{new Date(order.created_at + 'Z').toLocaleString('es-AR')}</p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {order.status !== 'completed' && order.status !== 'cancelled' && (
                    <>
                      {order.status === 'pending' && (
                        <button onClick={() => updateStatus(order.id, 'confirmed')} disabled={updating === order.id}
                          className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 disabled:opacity-50">Confirmar</button>
                      )}
                      {order.status === 'confirmed' && (
                        <button onClick={() => updateStatus(order.id, 'completed')} disabled={updating === order.id}
                          className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 disabled:opacity-50">Completar</button>
                      )}
                      <button onClick={() => updateStatus(order.id, 'cancelled')} disabled={updating === order.id}
                        className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-200 disabled:opacity-50">Cancelar</button>
                    </>
                  )}
                  {(order.status === 'completed' || order.status === 'cancelled') && (
                    <button onClick={() => updateStatus(order.id, 'pending')} disabled={updating === order.id}
                      className="text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-50">Reabrir</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
