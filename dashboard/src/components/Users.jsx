import { useState, useEffect } from 'react'
import { api } from '../api'

export default function Users({ showLoading, hideLoading }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    try {
      const data = await api('/api/admin/users')
      setUsers(data)
    } catch {}
    setLoading(false)
  }

  async function updateUserPlan(id, plan) {
    const limits = { free: 1, premium: 5, unlimited: 999 }
    showLoading('Actualizando plan...')
    await api(`/api/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ plan, plan_bots_limit: limits[plan] }),
    })
    hideLoading()
    loadUsers()
  }

  async function updateUserRole(id, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin'
    const msg = currentRole === 'admin' ? '¿Quitar admin a este usuario?' : '¿Hacer admin a este usuario?'
    if (!confirm(msg)) return
    showLoading('Actualizando rol...')
    await api(`/api/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ role: newRole }),
    })
    hideLoading()
    loadUsers()
  }

  if (loading) return <div className="flex-1 p-6 text-gray-400">Cargando usuarios...</div>

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-5">Usuarios</h2>
      {users.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-sm">No hay usuarios registrados</p>
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {users.map(u => (
            <div key={u.id} className="bg-white rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{u.name || u.email}</p>
                <p className="text-sm text-gray-500">{u.email}</p>
                <p className="text-xs text-gray-400">Plan: {u.plan} | Bots: {u.plan_bots_limit} | Rol: {u.role}</p>
              </div>
              <div className="flex gap-2 items-center text-sm">
                <select value={u.plan} onChange={e => updateUserPlan(u.id, e.target.value)}
                  className="border rounded px-2 py-1">
                  <option value="free">Gratuito</option>
                  <option value="premium">Premium</option>
                  <option value="unlimited">Ilimitado</option>
                </select>
                <button onClick={() => updateUserRole(u.id, u.role)}
                  className="text-blue-600 hover:underline">
                  {u.role === 'admin' ? '🔴 Quitar admin' : '⭐ Hacer admin'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
