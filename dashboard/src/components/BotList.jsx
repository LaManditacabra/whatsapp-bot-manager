import { useState, useEffect } from 'react'
import { api } from '../api'

export default function BotList({ user, currentClientId, onSelect, onShowTour }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/api/clients').then(setClients).catch(() => {}).finally(() => setLoading(false))
    const interval = setInterval(() => {
      api('/api/clients').then(setClients).catch(() => {})
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="w-full md:w-80 border-r border-gray-200 bg-white overflow-y-auto min-h-0">
      <div className="p-3 space-y-1">
        {clients.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <div className="text-4xl mb-3">🤖</div>
            <p className="text-sm font-medium">Todavía no tenés bots</p>
            <p className="text-xs mt-1">Hacé clic en "Nuevo Bot" para empezar</p>
            <button onClick={onShowTour} className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium underline underline-offset-2">
              ¿Primera vez? Ver guía rápida
            </button>
          </div>
        )}
        {clients.map(c => (
          <div key={c.id}
            onClick={() => onSelect(c.id)}
            className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 mb-1 ${currentClientId === c.id ? 'bg-blue-50 border border-blue-200' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="font-medium truncate block">{c.business_name || c.name}</span>
              <span className="flex items-center gap-1">
                {c.phone && (
                  <a href={`https://wa.me/${c.phone.replace(/[^0-9]/g, '')}`} target="_blank"
                    onClick={e => e.stopPropagation()}
                    className="text-green-500 hover:text-green-700 text-sm" title="Abrir WhatsApp">💬</a>
                )}
                <span className={`text-sm ${c.status === 'online' ? 'text-green-500' : c.status === 'awaiting_scan' ? 'text-yellow-500' : 'text-gray-400'}`}>
                  {c.status === 'online' ? '🟢' : c.status === 'awaiting_scan' ? '🟡' : '⚫'}
                </span>
              </span>
            </div>
            <p className="text-sm text-gray-500">{c.phone || ''}</p>
            {c.user_email && user?.role === 'admin' && (
              <p className="text-xs text-gray-400">{c.user_name || c.user_email}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
