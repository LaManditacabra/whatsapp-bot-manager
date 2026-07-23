import { useState, useEffect } from 'react'
import { api } from '../api'

export default function ClientModal({ onSaved, showLoading, hideLoading }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [business, setBusiness] = useState('')
  const [editId, setEditId] = useState('')

  useEffect(() => {
    const handler = () => {
      const btn = document.getElementById('clientModalTrigger')
      if (!btn) return
      const id = btn.dataset.editId || ''
      setEditId(id)
      setName(btn.dataset.editName || '')
      setPhone(btn.dataset.editPhone || '')
      setBusiness(btn.dataset.editBusiness || '')
      setOpen(true)
    }
    const btn = document.getElementById('clientModalTrigger')
    if (btn) btn.addEventListener('click', handler)
    return () => { if (btn) btn.removeEventListener('click', handler) }
  }, [])

  async function save() {
    if (!name) return alert('El nombre es obligatorio')
    showLoading(editId ? 'Guardando...' : 'Creando bot...')
    try {
      if (editId) {
        await api(`/api/clients/${editId}`, { method: 'PUT', body: JSON.stringify({ name, phone, business_name: business }) })
      } else {
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ name, phone, business_name: business }),
        })
        if (res.status === 403) {
          const data = await res.json()
          hideLoading()
          return alert(data.error)
        }
        const created = await res.json()
        setOpen(false)
        hideLoading()
        return onSaved(created.id)
      }
      setOpen(false)
      onSaved(editId)
    } catch { alert('Error al guardar') }
    hideLoading()
  }

  if (!open) return null

  return (
    <div id="clientModal" className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 border border-gray-100 max-h-[90vh] overflow-y-auto relative">
        <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        <h3 className="text-lg font-semibold mb-4">{editId ? 'Editar Bot' : 'Nuevo Bot'}</h3>
        <div className="space-y-3">
          <input id="clientModalName" value={name} onChange={e => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Nombre del negocio" />
          <input value={phone} onChange={e => setPhone(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="WhatsApp (ej: 5491112345678)" />
          <input value={business} onChange={e => setBusiness(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Nombre comercial (opcional)" />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setOpen(false)}
            className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium">Cancelar</button>
          <button onClick={save}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium shadow-sm">Guardar</button>
        </div>
      </div>
    </div>
  )
}
