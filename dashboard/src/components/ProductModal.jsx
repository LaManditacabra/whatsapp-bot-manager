import { useState, useEffect } from 'react'
import { api } from '../api'

export default function ProductModal({ showLoading, hideLoading }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [emoji, setEmoji] = useState('🔹')
  const [desc, setDesc] = useState('')
  const [category, setCategory] = useState('')
  const [stock, setStock] = useState('')
  const [paymentLink, setPaymentLink] = useState('')
  const [editId, setEditId] = useState(null)
  const [clientId, setClientId] = useState(null)
  const [existingCategories, setExistingCategories] = useState([])

  useEffect(() => {
    const handler = () => {
      const btn = document.getElementById('productModalTrigger')
      if (!btn) return
      setClientId(btn.dataset.clientId || null)
      const id = btn.dataset.editId || ''
      setEditId(id || null)
      setName(btn.dataset.editName || '')
      setPrice(btn.dataset.editPrice || '')
      setEmoji(btn.dataset.editEmoji || '🔹')
      setDesc(btn.dataset.editDesc || '')
      setCategory(btn.dataset.editCategory || 'General')
      setStock(btn.dataset.editStock ?? '')
      setPaymentLink(btn.dataset.editPaymentLink || '')
      setOpen(true)
      // Load existing categories from products list
      if (btn.dataset.existingCategories) {
        try { setExistingCategories(JSON.parse(btn.dataset.existingCategories)) }
        catch { setExistingCategories([]) }
      }
    }
    const btn = document.getElementById('productModalTrigger')
    if (btn) btn.addEventListener('click', handler)
    return () => { if (btn) btn.removeEventListener('click', handler) }
  }, [])

  async function save() {
    if (!clientId || !name) return alert('El nombre es obligatorio')
    showLoading('Guardando producto...')
    try {
      const body = { name, price: price ? parseFloat(price) : null, emoji, description: desc, category: category || 'General', stock: stock !== '' ? parseInt(stock) : 0, payment_link: paymentLink || null }
      if (editId) {
        await api(`/api/clients/${clientId}/products/${editId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      } else {
        await api(`/api/clients/${clientId}/products`, {
          method: 'POST',
          body: JSON.stringify(body),
        })
      }
      setOpen(false)
    } catch { alert('Error al guardar producto') }
    hideLoading()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 border border-gray-100 max-h-[90vh] overflow-y-auto relative">
        <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        <h3 className="text-lg font-semibold mb-4">{editId ? 'Editar Producto' : 'Nuevo Producto'}</h3>
        <div className="space-y-3">
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Nombre" />
          <input value={price} onChange={e => setPrice(e.target.value)} type="number" step="0.01"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Precio (opcional)" />
          <input value={emoji} onChange={e => setEmoji(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Emoji (ej: 🍕)" />
          <textarea value={desc} onChange={e => setDesc(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Descripción (opcional)" rows="2"></textarea>
          <div className="relative">
            <input value={category} onChange={e => setCategory(e.target.value)} list="cat-suggestions"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Categoría (ej: Pizzas)" />
            <datalist id="cat-suggestions">
              {existingCategories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <input value={stock} onChange={e => setStock(e.target.value)} type="number" min="0"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Stock (0 = agotado, vacío = sin stock)" />
          <input value={paymentLink} onChange={e => setPaymentLink(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Link de pago (ej: https://mpago.li/...)" />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setOpen(false)}
            className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium">Cancelar</button>
          <button onClick={save}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium shadow-sm">{editId ? 'Actualizar' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}
