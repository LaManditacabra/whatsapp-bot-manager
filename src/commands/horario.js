export default async function horario(sock, msg) {
  const jid = msg.key.remoteJid;
  await sock.sendMessage(jid, {
    text: [
      '🕊️ *El Palomo PrePizzas*',
      '━━━━━━━━━━━━━━',
      '',
      '🕐 *Horarios de atención*',
      '',
      'Lunes a Viernes: 9:00 — 20:00',
      'Sábados: 10:00 — 18:00',
      'Domingos: Cerrado',
      '',
      '📞 Consultas al privado.',
    ].join('\n'),
  });
}
