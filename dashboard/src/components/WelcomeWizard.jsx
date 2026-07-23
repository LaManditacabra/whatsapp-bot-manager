import { useState, useEffect } from 'react'

const STEPS = [
  {
    icon: '👋',
    title: 'Bienvenido a BotAr',
    desc: 'Gestioná tus bots de WhatsApp desde un solo lugar. En unos pasos vas a tener tu primer bot funcionando.',
  },
  {
    icon: '➕',
    title: 'Crear un bot',
    desc: 'Andá a "Mis Bots" y hacé clic en "Nuevo Bot". Completá el nombre del negocio y el número de WhatsApp (ej: 5491112345678).',
  },
  {
    icon: '📷',
    title: 'Conectar WhatsApp',
    desc: 'Después de crear el bot, escaneá el código QR con WhatsApp desde tu celular: Ajustes → Dispositivos vinculados → Vincular un dispositivo.',
  },
  {
    icon: '📋',
    title: 'Agregar productos',
    desc: 'En el detalle del bot, hacé clic en "+ Agregar" en la sección Productos. Poné nombre, precio y emoji para cada producto.',
  },
  {
    icon: '🔑',
    title: 'Palabras clave',
    desc: 'Agregá respuestas automáticas en "Palabras clave". Ej: si alguien escribe "precio", el bot responde automáticamente lo que configures.',
  },
  {
    icon: '⚙️',
    title: 'Configurar bot',
    desc: 'En la sección "Configuración" del bot podés cambiar el horario y los datos de contacto que el bot va a mostrar.',
  },
  {
    icon: '🚀',
    title: '¡Listo!',
    desc: 'Tu bot ya está funcionando. Los clientes te escriben al WhatsApp y el bot responde automáticamente con productos, horarios y más.',
  },
]

export default function WelcomeWizard({ userName, onClose }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    localStorage.setItem('botar_welcome_done', 'true')
  }, [])

  const isLast = step === STEPS.length - 1
  const progress = ((step + 1) / STEPS.length) * 100

  function next() {
    if (isLast) onClose()
    else setStep(s => s + 1)
  }

  function prev() {
    if (step > 0) setStep(s => s - 1)
  }

  const s = STEPS[step]

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="h-1.5 bg-gray-100">
          <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }}></div>
        </div>

        <div className="p-8">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">{s.icon}</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{s.title}</h2>
            <p className="text-gray-500 leading-relaxed">{s.desc}</p>
          </div>

          <div className="flex items-center justify-between mt-8">
            <div className="text-sm text-gray-400">
              {step + 1} / {STEPS.length}
            </div>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors">
                Omitir
              </button>
              {step > 0 && (
                <button onClick={prev}
                  className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium transition-all">
                  Anterior
                </button>
              )}
              <button onClick={next}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium transition-all shadow-sm">
                {isLast ? 'Comenzar' : 'Siguiente'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
