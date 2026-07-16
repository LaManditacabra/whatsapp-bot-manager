export default async function contacto(sock, msg) {
  const jid = msg.key.remoteJid;
  await sock.sendMessage(jid, {
    text: [
      '🕊️ *El Palomo PrePizzas*',
      '━━━━━━━━━━━━━━',
      '',
      '📍 Coronda 1146',
      '📱 11 4563-6983',
      '📧 erikpadilla592@gmail.com',
      '🌐 IG: @padillaerik',
    ].join('\n'),
  });
}
