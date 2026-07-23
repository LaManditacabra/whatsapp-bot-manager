import { useState, useRef, useEffect } from 'react'

const EMOJIS = [
  '🕊️','✨','⭐','🌟','💫','⚡','🔥','💥','🌈','🌊',
  '🌅','🌿','🌸','🌺','🌻','🍀','🎯','🎨','🎭','💎',
  '👑','💜','💙','💚','💛','🧡','❤️','🤍','🖤','💝',
  '💬','💭','🗨️','💌','📩','📧','📱','💻','🖥️','📟',
  '📞','📠','📲','🔔','🔕','🎵','🎶','🎤','🎧','📻',
  '🔊','🔇','📢','📣','💡','🔦','🏮','🕯️','🔑','🔒',
  '🔓','🔐','🗝️','⚙️','🔧','🔨','🛠️','🔩','📦','🎁',
  '🛍️','🛒','🛵','🚗','🚚','🚛','✈️','🚀','🏠','🏪',
  '🏢','🏬','📌','📍','📅','📆','🕐','🕑','🕒','🕓',
  '🕔','🕕','🕖','🕗','🕘','🕙','🕚','🕛','⏰','⌚',
  '⏳','⌛','✅','❌','❓','❗','➕','➖','➗','✖️',
  '🟢','🔴','🟡','🟠','🟣','⚪','🟤','🔵','◻️','◼️',
  '◽','◾','▪️','▫️','🔹','🔸','🔶','🔷','🟩','🟥',
  '🟨','🟧','🟪','⬛','⬜','🔲','🔳','❄️','☀️','🌙',
  '☁️','⛅','🌤️','🌦️','🌧️','⛈️','🌩️','🌪️','💧','☔',
  '🍕','🍔','🌭','🌮','🌯','🥗','🥘','🍲','🍜','🍝',
  '🥩','🍗','🍖','🥙','🧆','🥚','🍳','🥞','🧇','🥓',
  '🍟','🍿','🥜','🌰','🍞','🥐','🥖','🥨','🧀','🥛',
  '☕','🍵','🧃','🥤','🍺','🍻','🥂','🍷','🥃','🍸',
  '🍹','🧉','🍾','🧊','🥄','🔪','🍽️','🍴','🥣','🧂',
  '🥢','🫖','🫗','🍶','🍚','🍛','🍙','🍘','🥟','🦐',
  '🦞','🦀','🐟','🐠','🐡','🦈','🐙','🦑',
]

const CATEGORIES = [
  { name: 'Iconos', ico: '✨', start: 0, end: 21 },
  { name: 'Corazones', ico: '💝', start: 21, end: 31 },
  { name: 'Chat', ico: '💬', start: 31, end: 41 },
  { name: 'Audio', ico: '🎵', start: 41, end: 51 },
  { name: 'Herramientas', ico: '⚙️', start: 51, end: 61 },
  { name: 'Compras', ico: '🛒', start: 61, end: 71 },
  { name: 'Ubicación', ico: '📍', start: 71, end: 81 },
  { name: 'Tiempo', ico: '🕐', start: 81, end: 91 },
  { name: 'Símbolos', ico: '✅', start: 91, end: 101 },
  { name: 'Formas', ico: '🔵', start: 101, end: 116 },
  { name: 'Clima', ico: '☀️', start: 116, end: 127 },
  { name: 'Comida', ico: '🍕', start: 127 },
]

export default function EmojiPicker({ onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(-1)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const filtered = search
    ? EMOJIS.filter(e => e.includes(search))
    : (category >= 0
        ? EMOJIS.slice(CATEGORIES[category].start, CATEGORIES[category].end)
        : EMOJIS)

  return (
    <div ref={ref} className="absolute z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 w-72" style={{ bottom: '100%', right: 0, marginBottom: 4 }}>
      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Buscar emoji..."
        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs mb-2" />
      <div className="flex gap-1 overflow-x-auto pb-2 mb-2 border-b border-gray-100">
        <button type="button" onClick={() => { setCategory(-1); setSearch('') }}
          className={`text-xs px-2 py-1 rounded-lg whitespace-nowrap ${category === -1 && !search ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>Todos</button>
        {CATEGORIES.map((c, i) => (
          <button key={c.name} type="button" onClick={() => { setCategory(i); setSearch('') }}
            className={`text-xs px-2 py-1 rounded-lg whitespace-nowrap ${category === i && !search ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>{c.ico}</button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-0.5 max-h-48 overflow-y-auto">
        {filtered.map((e, i) => (
          <button key={e + i} type="button" onClick={() => { onSelect(e); onClose() }}
            className="text-lg hover:bg-gray-100 rounded p-0.5 transition-colors">{e}</button>
        ))}
      </div>
    </div>
  )
}
