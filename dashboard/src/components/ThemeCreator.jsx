import { useState } from 'react'
import { api } from '../api'
import EmojiPicker from './EmojiPicker'

const FIELDS = [
  ['headerIcon', 'Ícono principal'],
  ['separator', 'Separador'],
  ['bullet', 'Bullet'],
  ['titlePrefix', 'Prefijo título'],
  ['titleSuffix', 'Sufijo título'],
  ['accentEmoji', 'Emoji acento'],
  ['productBullet', 'Bullet productos'],
  ['productConnector', 'Conector precio'],
  ['orderReceiptIcon', 'Ícono pedido'],
  ['orderNoteIcon', 'Ícono nota'],
  ['scheduleIcon', 'Ícono horario'],
  ['contactIcon', 'Ícono contacto'],
  ['borderChar', 'Borde (vacio=no)'],
]

const DEFAULT_THEME = {
  headerIcon: '✨',
  separator: '════════════════',
  bullet: '•',
  titlePrefix: '',
  titleSuffix: '',
  accentEmoji: '💬',
  productBullet: '•',
  productConnector: '—',
  orderReceiptIcon: '✅',
  orderNoteIcon: '📩',
  scheduleIcon: '🕐',
  contactIcon: '📞',
  borderChar: '',
}

export default function ThemeCreator({ clientId, onSave, onClose, showLoading, hideLoading }) {
  const [name, setName] = useState('')
  const [theme, setTheme] = useState({ ...DEFAULT_THEME })
  const [error, setError] = useState('')
  const [emojiPickerField, setEmojiPickerField] = useState(null)

  function setVal(key, val) {
    setTheme(prev => ({ ...prev, [key]: val }))
  }

  function buildPreview() {
    const t = theme
    const h = t.headerIcon ? `${t.headerIcon} ` : ''
    const p = t.titlePrefix ? `${t.titlePrefix} ` : ''
    const s = t.titleSuffix ? ` ${t.titleSuffix}` : ''
    const header = `${h}*${p}Mi Bot${s}*`
    const sep = t.separator || ''
    const bullet = t.productBullet || '•'
    const conn = t.productConnector || '—'
    const accent = t.accentEmoji || '💬'
    const receipt = t.orderReceiptIcon || '✅'
    const schedule = t.scheduleIcon || '🕐'
    const contact = t.contactIcon || '📞'
    const lines = [
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
    const bc = t.borderChar
    if (bc) {
      const lns = lines.split('\n')
      let maxLen = 0
      for (const l of lns) {
        const plain = l.replace(/[*_~]/g, '')
        if (plain.length > maxLen) maxLen = plain.length
      }
      const width = Math.min(maxLen + 4, 44)
      const border = bc.length === 1 ? bc.repeat(width) : bc
      return `${border}\n${lns.map(l => `  ${l}`).join('\n')}\n${border}`
    }
    return lines
  }

  async function handleSave() {
    if (!name.trim()) { setError('Poné un nombre para tu tema'); return }
    setError('')
    showLoading('Guardando tema...')
    try {
      const s = await api(`/api/clients/${clientId}/settings`, { method: 'GET' })
      const saved = s.saved_themes ? JSON.parse(s.saved_themes) : []
      const id = 'custom_' + Date.now().toString(36)
      saved.push({ id, name: name.trim(), ...theme })
      await api(`/api/clients/${clientId}/settings`, {
        method: 'PUT',
        body: JSON.stringify({ saved_themes: JSON.stringify(saved) }),
      })
      await api('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({
          type: 'custom_theme',
          title: `Nuevo tema personalizado: ${name.trim()}`,
          message: `El usuario creó el tema "${name.trim()}" con ícono ${theme.headerIcon || 'ninguno'}`,
          data: { theme: { name: name.trim(), ...theme } },
        }),
      })
      onSave()
      onClose()
    } catch (e) {
      setError('Error al guardar: ' + e.message)
    }
    hideLoading()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-bold">🎨 Crear tema personalizado</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">&times;</button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Nombre del tema</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Ej: Mi Tema Oscuro"
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {FIELDS.map(([key, label]) => (
              <div key={key}>
                <label className="block text-[10px] text-gray-400 font-medium mb-0.5">{label}</label>
                <div className="relative flex gap-1">
                  <input type="text" value={theme[key]} onChange={e => setVal(key, e.target.value)}
                    placeholder={DEFAULT_THEME[key]}
                    className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs" />
                  <button type="button" onClick={() => setEmojiPickerField(emojiPickerField === key ? null : key)}
                    className="px-1.5 py-1 text-xs border border-gray-200 rounded hover:bg-gray-100 text-gray-500">
                    😀
                  </button>
                  {emojiPickerField === key && (
                    <EmojiPicker onSelect={e => {
                      setVal(key, theme[key] + e)
                      setEmojiPickerField(null)
                    }} onClose={() => setEmojiPickerField(null)} />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Vista previa</p>
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{buildPreview()}</pre>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg border border-gray-200">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Guardar tema</button>
          </div>
        </div>
      </div>
    </div>
  )
}
