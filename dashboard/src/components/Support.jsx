import { useState, useEffect, useRef } from 'react'
import { api } from '../api'

export default function Support({ user, showLoading, hideLoading }) {
  const [tickets, setTickets] = useState([])
  const [currentTicketId, setCurrentTicketId] = useState(null)
  const [currentTicket, setCurrentTicket] = useState(null)
  const pollRef = useRef(null)

  useEffect(() => {
    loadTickets()
    pollRef.current = setInterval(() => {
      loadTickets()
      if (currentTicketId) loadTicketDetail(currentTicketId)
    }, 8000)
    return () => clearInterval(pollRef.current)
  }, [])

  useEffect(() => {
    if (currentTicketId) loadTicketDetail(currentTicketId)
    else setCurrentTicket(null)
  }, [currentTicketId])

  async function loadTickets() {
    try {
      const data = await api('/api/tickets')
      setTickets(data)
    } catch {}
  }

  async function loadTicketDetail(id) {
    try {
      const t = await api(`/api/tickets/${id}`)
      setCurrentTicket(t)
    } catch {}
  }

  async function toggleStatus(id, status) {
    showLoading('Actualizando...')
    try {
      await api(`/api/tickets/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      loadTickets()
    } catch { alert('Error al actualizar ticket') }
    hideLoading()
  }

  async function deleteTicket(id) {
    if (!confirm('¿Eliminar este ticket definitivamente?')) return
    showLoading('Eliminando...')
    try {
      await api(`/api/tickets/${id}`, { method: 'DELETE' })
      setCurrentTicketId(null)
      loadTickets()
    } catch { alert('Error al eliminar') }
    hideLoading()
  }

  const [replyText, setReplyText] = useState('')

  async function sendReply(msg) {
    const message = msg || replyText
    if (!message || !currentTicketId) return
    showLoading('Enviando...')
    try {
      await api(`/api/tickets/${currentTicketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      })
      setReplyText('')
      loadTickets()
      loadTicketDetail(currentTicketId)
    } catch { alert('Error al enviar') }
    hideLoading()
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800">Soporte</h2>
        <button onClick={() => document.getElementById('ticketModalTrigger').click()}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 text-sm font-medium transition-all shadow-sm hover:shadow-md flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
          Nuevo Ticket
        </button>
      </div>
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="w-80 border-r border-gray-200 bg-white overflow-y-auto min-h-0">
          <div className="p-3 space-y-1">
            {tickets.map(t => (
              <div key={t.id} onClick={() => setCurrentTicketId(t.id)}
                className={`p-3 rounded-xl cursor-pointer hover:bg-gray-50 transition-all ${currentTicketId === t.id ? 'bg-blue-50 border border-blue-200' : 'border border-transparent'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{t.subject}</p>
                  <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded-full ${t.status === 'open' ? 'bg-green-100 text-green-700' : t.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{t.status}</span>
                </div>
                {user?.role === 'admin' && <p className="text-xs text-gray-400 mt-1">{t.user_name || t.user_email}</p>}
                <p className="text-xs text-gray-400 mt-0.5">{new Date(t.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          {!currentTicket ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="text-6xl mb-4 opacity-50">🎫</div>
              <p className="text-lg font-medium">Seleccioná un ticket</p>
              <p className="text-sm">Hacé clic en un ticket para ver la conversación</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{currentTicket.subject}</h3>
                  <p className="text-sm text-gray-500">
                    {currentTicket.status === 'open' ? '🟢 Abierto' : currentTicket.status === 'pending' ? '🟡 Pendiente' : '🔴 Cerrado'}
                    {user?.role === 'admin' && ` — ${currentTicket.user_name || currentTicket.user_email}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {user?.role === 'admin' && (
                    <button onClick={() => toggleStatus(currentTicket.id, currentTicket.status === 'closed' ? 'open' : 'closed')}
                      className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${currentTicket.status === 'closed' ? 'border-green-300 text-green-700 hover:bg-green-50' : 'border-red-300 text-red-700 hover:bg-red-50'}`}>
                      {currentTicket.status === 'closed' ? 'Reabrir' : 'Cerrar'}
                    </button>
                  )}
                  {currentTicket.status === 'closed' && user?.role === 'admin' && (
                    <button onClick={() => deleteTicket(currentTicket.id)}
                      className="px-3 py-1.5 rounded-xl text-sm font-medium border border-red-300 text-red-700 hover:bg-red-50 transition-all">🗑 Eliminar</button>
                  )}
                  {currentTicket.status !== 'closed' && (
                    <button onClick={() => document.getElementById('replyInput')?.focus()}
                      className="px-3 py-1.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-all">Responder</button>
                  )}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 min-h-[300px] flex flex-col">
                <div className="flex-1 overflow-y-auto mb-4">
                  {currentTicket.messages?.map(m => (
                    <div key={m.id} className={`flex ${m.is_admin ? 'justify-start' : 'justify-end'} mb-3`}>
                      <div className={`max-w-[75%] ${m.is_admin ? 'bg-gray-100 rounded-2xl rounded-bl-sm' : 'bg-blue-600 text-white rounded-2xl rounded-br-sm'} px-4 py-2.5`}>
                        <p className="text-xs font-medium opacity-70 mb-0.5">{m.is_admin ? 'Soporte' : 'Tú'}</p>
                        <p className="text-sm">{m.message}</p>
                        <p className="text-[10px] opacity-50 mt-1">{new Date(m.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {currentTicket.status !== 'closed' && (
                  <div className="flex gap-2 border-t pt-3">
                    <input id="replyInput" value={replyText} onChange={e => setReplyText(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Escribí tu respuesta..." />
                    <button onClick={() => sendReply()}
                      className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700">Enviar</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
