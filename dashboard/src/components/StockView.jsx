import { useState, useEffect } from 'react'
import { api } from '../api'

export default function StockView({ user, showLoading, hideLoading }) {
  const [bots, setBots] = useState([])
  const [selectedBotId, setSelectedBotId] = useState('')
  const [products, setProducts] = useState([])
  const [saving, setSaving] = useState({})

  useEffect(() => {
    api('/api/clients').then(setBots).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedBotId) { setProducts([]); return }
    api(`/api/clients/${selectedBotId}/products`).then(setProducts).catch(() => {})
  }, [selectedBotId])

  async function updateField(productId, field, value) {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, [field]: value } : p))
  }

  async function saveProduct(productId) {
    const p = products.find(x => x.id === productId)
    if (!p) return
    setSaving(prev => ({ ...prev, [productId]: true }))
    try {
      await api(`/api/clients/${selectedBotId}/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: p.name,
          price: p.price,
          emoji: p.emoji || '🔹',
          description: p.description || '',
          category: p.category || 'General',
          stock: p.stock ?? 0,
          payment_link: p.payment_link || null,
        }),
      })
    } catch (e) { alert('Error: ' + e.message) }
    setSaving(prev => ({ ...prev, [productId]: false }))
  }

  if (user.plan === 'free') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-16 px-4">
          <span className="text-5xl block mb-4">🔒</span>
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Stock</h2>
          <p className="text-gray-500 mb-4">Gestioná el stock y links de pago de tus productos.</p>
          <div className="inline-block bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-2 rounded-xl font-semibold text-sm shadow-lg">
            Exclusivo Premium
          </div>
        </div>
      </div>
    )
  }

  const selectedBot = bots.find(b => b.id === selectedBotId)

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-800">📦 Stock</h2>
          <select value={selectedBotId} onChange={e => setSelectedBotId(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Seleccionar bot...</option>
            {bots.map(b => (
              <option key={b.id} value={b.id}>{b.business_name || b.name || b.phone}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {!selectedBotId ? (
          <p className="text-gray-400 text-center py-16 text-sm">Seleccioná un bot para gestionar su stock.</p>
        ) : products.length === 0 ? (
          <p className="text-gray-400 text-center py-16 text-sm">Sin productos. Agregalos desde la sección "Mis Bots".</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Producto</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Precio</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Stock</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Link de pago</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600"></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <span className="font-medium">{p.emoji} {p.name}</span>
                        {p.category && <span className="text-gray-400 text-xs ml-1.5">{p.category}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">${p.price || '—'}</td>
                      <td className="px-4 py-3">
                        <input type="number" min="0"
                          value={p.stock ?? ''}
                          onChange={e => updateField(p.id, 'stock', e.target.value === '' ? null : parseInt(e.target.value))}
                          className={`w-20 border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${p.stock > 0 ? 'border-green-300' : p.stock === 0 ? 'border-red-300' : 'border-gray-200'}`}
                          placeholder="—" />
                      </td>
                      <td className="px-4 py-3">
                        <input value={p.payment_link || ''}
                          onChange={e => updateField(p.id, 'payment_link', e.target.value)}
                          className="w-full min-w-[200px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="https://mpago.li/..." />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => saveProduct(p.id)} disabled={saving[p.id]}
                          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                          {saving[p.id] ? '...' : 'Guardar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-400">
              {products.filter(p => p.stock === 0).length > 0 && (
                <span className="text-red-500">{products.filter(p => p.stock === 0).length} producto(s) agotado(s)</span>
              )}
              {products.filter(p => p.stock > 0).length > 0 && (
                <span className="text-green-600 ml-3">{products.filter(p => p.stock > 0).length} producto(s) en stock</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
