import { useState, useEffect } from 'react'
import { api } from '../api'

export default function KeywordModal({ showLoading, hideLoading }) {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [response, setResponse] = useState('')
  const [active, setActive] = useState(true)
  const [editId, setEditId] = useState(null)
  const [clientId, setClientId] = useState(null)

  useEffect(() => {
    const handler = () => {
      const btn = document.getElementById('keywordModalTrigger')
      if (!btn) return
      setClientId(btn.dataset.clientId || null)
      const id = btn.dataset.editId || ''
      setEditId(id || null)
      setKeyword(btn.dataset.editKeyword || '')
      setResponse(btn.dataset.editResponse || '')
      setActive(btn.dataset.editActive !== '0' && btn.dataset.editActive !== 'false')
      setOpen(true)
    }
    const btn = document.getElementById('keywordModalTrigger')
    if (btn) btn.addEventListener('click', handler)
    return () => { if (btn) btn.removeEventListener('click', handler) }
  }, [])

  async function save() {
    if (!clientId || !keyword.trim() || !response.trim()) return alert('Completá todos los campos')
    showLoading('Guardando...')
    try {
      const body = JSON.stringify({ keyword: keyword.trim(), response: response.trim(), is_active: active ? 1 : 0 })
      if (editId) {
        await api(`/api/clients/${clientId}/keywords/${editId}`, { method: 'PUT', body })
      } else {
        await api(`/api/clients/${clientId}/keywords`, { method: 'POST', body })
      }
      setOpen(false)
    } catch (e) { alert('Error al guardar: ' + (e.message || '')) }
    hideLoading()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 border border-gray-100 max-h-[90vh] overflow-y-auto relative">
        <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        <h3 className="text-lg font-semibold mb-4">{editId ? 'Editar palabra clave' : 'Nueva palabra clave'}</h3>
        <div className="space-y-3">
          <input value={keyword} onChange={e => setKeyword(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Palabra clave (ej: precio)" />
          <textarea value={response} onChange={e => setResponse(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            rows="4" placeholder="Respuesta automática..."></textarea>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            Activa
          </label>
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
