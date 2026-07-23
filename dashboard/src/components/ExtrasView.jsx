import { useState, useEffect } from 'react'
import { api } from '../api'

export default function ExtrasView({ user, showLoading, hideLoading }) {
  const [bots, setBots] = useState([])
  const [selectedBotId, setSelectedBotId] = useState('')
  const [botSettings, setBotSettings] = useState({})
  const [features, setFeatures] = useState([])
  const [products, setProducts] = useState([])
  const [coupons, setCoupons] = useState([])
  const [reminders, setReminders] = useState([])
  const [loadingBots, setLoadingBots] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [couponForm, setCouponForm] = useState({ code: '', discount_value: 10, discount_type: 'percentage', max_uses: 0, expires_at: '' })
  const [reminderForm, setReminderForm] = useState({ title: '', message: '', frequency: 'daily', day_of_week: 0, time: '10:00' })
  const [editCouponId, setEditCouponId] = useState(null)
  const [editReminderId, setEditReminderId] = useState(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null) // { productId, percent, phase }

  useEffect(() => {
    setLoadingBots(true)
    api('/api/clients').then(b => { setBots(b); setLoadingBots(false) }).catch(() => setLoadingBots(false))
  }, [])

  useEffect(() => {
    if (!selectedBotId) return
    loadData()
  }, [selectedBotId])

  async function loadData() {
    setLoadingData(true)
    try {
      const [f, s, p, c, r] = await Promise.all([
        api('/api/features'),
        api(`/api/clients/${selectedBotId}/settings`),
        api(`/api/clients/${selectedBotId}/products`),
        api(`/api/clients/${selectedBotId}/coupons`),
        api(`/api/clients/${selectedBotId}/reminders`),
      ])
      setFeatures(f)
      setBotSettings(s)
      setProducts(p)
      setCoupons(c)
      setReminders(r)
    } catch {}
    setLoadingData(false)
  }

  function getEnabledFeatures() {
    try { return botSettings.features ? JSON.parse(botSettings.features) : [] } catch { return [] }
  }

  async function saveSetting(key, value) {
    showLoading('Guardando...')
    try {
      await api(`/api/clients/${selectedBotId}/settings`, {
        method: 'PUT',
        body: JSON.stringify({ [key]: value }),
      })
      setBotSettings(prev => ({ ...prev, [key]: value }))
    } catch (e) { alert('Error: ' + e.message) }
    hideLoading()
  }

  async function toggleFeature(featureId) {
    const current = getEnabledFeatures()
    const enabled = current.includes(featureId) ? current.filter(f => f !== featureId) : [...current, featureId]
    try {
      await api(`/api/clients/${selectedBotId}/features`, {
        method: 'PUT',
        body: JSON.stringify({ featureId, enabled: !current.includes(featureId) }),
      })
      await loadData()
    } catch (e) { alert('Error: ' + e.message) }
  }

  function isFeatureLocked(featureId) {
    const feat = features.find(f => f.id === featureId)
    if (!feat) return false
    const planRank = { free: 0, premium: 1, unlimited: 2 }
    return planRank[user.plan] < planRank[feat.plan]
  }

  // ─── Image upload ────────────────────────────────────────────
  async function handleImageSelect(productId, file) {
    if (!file) return
    setImageUploading(true)
    setUploadProgress({ productId, percent: 0, phase: 'Comprimiendo...' })
    try {
      // Compress image client-side
      const compressed = await compressImage(file, 800, 0.8)
      setUploadProgress({ productId, percent: 40, phase: 'Comprimiendo...' })
      const p = products.find(x => x.id === productId)
      // Upload with progress via XHR
      await uploadWithProgress(`/api/clients/${selectedBotId}/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...p, image: compressed }),
      }, (percent) => {
        setUploadProgress({ productId, percent: 40 + Math.round(percent * 0.6), phase: 'Subiendo...' })
      })
      setUploadProgress({ productId, percent: 100, phase: '¡Listo!' })
      await loadData()
    } catch (err) { alert('Error: ' + err.message) }
    setImageUploading(false)
    setUploadProgress(null)
  }

  function uploadWithProgress(path, options, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open(options.method || 'GET', path)
      const headers = options.headers || {}
      headers['Content-Type'] = 'application/json'
      const token = localStorage.getItem('token')
      if (token) headers['Authorization'] = `Bearer ${token}`
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total)
      }
      xhr.onload = () => {
        if (xhr.status === 401) {
          localStorage.removeItem('token')
          window.location.reload()
          return
        }
        try {
          const data = JSON.parse(xhr.responseText)
          if (xhr.status >= 200 && xhr.status < 300) resolve(data)
          else reject(new Error(data.error || 'Error del servidor'))
        } catch { reject(new Error('Error de conexión')) }
      }
      xhr.onerror = () => reject(new Error('Error de conexión'))
      xhr.send(options.body)
    })
  }

  // Helper to resize/compress images before upload
  function compressImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          let w = img.width, h = img.height
          if (w > maxSize || h > maxSize) {
            const ratio = Math.min(maxSize / w, maxSize / h)
            w = Math.round(w * ratio)
            h = Math.round(h * ratio)
          }
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, w, h)
          resolve(canvas.toDataURL('image/jpeg', quality))
        }
        img.onerror = reject
        img.src = e.target.result
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function removeImage(productId) {
    const p = products.find(x => x.id === productId)
    await api(`/api/clients/${selectedBotId}/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...p, image: null }),
    })
    await loadData()
  }

  // ─── Coupons ─────────────────────────────────────────────────
  async function saveCoupon() {
    if (!couponForm.code.trim()) return
    showLoading(editCouponId ? 'Actualizando...' : 'Creando...')
    try {
      if (editCouponId) {
        await api(`/api/clients/${selectedBotId}/coupons/${editCouponId}`, { method: 'PUT', body: JSON.stringify(couponForm) })
      } else {
        await api(`/api/clients/${selectedBotId}/coupons`, { method: 'POST', body: JSON.stringify(couponForm) })
      }
      setCouponForm({ code: '', discount_value: 10, discount_type: 'percentage', max_uses: 0, expires_at: '' })
      setEditCouponId(null)
      await loadData()
    } catch (e) { alert('Error: ' + e.message) }
    hideLoading()
  }

  async function deleteCoupon(id) {
    if (!confirm('¿Eliminar este cupón?')) return
    showLoading('Eliminando...')
    await api(`/api/clients/${selectedBotId}/coupons/${id}`, { method: 'DELETE' })
    await loadData()
    hideLoading()
  }

  function editCoupon(c) {
    setCouponForm({ code: c.code, discount_value: c.discount_value, discount_type: c.discount_type, max_uses: c.max_uses, expires_at: c.expires_at || '' })
    setEditCouponId(c.id)
  }

  // ─── Reminders ───────────────────────────────────────────────
  async function saveReminder() {
    if (!reminderForm.title.trim()) return
    showLoading(editReminderId ? 'Actualizando...' : 'Creando...')
    try {
      if (editReminderId) {
        await api(`/api/clients/${selectedBotId}/reminders/${editReminderId}`, { method: 'PUT', body: JSON.stringify(reminderForm) })
      } else {
        await api(`/api/clients/${selectedBotId}/reminders`, { method: 'POST', body: JSON.stringify(reminderForm) })
      }
      setReminderForm({ title: '', message: '', frequency: 'daily', day_of_week: 0, time: '10:00' })
      setEditReminderId(null)
      await loadData()
    } catch (e) { alert('Error: ' + e.message) }
    hideLoading()
  }

  async function deleteReminder(id) {
    if (!confirm('¿Eliminar este recordatorio?')) return
    showLoading('Eliminando...')
    await api(`/api/clients/${selectedBotId}/reminders/${id}`, { method: 'DELETE' })
    await loadData()
    hideLoading()
  }

  function editReminder(r) {
    setReminderForm({ title: r.title, message: r.message || '', frequency: r.frequency, day_of_week: r.day_of_week || 0, time: r.time })
    setEditReminderId(r.id)
  }

  const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">⚡ Funciones Extras</h2>
        <select value={selectedBotId} onChange={e => setSelectedBotId(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white max-w-xs">
          <option value="">Seleccionar bot...</option>
          {loadingBots ? <option disabled>Cargando...</option> : bots.map(b => <option key={b.id} value={b.id}>{b.business_name || b.name}</option>)}
        </select>
      </div>

      {!selectedBotId && (
        <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400">
          Seleccioná un bot para configurar sus funciones extra
        </div>
      )}

      {selectedBotId && loadingData && (
        <div className="text-center py-8 text-gray-400 text-sm">Cargando configuración...</div>
      )}

      {selectedBotId && !loadingData && (<>
        {/* ─── Catálogo visual ─────────────────────────── */}
        <Panel icon="🖼️" title="Catálogo visual" featureId="catalogo_visual"
          enabled={getEnabledFeatures().includes('catalogo_visual')}
          onToggle={() => toggleFeature('catalogo_visual')}
          locked={isFeatureLocked('catalogo_visual')}>
          {products.length === 0 ? (
            <p className="text-sm text-gray-400">Primero agregá productos en el bot.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {products.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  {p.image ? (
                    <div className="relative w-12 h-12 shrink-0">
                      <img src={p.image} alt={p.name} className="w-12 h-12 object-cover rounded-lg" />
                      <button onClick={() => removeImage(p.id)} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center opacity-80 hover:opacity-100">✕</button>
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 text-xs shrink-0">Sin img</div>
                  )}
                  <span className="text-sm font-medium flex-1 truncate">{p.emoji} {p.name}</span>
                  {uploadProgress && uploadProgress.productId === p.id ? (
                    <div className="flex flex-col items-end gap-0.5 shrink-0 w-28">
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                          style={{ width: uploadProgress.percent + '%' }} />
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium">{uploadProgress.phase} {uploadProgress.percent}%</span>
                    </div>
                  ) : (
                    <label className="cursor-pointer text-blue-500 text-xs hover:underline shrink-0">
                      {p.image ? 'Cambiar' : 'Subir'}
                      <input type="file" accept="image/*" onChange={e => handleImageSelect(p.id, e.target.files[0])} className="hidden" />
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-gray-400 mt-2">Las imágenes se envían automáticamente con el menú de productos.</p>
        </Panel>

        {/* ─── Cupones ─────────────────────────────────── */}
        <Panel icon="🏷️" title="Cupones / Descuentos" featureId="cupones"
          enabled={getEnabledFeatures().includes('cupones')}
          onToggle={() => toggleFeature('cupones')}
          locked={isFeatureLocked('cupones')}>
          <div className="flex gap-2 mb-3">
            <input value={couponForm.code} onChange={e => setCouponForm(p => ({ ...p, code: e.target.value }))}
              placeholder="Código" className="flex-1 border rounded px-2 py-1.5 text-xs" />
            <select value={couponForm.discount_type} onChange={e => setCouponForm(p => ({ ...p, discount_type: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs">
              <option value="percentage">%</option>
              <option value="fixed">$ fijo</option>
            </select>
            <input type="number" value={couponForm.discount_value} onChange={e => setCouponForm(p => ({ ...p, discount_value: Number(e.target.value) }))}
              placeholder="10" className="w-16 border rounded px-2 py-1.5 text-xs" />
            <input type="date" value={couponForm.expires_at} onChange={e => setCouponForm(p => ({ ...p, expires_at: e.target.value }))}
              className="border rounded px-2 py-1.5 text-xs w-32" />
            <button onClick={saveCoupon}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-blue-700 whitespace-nowrap">
              {editCouponId ? 'Actualizar' : 'Agregar'}
            </button>
            {editCouponId && <button onClick={() => { setEditCouponId(null); setCouponForm({ code: '', discount_value: 10, discount_type: 'percentage', max_uses: 0, expires_at: '' }) }}
              className="text-gray-400 text-xs hover:text-gray-600">Cancelar</button>}
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {coupons.length === 0 ? <p className="text-xs text-gray-400">Sin cupones.</p> : coupons.map(c => (
              <div key={c.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-blue-700">{c.code}</span>
                  <span className="text-gray-500">{c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value}`}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.active ? 'Activo' : 'Inactivo'}</span>
                  {c.expires_at && <span className="text-[10px] text-gray-400">Vence: {c.expires_at}</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => editCoupon(c)} className="text-blue-400 hover:text-blue-600 text-xs">✏️</button>
                  <button onClick={() => deleteCoupon(c.id)} className="text-red-400 hover:text-red-600 text-xs">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* ─── Recordatorios ───────────────────────────── */}
        <Panel icon="⏰" title="Recordatorios automáticos" featureId="recordatorios"
          enabled={getEnabledFeatures().includes('recordatorios')}
          onToggle={() => toggleFeature('recordatorios')}
          locked={isFeatureLocked('recordatorios')}>
          <div className="flex flex-wrap gap-2 mb-3 items-end">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[9px] text-gray-400 font-medium">Título</label>
              <input value={reminderForm.title} onChange={e => setReminderForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Ej: Recordatorio de pedido" className="w-full border rounded px-2 py-1.5 text-xs" />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[9px] text-gray-400 font-medium">Mensaje</label>
              <input value={reminderForm.message} onChange={e => setReminderForm(p => ({ ...p, message: e.target.value }))}
                placeholder="Ej: No olvides hacer tu pedido!" className="w-full border rounded px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="block text-[9px] text-gray-400 font-medium">Frecuencia</label>
              <select value={reminderForm.frequency} onChange={e => setReminderForm(p => ({ ...p, frequency: e.target.value }))}
                className="border rounded px-2 py-1.5 text-xs">
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>
            {reminderForm.frequency === 'weekly' && (
              <div>
                <label className="block text-[9px] text-gray-400 font-medium">Día</label>
                <select value={reminderForm.day_of_week} onChange={e => setReminderForm(p => ({ ...p, day_of_week: Number(e.target.value) }))}
                  className="border rounded px-2 py-1.5 text-xs">
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-[9px] text-gray-400 font-medium">Hora</label>
              <input type="time" value={reminderForm.time} onChange={e => setReminderForm(p => ({ ...p, time: e.target.value }))}
                className="border rounded px-2 py-1.5 text-xs" />
            </div>
            <button onClick={saveReminder}
              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-blue-700 h-[30px]">
              {editReminderId ? 'Actualizar' : 'Crear'}
            </button>
            {editReminderId && <button onClick={() => { setEditReminderId(null); setReminderForm({ title: '', message: '', frequency: 'daily', day_of_week: 0, time: '10:00' }) }}
              className="text-gray-400 text-xs hover:text-gray-600 h-[30px]">Cancelar</button>}
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {reminders.length === 0 ? <p className="text-xs text-gray-400">Sin recordatorios.</p> : reminders.map(r => (
              <div key={r.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-gray-400 text-xs">{r.frequency} {r.frequency === 'weekly' ? `(${DAYS[r.day_of_week]})` : ''} {r.time}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{r.active ? 'Activo' : 'Inactivo'}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => editReminder(r)} className="text-blue-400 hover:text-blue-600 text-xs">✏️</button>
                  <button onClick={() => deleteReminder(r.id)} className="text-red-400 hover:text-red-600 text-xs">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* ─── Fuera de horario ────────────────────────── */}
        <Panel icon="🌙" title="Respuesta fuera de horario" featureId="fuera_horario"
          enabled={getEnabledFeatures().includes('fuera_horario')}
          onToggle={() => toggleFeature('fuera_horario')}
          locked={isFeatureLocked('fuera_horario')}>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mensaje automático cuando el bot recibe mensajes fuera del horario de atención</label>
            <textarea value={botSettings.fuera_horario_msg || ''}
              onChange={e => setBotSettings(prev => ({ ...prev, fuera_horario_msg: e.target.value }))}
              placeholder="Ej: 🕐 Estamos fuera de horario. Volvemos a las 10hs. Dejanos tu mensaje y te respondemos a la brevedad."
              className="w-full border rounded px-3 py-2 text-sm" rows={3} />
            <button onClick={() => saveSetting('fuera_horario_msg', botSettings.fuera_horario_msg || '')}
              className="mt-2 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-green-700">Guardar</button>
          </div>
        </Panel>

      </>)}
    </div>
  )
}

function Panel({ icon, title, featureId, enabled, onToggle, locked, children }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border ${enabled ? 'border-blue-200' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h3 className="font-semibold text-gray-800">{title}</h3>
          {locked && <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Premium</span>}
        </div>
        <button type="button" onClick={onToggle} disabled={locked}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-blue-600' : locked ? 'bg-gray-200 cursor-not-allowed opacity-50' : 'bg-gray-300'}`}
          title={locked ? 'Actualizá tu plan para activar esta función' : ''}>
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
        </button>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}
