import { useState, useEffect } from 'react'
import { api } from '../api'

export default function Plans({ user, showLoading, hideLoading }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/api/plans').then(setPlans).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function upgradePlan(planId) {
    showLoading('Preparando pago...')
    try {
      const data = await api('/api/create-preference', {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId }),
      })
      hideLoading()
      if (data.approve_link) {
        window.location.href = data.approve_link
      } else {
        alert('Error: ' + (data.error || 'No se pudo crear el pago'))
      }
    } catch {
      hideLoading()
      alert('Error al conectar con PayPal')
    }
  }

  if (loading) return <div className="flex-1 p-6 text-gray-400">Cargando planes...</div>

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-5">Planes</h2>
      {plans.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-sm">No hay planes disponibles</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl">
        {plans.map(p => (
          <div key={p.id} className={`bg-white rounded-lg p-6 shadow ${p.price === 0 ? 'border-2 border-gray-200' : 'border-2 border-blue-200'}`}>
            <h3 className="text-xl font-bold mb-2">{p.name}</h3>
            <p className="text-3xl font-bold mb-4">{p.price === 0 ? 'Gratis' : `$${p.price}/mes`}</p>
            <ul className="space-y-2 mb-4">
              {p.features.map(f => (
                <li key={f} className="text-sm text-gray-600">✅ {f}</li>
              ))}
            </ul>
            {String(user?.plan) === String(p.id) ? (
              <span className="block text-center text-green-600 font-semibold">✔ Plan actual</span>
            ) : p.price === 0 ? null : (
              <button onClick={() => upgradePlan(p.id)}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                Contratar
              </button>
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  )
}
