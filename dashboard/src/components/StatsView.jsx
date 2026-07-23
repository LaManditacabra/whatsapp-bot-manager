import { useState, useEffect } from 'react'
import { api } from '../api'

export default function StatsView({ showLoading, hideLoading }) {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    setLoading(true)
    try {
      const clients = await api('/api/clients')
      // Fetch stats in chunks of 3 to avoid hammering the server
      const rows = []
      for (let i = 0; i < clients.length; i += 3) {
        const chunk = clients.slice(i, i + 3)
        const results = await Promise.all(chunk.map(async c => {
          try {
            const stats = await api(`/api/clients/${c.id}/stats`)
            return { ...c, stats }
          } catch { return { ...c, stats: null } }
        }))
        rows.push(...results)
      }
      setCards(rows)
    } catch { setCards([]) }
    setLoading(false)
  }

  if (loading) return <div className="flex-1 overflow-y-auto p-6"><p className="text-gray-400">Cargando...</p></div>

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-5">📊 Estadísticas</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 max-w-5xl">
        {cards.map(c => {
          const s = c.stats
          if (!s) return (
            <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all">
              <h3 className="font-semibold text-gray-800">{c.business_name || c.name}</h3>
              <p className="text-xs text-gray-400">Sin estadísticas disponibles</p>
            </div>
          )

          const max = s.last_week?.length > 0 ? Math.max(...s.last_week.map(x => x.count), 1) : 1
          const maxC = s.commands?.length > 0 ? Math.max(...s.commands.slice(0, 3).map(x => x.count), 1) : 1

          return (
            <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-800">{c.business_name || c.name}</h3>
                  <p className="text-xs text-gray-400">{c.phone || ''}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${c.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {c.status === 'online' ? '🟢' : '⚫'} {c.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-blue-50 rounded-xl p-2.5 text-center">
                  <p className="text-lg font-bold text-blue-700">{s.total_messages}</p>
                  <p className="text-[10px] text-blue-600 font-medium">Mensajes</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
                  <p className="text-lg font-bold text-emerald-700">{s.total_users}</p>
                  <p className="text-[10px] text-emerald-600 font-medium">Usuarios</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-2.5 text-center">
                  <p className="text-lg font-bold text-orange-700">{s.total_orders}</p>
                  <p className="text-[10px] text-orange-600 font-medium">Pedidos</p>
                </div>
              </div>

              {s.last_week?.length > 0 ? (
                <div className="flex items-end gap-1 h-12 mb-2">
                  {s.last_week.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div className="w-full bg-blue-400 rounded-t-sm" style={{ height: Math.max(Math.round((d.count / max) * 36), 3) + 'px' }}></div>
                      <span className="text-[8px] text-gray-400 mt-0.5">{d.day.slice(5)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-gray-400 text-center py-2">Sin datos aún</p>}

              {s.commands?.length > 0 && (
                <div className="space-y-1.5">
                  {s.commands.slice(0, 3).map((cmd, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500 w-20 truncate">{cmd.message}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: Math.round((cmd.count / maxC) * 100) + '%' }}></div>
                      </div>
                      <span className="font-medium text-gray-600 w-6 text-right">{cmd.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
