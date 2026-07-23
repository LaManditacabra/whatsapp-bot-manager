import { useState, useEffect, useRef, memo } from 'react'
import { api } from '../api'
import ThemeCreator from './ThemeCreator'
import EmojiPicker from './EmojiPicker'
import FeaturesSection from './FeaturesSection'

export default function BotDetail({ user, clientId, onBack, showLoading, hideLoading }) {
  const [data, setData] = useState(null)
  const [products, setProducts] = useState([])
  const [settings, setSettings] = useState({})
  const [keywords, setKeywords] = useState([])
  const [themes, setThemes] = useState([])
  const [selectedThemeId, setSelectedThemeId] = useState('classic')
  const [customTheme, setCustomTheme] = useState({})
  const [showCustomizer, setShowCustomizer] = useState(false)
  const [savedThemes, setSavedThemes] = useState([])
  const [themeCreatorOpen, setThemeCreatorOpen] = useState(false)
  const [emojiPickerField, setEmojiPickerField] = useState(null)
  const [qrImage, setQrImage] = useState(null)
  const eventSourceRef = useRef(null)
  const sseStartedRef = useRef(false)
  const qrPollRef = useRef(null)

  useEffect(() => {
    if (!clientId) { setData(null); return }
    sseStartedRef.current = false
    loadData()
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close()
      if (qrPollRef.current) clearInterval(qrPollRef.current)
    }
  }, [clientId])

  async function fetchQR() {
    try {
      const { qr } = await api(`/api/clients/${clientId}/qr`)
      if (qr) {
        setQrImage(qr)
        if (qrPollRef.current) clearInterval(qrPollRef.current)
        return true
      }
    } catch {}
    return false
  }

  async function loadData() {
    try {
      const [d, p, s, k, t] = await Promise.all([
        api(`/api/clients/${clientId}/status`),
        api(`/api/clients/${clientId}/products`),
        api(`/api/clients/${clientId}/settings`),
        api(`/api/clients/${clientId}/keywords`),
        api('/api/themes'),
      ])
      setData(d)
      setProducts(p)
      setSettings(s)
      setKeywords(k)
      setThemes(t)
      setSelectedThemeId(s.message_theme || 'classic')
      const ct = {}
      const customKeys = ['headerIcon', 'separator', 'bullet', 'titlePrefix', 'titleSuffix',
        'accentEmoji', 'productBullet', 'productConnector', 'orderReceiptIcon', 'orderNoteIcon',
        'scheduleIcon', 'contactIcon', 'borderChar']
      for (const key of customKeys) {
        if (s[`custom_theme_${key}`]) ct[key] = s[`custom_theme_${key}`]
      }
      setCustomTheme(ct)
      if (s.saved_themes) {
        try { setSavedThemes(JSON.parse(s.saved_themes)) } catch { setSavedThemes([]) }
      } else {
        setSavedThemes([])
      }

      if (d.status !== 'online') {
        const got = await fetchQR()
        if (!got) qrPollRef.current = setInterval(fetchQR, 3000)
        if (!sseStartedRef.current) { startSSE(); sseStartedRef.current = true }
      } else {
        setQrImage(null)
      }
    } catch {}
  }

  function startSSE() {
    if (eventSourceRef.current) eventSourceRef.current.close()
    const es = new EventSource(`/api/clients/${clientId}/stream`)
    eventSourceRef.current = es
    es.onmessage = (e) => {
      const evt = JSON.parse(e.data)
      if (evt.type === 'qr' && evt.qr) setQrImage(evt.qr)
      if (evt.type === 'status') loadData()
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este cliente? Se perderán todos los datos.')) return
    showLoading('Eliminando bot...')
    await api(`/api/clients/${clientId}`, { method: 'DELETE' })
    hideLoading()
    window.location.reload()
  }

  async function handleRestart() {
    showLoading('Reconectando...')
    await api(`/api/clients/${clientId}/restart`, { method: 'POST' })
    loadData()
    hideLoading()
  }

  async function handleEdit() {
    const btn = document.getElementById('clientModalTrigger')
    if (btn) {
      btn.dataset.editId = clientId
      btn.dataset.editName = data.name || ''
      btn.dataset.editPhone = data.phone || ''
      btn.dataset.editBusiness = data.business_name || ''
      btn.click()
    }
  }

  async function saveSettings() {
    showLoading('Guardando configuración...')
    const body = {
      horario: document.getElementById('set-horario')?.value || '',
      contacto: document.getElementById('set-contacto')?.value || '',
      message_theme: document.getElementById('set-theme')?.value || 'classic',
    }
    const customKeys = ['headerIcon', 'separator', 'bullet', 'titlePrefix', 'titleSuffix',
      'accentEmoji', 'productBullet', 'productConnector', 'orderReceiptIcon', 'orderNoteIcon',
      'scheduleIcon', 'contactIcon', 'borderChar']
    const base = themes.find(t => t.id === body.message_theme)
    for (const key of customKeys) {
      const customVal = customTheme[key]
      if (customVal !== undefined && base && customVal !== (base[key] ?? '')) {
        body[`custom_theme_${key}`] = customVal
      }
    }
    await api(`/api/clients/${clientId}/settings`, { method: 'PUT', body: JSON.stringify(body) })
    hideLoading()
    alert('Configuración guardada')
  }

  async function deleteSavedTheme(themeId) {
    if (!confirm('¿Eliminar este tema personalizado?')) return
    const updated = savedThemes.filter(st => st.id !== themeId)
    setSavedThemes(updated)
    await api(`/api/clients/${clientId}/settings`, {
      method: 'PUT',
      body: JSON.stringify({ saved_themes: JSON.stringify(updated) }),
    })
    if (selectedThemeId === themeId) setSelectedThemeId('classic')
  }

  if (!clientId || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <div className="text-6xl mb-4 opacity-50">🤖</div>
        <p className="text-lg font-medium">Seleccioná un bot de la lista</p>
        <p className="text-sm">Hacé clic en un bot para ver sus detalles</p>
      </div>
  )
}

  const STATUS_MAP = {
    online: { dot: '🟢', label: 'Conectado', bg: 'bg-green-100 text-green-700' },
    awaiting_scan: { dot: '🟡', label: 'Esperando QR', bg: 'bg-yellow-100 text-yellow-700' },
    starting: { dot: '🔵', label: 'Iniciando...', bg: 'bg-blue-100 text-blue-700' },
    error: { dot: '🔴', label: 'Error', bg: 'bg-red-100 text-red-700' },
  }
  const st = STATUS_MAP[data.status] || { dot: '⚫', label: 'Desconectado', bg: 'bg-gray-100 text-gray-600' }

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={onBack} className="md:hidden text-gray-500 hover:text-gray-700 p-2 -ml-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="flex items-start justify-between flex-1 flex-wrap gap-2">
          <div className="flex items-start gap-3">
            <div>
              <h3 className="text-xl md:text-2xl font-bold">{data.business_name || data.name}</h3>
              <p className="text-gray-500">{data.phone || ''}</p>
            </div>
            <button onClick={handleEdit} className="text-blue-500 hover:text-blue-700 text-sm mt-1" title="Editar bot">✏️</button>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm ${st.bg}`}>
              {st.dot} {st.label}
            </span>
            <button onClick={handleDelete} className="text-red-500 hover:text-red-700 px-2" title="Eliminar">🗑️</button>
          </div>
        </div>
      </div>

      {data.status !== 'online' && (
        <div id="qrSection" data-tour="qrSection" className="bg-white rounded-lg p-4 mb-4">
            <h4 className="font-semibold mb-2">📷 Escaneá el QR con WhatsApp</h4>
            <div className="flex justify-center">
              {qrImage ? (
                <img src={qrImage} alt="QR" className="w-full max-w-64 h-auto aspect-square" />
              ) : (
                <p className="text-gray-400">{data.status === 'awaiting_scan' ? 'Generando QR...' : 'Conectando...'}</p>
              )}
            </div>
          </div>
        )}

        {(data.status === 'offline' || data.status === 'error') && data.phone && (
          <div className={`${data.status === 'error' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-4 mb-4`}>
            <p className={`${data.status === 'error' ? 'text-red-800' : 'text-yellow-800'}`}>
              {data.status === 'error' ? 'El bot tuvo un error.' : 'El bot está desconectado.'} Asegurate de que el número {data.phone} tenga WhatsApp activo.
            </p>
            <button onClick={handleRestart} className="mt-2 bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-yellow-700">
              Reconectar
            </button>
          </div>
        )}

        <div id="productsSection" data-tour="productsSection"><ProductsSection clientId={clientId} products={products} showLoading={showLoading} hideLoading={hideLoading} onRefresh={loadData} /></div>
        <div id="keywordsSection" data-tour="keywordsSection"><KeywordsSection clientId={clientId} keywords={keywords} showLoading={showLoading} hideLoading={hideLoading} onRefresh={loadData} /></div>

        <FeaturesSection clientId={clientId} userPlan={user?.plan || 'free'} showLoading={showLoading} hideLoading={hideLoading} />

        <div id="settingsSection" data-tour="settingsSection" className="bg-white rounded-lg p-4 mb-8">
          <h4 className="font-semibold mb-3">⚙️ Configuración</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Tema de mensajes</label>
              <input type="hidden" id="set-theme" value={selectedThemeId} />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {themes.map(t => {
                  const selected = selectedThemeId === t.id
                  return (
                    <button key={t.id} type="button" onClick={() => { setSelectedThemeId(t.id); setCustomTheme({}) }}
                      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-150 text-center min-h-[80px] ${selected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}>
                      <span className="text-xl leading-none">{t.headerIcon || '📄'}</span>
                      <span className={`text-xs font-medium leading-tight ${selected ? 'text-blue-700' : 'text-gray-600'}`}>{t.name}</span>
                      <span className="text-[9px] text-gray-400 leading-tight line-clamp-2 overflow-hidden">{(t.desc || '').split('·')[0].trim()}</span>
                      {selected && (
                        <span className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        </span>
                      )}
                    </button>
                  )
                })}
                {savedThemes.map(st => {
                  const selected = selectedThemeId === st.id
                  return (
                    <button key={st.id} type="button" onClick={() => { setSelectedThemeId(st.id); setCustomTheme({}) }}
                      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-150 text-center min-h-[80px] ${selected ? 'border-green-500 bg-green-50 shadow-sm' : 'border-green-200 bg-white hover:border-green-300 hover:bg-green-50'}`}>
                      <span className="text-xl leading-none">{st.headerIcon || '📄'}</span>
                      <span className={`text-xs font-medium leading-tight ${selected ? 'text-green-700' : 'text-green-600'}`}>{st.name}</span>
                      <span className="text-[9px] text-gray-400 leading-tight">Personalizado</span>
                      {selected && (
                        <span className="absolute top-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        </span>
                      )}
                      <button type="button" onClick={e => { e.stopPropagation(); deleteSavedTheme(st.id) }}
                        className="absolute bottom-1 right-1 text-red-400 hover:text-red-600 text-[10px] opacity-60 hover:opacity-100">✕</button>
                    </button>
                  )
                })}
                <button type="button" onClick={() => setThemeCreatorOpen(true)}
                  className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all duration-150 text-center min-h-[80px]">
                  <span className="text-lg leading-none text-gray-400">+</span>
                  <span className="text-[10px] font-medium text-gray-400 leading-tight">Crear tema</span>
                </button>
              </div>
              {(() => {
                const base = themes.find(t => t.id === selectedThemeId) || savedThemes.find(t => t.id === selectedThemeId)
                if (!base) return null
                const effective = { ...base, ...customTheme }
                const botName = data?.name || data?.business_name || 'Mi Bot'
                const h = effective.headerIcon ? `${effective.headerIcon} ` : ''
                const p = effective.titlePrefix ? `${effective.titlePrefix} ` : ''
                const s = effective.titleSuffix ? ` ${effective.titleSuffix}` : ''
                const header = `${h}*${p}${botName}${s}*`
                const sep = effective.separator || ''
                const bullet = effective.productBullet || '•'
                const conn = effective.productConnector || '—'
                const accent = effective.accentEmoji || '💬'
                const receipt = effective.orderReceiptIcon || '✅'
                const schedule = effective.scheduleIcon || '🕐'
                const contact = effective.contactIcon || '📞'
                const previewLines = [
                  header,
                  sep && ` ${sep}`,
                  '',
                  ` ${p || ''}*Encargos por mayor*${s ? ` ${s}` : ''}`,
                  '',
                  ` 1 ${p || '🍕'} Productos`,
                  ` 2 ${receipt} Pedido`,
                  ` 3 ${schedule} Horarios`,
                  ` 4 ${contact} Contacto`,
                  '',
                  ` ${sep}`,
                  '',
                  ` ${bullet} Prepizza ${conn} $700`,
                  ` ${bullet} Pizzetas x6 ${conn} $1200`,
                  '',
                  `${accent} _Respondé 2 para pedir_`,
                ].filter(Boolean).join('\n')
                const bc = effective.borderChar
                const finalPreview = bc ? (() => {
                  const lines = previewLines.split('\n')
                  let maxLen = 0
                  for (const l of lines) {
                    const plain = l.replace(/[*_~]/g, '')
                    if (plain.length > maxLen) maxLen = plain.length
                  }
                  const width = Math.min(maxLen + 4, 44)
                  const border = bc.length === 1 ? bc.repeat(width) : bc
                  const wrapped = lines.map(l => `  ${l}`).join('\n')
                  return `${border}\n${wrapped}\n${border}`
                })() : previewLines
                return (
                  <>
                    <div className="mt-3 bg-gray-50 rounded-lg p-4 overflow-x-auto max-h-48 overflow-y-auto">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Vista previa</p>
                        <button type="button" onClick={() => setShowCustomizer(!showCustomizer)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                          {showCustomizer ? '✕ Cerrar' : '✎ Personalizar'}
                        </button>
                      </div>
                      <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{finalPreview}</pre>
                    </div>
                    {showCustomizer && (
                      <div className="mt-3 bg-white border border-gray-200 rounded-lg p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Personalizar tema</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {[
                            ['headerIcon', 'Ícono principal'],
                            ['separator', 'Separador'],
                            ['titlePrefix', 'Prefijo título'],
                            ['titleSuffix', 'Sufijo título'],
                            ['accentEmoji', 'Emoji acento'],
                            ['productBullet', 'Bullet productos'],
                            ['productConnector', 'Conector precio'],
                            ['orderReceiptIcon', 'Ícono pedido ✅'],
                            ['orderNoteIcon', 'Ícono nota'],
                            ['scheduleIcon', 'Ícono horario'],
                            ['contactIcon', 'Ícono contacto'],
                            ['borderChar', 'Borde (vacio=no)'],
                          ].map(([key, label]) => (
                            <div key={key}>
                              <label className="block text-[10px] text-gray-400 font-medium mb-0.5">{label}</label>
                              <div className="relative flex gap-1">
                                <input type="text" value={customTheme[key] !== undefined ? customTheme[key] : (base[key] ?? '')}
                                  onChange={e => setCustomTheme(prev => ({ ...prev, [key]: e.target.value }))}
                                  placeholder={base[key] || ''}
                                  className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs placeholder:text-gray-300" />
                                <button type="button" onClick={() => setEmojiPickerField(emojiPickerField === key ? null : key)}
                                  className="px-1.5 py-1 text-xs border border-gray-200 rounded hover:bg-gray-100 text-gray-500">
                                  😀
                                </button>
                                {emojiPickerField === key && (
                                  <EmojiPicker onSelect={e => {
                                    setCustomTheme(prev => ({ ...prev, [key]: (prev[key] || base[key] || '') + e }))
                                    setEmojiPickerField(null)
                                  }} onClose={() => setEmojiPickerField(null)} />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">Horario</label>
              <textarea id="set-horario" className="w-full border rounded px-3 py-2 text-sm" defaultValue={settings.horario || ''} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">Contacto</label>
              <textarea id="set-contacto" className="w-full border rounded px-3 py-2 text-sm" defaultValue={settings.contacto || ''} />
            </div>
            <button onClick={saveSettings} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
              Guardar todo
            </button>
          </div>
        </div>
      </div>
      {themeCreatorOpen && (
        <ThemeCreator clientId={clientId} onSave={loadData} onClose={() => setThemeCreatorOpen(false)}
          showLoading={showLoading} hideLoading={hideLoading} />
      )}
    </div>
  )
}

const ProductsSection = memo(function ProductsSection({ clientId, products, showLoading, hideLoading, onRefresh }) {
  async function deleteProduct(productId) {
    if (!confirm('¿Eliminar este producto?')) return
    showLoading('Eliminando...')
    await api(`/api/clients/${clientId}/products/${productId}`, { method: 'DELETE' })
    onRefresh()
    hideLoading()
  }

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))]
  const grouped = {}
  for (const p of products) {
    const cat = p.category || 'General'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(p)
  }

  return (
    <div className="bg-white rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold">📋 Productos</h4>
        <button onClick={() => {
          const btn = document.getElementById('productModalTrigger')
          btn.dataset.clientId = clientId
          btn.dataset.editId = ''
          btn.dataset.existingCategories = JSON.stringify(categories)
          btn.click()
        }} className="text-blue-600 text-sm hover:underline">+ Agregar</button>
      </div>
      <div>
        {products.length === 0 ? (
          <p className="text-gray-400 text-sm">Sin productos.</p>
        ) : Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="mb-3 last:mb-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{cat}</p>
            {items.map(p => (
              <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <div className="min-w-0 flex-1 mr-2">
                  <span className="font-medium text-sm">{p.emoji} {p.name}</span>
                  {p.price && <span className="text-gray-500 text-sm"> ${p.price}</span>}
                  {p.description && <p className="text-xs text-gray-400 truncate">{p.description}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => {
                    const btn = document.getElementById('productModalTrigger')
                    btn.dataset.clientId = clientId
                    btn.dataset.editId = p.id
                    btn.dataset.editName = p.name
                    btn.dataset.editPrice = p.price || ''
                    btn.dataset.editEmoji = p.emoji || '🔹'
                    btn.dataset.editDesc = p.description || ''
                    btn.dataset.editCategory = p.category || 'General'
                    btn.dataset.existingCategories = JSON.stringify(categories)
                    btn.click()
                  }} className="text-blue-400 hover:text-blue-600 text-xs">✏️</button>
                  <button onClick={() => deleteProduct(p.id)} className="text-red-400 hover:text-red-600 text-xs">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
})

const KeywordsSection = memo(function KeywordsSection({ clientId, keywords, showLoading, hideLoading, onRefresh }) {
  async function deleteKeyword(kwId) {
    if (!confirm('¿Eliminar esta palabra clave?')) return
    showLoading('Eliminando...')
    await api(`/api/clients/${clientId}/keywords/${kwId}`, { method: 'DELETE' })
    onRefresh()
    hideLoading()
  }

  return (
    <div className="bg-white rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold">🔑 Palabras clave (autorespuesta)</h4>
        <button onClick={() => {
          const btn = document.getElementById('keywordModalTrigger')
          btn.dataset.clientId = clientId
          btn.dataset.editId = ''
          btn.click()
        }} className="text-blue-600 text-sm hover:underline">+ Agregar</button>
      </div>
      <div>
        {keywords.length === 0 ? (
          <p className="text-gray-400 text-sm">Sin palabras clave.</p>
        ) : keywords.map(k => (
          <div key={k.id} className="flex items-start justify-between py-2 border-b last:border-0">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{k.keyword}</span>
                {k.is_active ? <span className="text-xs text-green-500">activa</span> : <span className="text-xs text-gray-400">inactiva</span>}
              </div>
              <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{k.response}</p>
            </div>
            <div className="flex gap-2 ml-2 shrink-0">
              <button onClick={() => {
                const btn = document.getElementById('keywordModalTrigger')
                btn.dataset.clientId = clientId
                btn.dataset.editId = k.id
                btn.dataset.editKeyword = k.keyword
                btn.dataset.editResponse = k.response
                btn.dataset.editActive = k.is_active
                btn.click()
              }} className="text-blue-400 hover:text-blue-600 text-sm">✏️</button>
              <button onClick={() => deleteKeyword(k.id)} className="text-red-400 hover:text-red-600 text-sm">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
