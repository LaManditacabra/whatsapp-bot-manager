const THEMES = [

  // ─── Tema por defecto ─────────────────────────────────────
  {
    id: 'classic',
    name: 'Clásico',
    desc: '🕊️ Paloma · separadores ━━━ · estilo original',
    headerIcon: '🕊️',
    separator: '━━━━━━━━━━━━━━',
    bullet: '•',
    titlePrefix: '🍕',
    titleSuffix: '🍕',
    accentEmoji: '💬',
    productBullet: '•',
    productConnector: '—',
    orderReceiptIcon: '✅',
    orderNoteIcon: '🔔',
    scheduleIcon: '🕐',
    contactIcon: '📍',
    borderChar: null,
  },

  // ─── Tema moderno-profesional ────────────────────────────
  {
    id: 'modern',
    name: 'Moderno',
    desc: '◇ Rombo · separadores ─── · estilo profesional',
    headerIcon: '◇',
    separator: '────────────────',
    bullet: '›',
    titlePrefix: '▸',
    titleSuffix: '',
    accentEmoji: '📱',
    productBullet: '›',
    productConnector: '→',
    orderReceiptIcon: '✔️',
    orderNoteIcon: '📬',
    scheduleIcon: '⏰',
    contactIcon: '📞',
    borderChar: null,
  },

  // ─── Tema ultra-simple ──────────────────────────────────
  {
    id: 'minimal',
    name: 'Minimal',
    desc: '── Sin íconos · solo texto funcional',
    headerIcon: '',
    separator: '───',
    bullet: '-',
    titlePrefix: '',
    titleSuffix: '',
    accentEmoji: '',
    productBullet: '-',
    productConnector: ':',
    orderReceiptIcon: '[OK]',
    orderNoteIcon: '[i]',
    scheduleIcon: '',
    contactIcon: '',
    borderChar: null,
  },

  // ─── Tema audaz ─────────────────────────────────────────
  {
    id: 'bold',
    name: 'Osado',
    desc: '★彡 Estrella fugaz · separadores ████ · llamativo',
    headerIcon: '★彡',
    separator: '████████████████',
    bullet: '◆',
    titlePrefix: '🔥',
    titleSuffix: '🔥',
    accentEmoji: '📞',
    productBullet: '◆',
    productConnector: '➜',
    orderReceiptIcon: '✅',
    orderNoteIcon: '🔊',
    scheduleIcon: '⏳',
    contactIcon: '📍',
    borderChar: '█',
  },

  // ─── Tema refinado ──────────────────────────────────────
  {
    id: 'elegant',
    name: 'Elegante',
    desc: '✦ Estrella · separadores ═══ · estilo fino',
    headerIcon: '✦',
    separator: '════════════════',
    bullet: '⟡',
    titlePrefix: '✦',
    titleSuffix: '✦',
    accentEmoji: '✉️',
    productBullet: '⟡',
    productConnector: '→',
    orderReceiptIcon: '✓',
    orderNoteIcon: '✉',
    scheduleIcon: '🕘',
    contactIcon: '✉',
    borderChar: '═',
  },

  // ─── Tema oceánico ──────────────────────────────────────
  {
    id: 'ocean',
    name: 'Oceano',
    desc: '🌊 Olas · separadores ~~~~~~~~ · vibra marina',
    headerIcon: '🌊',
    separator: '~~~~~~~~~~~~~~~~',
    bullet: '・',
    titlePrefix: '🌊',
    titleSuffix: '',
    accentEmoji: '💙',
    productBullet: '・',
    productConnector: '→',
    orderReceiptIcon: '✅',
    orderNoteIcon: '📬',
    scheduleIcon: '⏰',
    contactIcon: '📍',
    borderChar: null,
  },

  // ─── Tema atardecer ─────────────────────────────────────
  {
    id: 'sunset',
    name: 'Atardecer',
    desc: '🌅 Sol · separadores ☼☼☼☼☼☼☼ · tonos cálidos',
    headerIcon: '🌅',
    separator: '☼☼☼☼☼☼☼☼☼☼☼☼☼☼☼☼',
    bullet: '☼',
    titlePrefix: '☀️',
    titleSuffix: '',
    accentEmoji: '🌇',
    productBullet: '☼',
    productConnector: '→',
    orderReceiptIcon: '✔️',
    orderNoteIcon: '✉️',
    scheduleIcon: '⏳',
    contactIcon: '📞',
    borderChar: null,
  },

  // ─── Tema neón ──────────────────────────────────────────
  {
    id: 'neon',
    name: 'Neón',
    desc: '💜 Purple · separadores ▬▬▬ · estilo cyberpunk',
    headerIcon: '💜',
    separator: '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬',
    bullet: '✦',
    titlePrefix: '⚡',
    titleSuffix: '⚡',
    accentEmoji: '📱',
    productBullet: '✦',
    productConnector: '➤',
    orderReceiptIcon: '✅',
    orderNoteIcon: '🔊',
    scheduleIcon: '⏳',
    contactIcon: '📍',
    borderChar: '▬',
  },

  // ─── Tema naturaleza ────────────────────────────────────
  {
    id: 'nature',
    name: 'Naturaleza',
    desc: '🌿 Hoja · separadores ┈┈┈┈ · estilo orgánico',
    headerIcon: '🌿',
    separator: '┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈',
    bullet: '•',
    titlePrefix: '🌱',
    titleSuffix: '🌱',
    accentEmoji: '💚',
    productBullet: '•',
    productConnector: '→',
    orderReceiptIcon: '✅',
    orderNoteIcon: '💌',
    scheduleIcon: '⏰',
    contactIcon: '📞',
    borderChar: null,
  },

  // ─── Tema real / lujo ───────────────────────────────────
  {
    id: 'royal',
    name: 'Real',
    desc: '👑 Corona · separadores ═══✧═══ · estilo lujo',
    headerIcon: '👑',
    separator: '══════✧══════',
    bullet: '✦',
    titlePrefix: '✨',
    titleSuffix: '✨',
    accentEmoji: '💎',
    productBullet: '✦',
    productConnector: '➜',
    orderReceiptIcon: '✓',
    orderNoteIcon: '✉',
    scheduleIcon: '🕰️',
    contactIcon: '✉',
    borderChar: '═',
  },
]

export function getTheme(themeId) {
  return THEMES.find(t => t.id === themeId) || THEMES[0]
}

export function getThemeList() {
  return THEMES.map(t => ({ id: t.id, name: t.name, desc: t.desc, headerIcon: t.headerIcon }))
}

export default THEMES
