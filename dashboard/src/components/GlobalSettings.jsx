import { useState, useEffect } from 'react'
import { api } from '../api'

export default function GlobalSettings({ showLoading, hideLoading }) {
  const [prefix, setPrefix] = useState('!')
  const [cooldown, setCooldown] = useState('172800')
  const [paypalClientId, setPaypalClientId] = useState('')
  const [paypalSecret, setPaypalSecret] = useState('')
  const [paypalMode, setPaypalMode] = useState('sandbox')
  const [saved, setSaved] = useState(false)

  useEffect(() => { loadSettings() }, [])

  async function loadSettings() {
    try {
      const s = await api('/api/settings')
      if (s.bot_prefix) setPrefix(s.bot_prefix)
      if (s.bot_cooldown) setCooldown(s.bot_cooldown)
      if (s.paypal_client_id) setPaypalClientId(s.paypal_client_id)
      if (s.paypal_client_secret) setPaypalSecret(s.paypal_client_secret)
      if (s.paypal_mode) setPaypalMode(s.paypal_mode)
    } catch {}
  }

  async function save() {
    showLoading('Guardando configuración global...')
    const body = { bot_prefix: prefix, bot_cooldown: cooldown, paypal_mode: paypalMode }
    if (paypalClientId) body.paypal_client_id = paypalClientId
    if (paypalSecret) body.paypal_client_secret = paypalSecret
    await api('/api/settings', { method: 'PUT', body: JSON.stringify(body) })
    hideLoading()
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-5">Configuración Global</h2>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-2xl space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Prefijo de comandos</label>
          <input value={prefix} onChange={e => setPrefix(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Cooldown (segundos)</label>
          <input value={cooldown} onChange={e => setCooldown(e.target.value)} type="number"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
        </div>
        <hr className="my-4" />
        <h4 className="font-semibold text-gray-700">💳 PayPal</h4>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Client ID</label>
          <input value={paypalClientId} onChange={e => setPaypalClientId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Client Secret</label>
          <input value={paypalSecret} onChange={e => setPaypalSecret(e.target.value)} type="password"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Modo</label>
          <select value={paypalMode} onChange={e => setPaypalMode(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all">
            <option value="sandbox">Sandbox (pruebas)</option>
            <option value="live">Live (producción)</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={save}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-700 text-sm font-medium transition-all shadow-sm hover:shadow-md">
            Guardar
          </button>
          {saved && <span className="text-green-600 text-sm font-medium">✓ Guardado correctamente</span>}
        </div>
      </div>
    </div>
  )
}
