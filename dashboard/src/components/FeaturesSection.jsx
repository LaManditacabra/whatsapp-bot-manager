import { useState, useEffect, useRef } from 'react'
import { api } from '../api'

const PLAN_LABELS = { free: 'Gratis', premium: 'Premium', unlimited: 'Ilimitado' }

export default function FeaturesSection({ clientId, userPlan, showLoading, hideLoading }) {
  const [features, setFeatures] = useState([])
  const [enabled, setEnabled] = useState([])
  const [toggling, setToggling] = useState(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    async function load() {
      try {
        const [allFeats, featData] = await Promise.all([
          api('/api/features'),
          api(`/api/clients/${clientId}/features`),
        ])
        setFeatures(allFeats)
        const feats = featData.enabled
        if (!feats || feats.length === 0) {
          setEnabled(['productos', 'pedidos', 'horario', 'contacto'])
        } else {
          setEnabled(feats)
        }
      } catch {}
    }
    if (clientId) load()
  }, [clientId])

  async function toggle(featureId, isPremium, requiredPlan) {
    if (toggling) return
    const nowEnabled = enabled.includes(featureId)

    if (!nowEnabled && isPremium) {
      const planRank = { free: 0, premium: 1, unlimited: 2 }
      if (planRank[userPlan] < planRank[requiredPlan]) {
        alert(`Esta función requiere plan ${PLAN_LABELS[requiredPlan] || requiredPlan}. Actualizá tu plan para activarla.`)
        return
      }
    }

    setToggling(featureId)
    try {
      const res = await api(`/api/clients/${clientId}/features`, {
        method: 'PUT',
        body: JSON.stringify({ featureId, enabled: !nowEnabled }),
      })
      setEnabled(res.enabled || [])
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setToggling(null)
  }

  const freeFeatures = features.filter(f => f.plan === 'free')
  const premiumFeatures = features.filter(f => f.plan !== 'free')

  return (
    <div id="featuresSection" data-tour="featuresSection" className="bg-white rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-800">⚡ Funciones del bot</h4>
      </div>

      <div className="mb-4">
        <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Gratuitas</h5>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {freeFeatures.map(f => {
            const isOn = enabled.includes(f.id)
            const isLoading = toggling === f.id
            return (
              <button key={f.id} type="button" disabled={isLoading}
                onClick={() => toggle(f.id, false)}
                className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-150 text-center min-h-[88px] ${isOn ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                <span className={`text-2xl leading-none ${isOn ? '' : 'opacity-50'}`}>{f.icon}</span>
                <span className={`text-[11px] font-semibold leading-tight ${isOn ? 'text-blue-700' : 'text-gray-500'}`}>{f.name}</span>
                <span className="text-[9px] text-gray-400 leading-tight line-clamp-2">{f.desc}</span>
                {isOn && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Premium</h5>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {premiumFeatures.map(f => {
            const isOn = enabled.includes(f.id)
            const isLoading = toggling === f.id
            const planRank = { free: 0, premium: 1, unlimited: 2 }
            const locked = planRank[userPlan] < planRank[f.plan]
            return (
              <button key={f.id} type="button" disabled={isLoading}
                onClick={() => toggle(f.id, true, f.plan)}
                className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-150 text-center min-h-[88px] ${locked ? 'border-gray-100 bg-gray-50 cursor-not-allowed' : isOn ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                <div className="relative">
                  <span className={`text-2xl leading-none ${locked ? 'opacity-30' : isOn ? '' : 'opacity-50'}`}>{f.icon}</span>
                  {locked && (
                    <span className="absolute -top-1 -right-2 text-xs">🔒</span>
                  )}
                </div>
                <span className={`text-[11px] font-semibold leading-tight ${locked ? 'text-gray-400' : isOn ? 'text-purple-700' : 'text-gray-500'}`}>{f.name}</span>
                <span className="text-[9px] text-gray-400 leading-tight line-clamp-2">{f.desc}</span>
                {locked && (
                  <span className="text-[8px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full font-medium mt-auto">
                    {PLAN_LABELS[f.plan]}
                  </span>
                )}
                {isOn && !locked && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
