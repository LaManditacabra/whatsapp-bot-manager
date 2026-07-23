import { useState, useEffect } from 'react'
import { api } from '../api'

export default function TicketModal({ showLoading, hideLoading }) {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handler = () => {
      setSubject('')
      setMessage('')
      setOpen(true)
    }
    const btn = document.getElementById('ticketModalTrigger')
    if (btn) btn.addEventListener('click', handler)
    return () => { if (btn) btn.removeEventListener('click', handler) }
  }, [])

  async function save() {
    if (!subject || !message) return alert('Completá todos los campos')
    showLoading('Creando ticket...')
    try {
      await api('/api/tickets', { method: 'POST', body: JSON.stringify({ subject, message }) })
      setOpen(false)
    } catch { alert('Error al crear ticket') }
    hideLoading()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 border border-gray-100 max-h-[90vh] overflow-y-auto relative">
        <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        <h3 className="text-lg font-semibold mb-4">Nuevo Ticket</h3>
        <div className="space-y-3">
          <input value={subject} onChange={e => setSubject(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Asunto" />
          <textarea value={message} onChange={e => setMessage(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            rows="4" placeholder="Describí tu consulta..."></textarea>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setOpen(false)}
            className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium">Cancelar</button>
          <button onClick={save}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium shadow-sm">Enviar</button>
        </div>
      </div>
    </div>
  )
}
