import { useState, useEffect, useRef } from 'react'
import { api } from '../api'

const STEPS = [
  {
    icon: '👋',
    title: 'Bienvenido a BotAr',
    desc: 'Voy a guiarte paso a paso para crear tu primer bot. Solo seguí las indicaciones en pantalla.',
    target: null,
    waitFor: null,
  },
  {
    icon: '➕',
    title: 'Paso 1: Crear un bot',
    desc: 'Presioná el botón "Nuevo Bot" de arriba para empezar.',
    target: 'createBotBtn',
    waitFor: 'openModal',
    hint: 'Hacé clic en el botón azul "Nuevo Bot"',
  },
  {
    icon: '✏️',
    title: 'Paso 2: Completar los datos',
    desc: 'Escribí el nombre del negocio y el número de WhatsApp (ej: 5491112345678), después presioná "Guardar".',
    target: 'clientModalName',
    waitFor: 'closeModal',
    hint: 'Completá y presioná "Guardar"',
  },
  {
    icon: '📷',
    title: 'Paso 3: Conectar WhatsApp',
    desc: 'Esperá que aparezca el código QR y escanealo desde tu WhatsApp: Ajustes → Dispositivos vinculados.',
    target: 'qrSection',
    waitFor: 'online',
    hint: 'Escaneá el QR con WhatsApp',
  },
  {
    icon: '📋',
    title: 'Paso 4: Agregar productos',
    desc: 'Presioná "+ Agregar" en Productos y añadí lo que vendés.',
    target: 'productsSection',
    waitFor: 'products',
    hint: 'Agregá al menos un producto',
  },
  {
    icon: '🔑',
    title: 'Paso 5: Palabras clave',
    desc: 'Presioná "+ Agregar" en Palabras clave para crear respuestas automáticas.',
    target: 'keywordsSection',
    waitFor: null,
    hint: 'Opcional, podés saltar este paso',
  },
  {
    icon: '⚙️',
    title: 'Paso 6: Configuración',
    desc: 'En Configuración podés cambiar el horario y contacto que muestra el bot.',
    target: 'settingsSection',
    waitFor: null,
    hint: 'Opcional, podés editarlo después',
  },
  {
    icon: '🚀',
    title: '¡Bot listo!',
    desc: 'Tu bot ya está funcionando. Los clientes te escriben al WhatsApp y el bot responde solo.',
    target: null,
    waitFor: null,
  },
]

function getEl(id) {
  return document.getElementById(id) || document.querySelector(`[data-tour="${id}"]`)
}

function addRing(el) {
  if (el) el.classList.add('ring-4', 'ring-blue-400', 'ring-offset-2', 'rounded-xl')
}

function removeRing(el) {
  if (el) el.classList.remove('ring-4', 'ring-blue-400', 'ring-offset-2', 'rounded-xl')
}

export default function TourGuide({ onClose }) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState(null)
  const [waiting, setWaiting] = useState(false)
  const [waitMsg, setWaitMsg] = useState('')
  const clientIdRef = useRef(null)
  const prevTargetRef = useRef(null)
  const s = STEPS[step]
  const isLast = step === STEPS.length - 1
  const progress = ((step + 1) / STEPS.length) * 100

  useEffect(() => {
    localStorage.setItem('botar_welcome_done', 'true')
  }, [])

  // Cleanup old ring + highlight new target (retry for async DOM)
  useEffect(() => {
    if (prevTargetRef.current) removeRing(getEl(prevTargetRef.current))
    prevTargetRef.current = s.target
    setRect(null)
    if (!s.target) return

    let cancelled = false
    let retries = 0

    function tryHighlight() {
      if (cancelled) return
      const el = getEl(s.target)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        addRing(el)
        setRect(el.getBoundingClientRect())
      } else if (retries < 20) {
        retries++
        setTimeout(tryHighlight, 300)
      }
    }

    tryHighlight()
    return () => { cancelled = true; removeRing(getEl(s.target)) }
  }, [step, s.target])

  // Detect modal open → advance to step 2
  useEffect(() => {
    if (s.waitFor !== 'openModal') return
    const interval = setInterval(() => {
      if (document.getElementById('clientModal')) {
        clearInterval(interval)
        setStep(2)
      }
    }, 200)
    return () => clearInterval(interval)
  }, [step, s.waitFor])

  // Detect modal close + grab new client ID
  useEffect(() => {
    if (s.waitFor !== 'closeModal') return
    setWaiting(true)
    setWaitMsg('Esperando que guardes el bot...')
    const interval = setInterval(async () => {
      if (!document.getElementById('clientModal')) {
        clearInterval(interval)
        setWaiting(false)
        try {
          const clients = await api('/api/clients')
          if (clients.length > 0) {
            clientIdRef.current = clients[0].id
            setStep(3)
          } else {
            setWaitMsg('Error: el bot no se creó. Intentá de nuevo.')
          }
        } catch {
          setWaitMsg('Error de conexión. ¿El servidor está andando?')
        }
      }
    }, 300)
    return () => clearInterval(interval)
  }, [step, s.waitFor])

  // Wait for bot to come online
  useEffect(() => {
    if (s.waitFor !== 'online') return
    const id = clientIdRef.current
    if (!id) { setWaiting(false); return }
    setWaiting(true)
    setWaitMsg('Esperando que escanees el QR...')
    const interval = setInterval(async () => {
      try {
        const d = await api(`/api/clients/${id}/status`)
        if (d.status === 'online') {
          clearInterval(interval)
          setWaiting(false)
          setStep(4)
        }
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [step, s.waitFor])

  // Wait for first product
  useEffect(() => {
    if (s.waitFor !== 'products') return
    const id = clientIdRef.current
    if (!id) return
    setWaiting(true)
    setWaitMsg('Agregá un producto para continuar...')
    const interval = setInterval(async () => {
      try {
        const products = await api(`/api/clients/${id}/products`)
        if (products.length > 0) {
          clearInterval(interval)
          setWaiting(false)
          setStep(5)
        }
      } catch {}
    }, 1500)
    return () => clearInterval(interval)
  }, [step, s.waitFor])

  function next() {
    if (isLast) onClose()
    else setStep(s => s + 1)
  }

  function prev() {
    if (step > 0) setStep(s => s - 1)
  }

  // Center modal steps (welcome / done)
  if (!s.target) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
          <div className="h-1.5 bg-gray-100">
            <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="p-8">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">{s.icon}</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">{s.title}</h2>
              <p className="text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
            <div className="flex items-center justify-between mt-8">
              <div className="text-sm text-gray-400">{step + 1} / {STEPS.length}</div>
              <div className="flex gap-3">
                {!isLast && <button onClick={() => onClose()} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 font-medium min-w-[44px]">Omitir</button>}
                <button onClick={next} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium shadow-sm min-w-[44px]">
                  {isLast ? 'Finalizar' : 'Siguiente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Target steps — no backdrop overlay (would fight with modals), just tooltip + ring
  return (
    <>{rect && <Tooltip
      step={step} total={STEPS.length} s={s}
      rect={rect} waiting={waiting} waitMsg={waitMsg}
      onNext={next} onPrev={prev} onSkip={() => onClose()}
      canGoBack={step > 0}
    />}</>
  )
}

function Tooltip({ step, total, s, rect, waiting, waitMsg, onNext, onPrev, onSkip, canGoBack }) {
  return (
    <>
      {/* Mobile: bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-gray-200 shadow-2xl px-4 py-3 sm:hidden">
        <div className="flex items-start gap-3">
          <span className="text-xl shrink-0 mt-0.5">{s.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-800 text-sm">{s.title}</h3>
              <span className="text-[10px] text-gray-400">{step + 1}/{total}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
            {s.hint && !waiting && <p className="text-xs text-blue-600 font-medium mt-1">{s.hint}</p>}
            {waiting && (
              <p className="text-xs text-yellow-600 font-medium mt-1 flex items-center gap-1">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                {waitMsg}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onSkip} className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-2">×</button>
            {!waiting && (
              <button onClick={onNext} className="px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm">
                Saltar
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Desktop: floating card bottom-center */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-white rounded-xl shadow-2xl border border-gray-200 px-5 py-4 hidden sm:block max-w-xl w-full mx-4">
        <div className="flex items-center gap-4">
          <span className="text-2xl shrink-0">{s.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-800 text-sm">{s.title}</h3>
              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{step + 1}/{total}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
            {s.hint && !waiting && <p className="text-xs text-blue-600 font-medium mt-1">{s.hint}</p>}
            {waiting && (
              <p className="text-xs text-yellow-600 font-medium mt-1 flex items-center gap-1">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                {waitMsg}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onSkip} className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1.5">Omitir</button>
            {!waiting && canGoBack && <button onClick={onPrev} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 font-medium">Anterior</button>}
            {!waiting && (
              <button onClick={onNext} className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm">
                Saltar paso
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
