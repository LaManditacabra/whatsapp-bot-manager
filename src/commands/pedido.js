export default async function pedido(sock, msg, args) {
  const jid = msg.key.remoteJid;

  if (args.length === 0) {
    await sock.sendMessage(jid, {
      text: [
        '🕊️ *El Palomo PrePizzas*',
        '━━━━━━━━━━━━━━',
        '',
        '🛵 *Hacé tu pedido*',
        '',
        'Usá: `!pedido [producto] [cantidad]`',
        '',
        'Ej: `!pedido 2 prepizzas`',
        'Ej: `!pedido 3 pizzetas x6`',
      ].join('\n'),
    });
    return;
  }

  const pedido = args.join(' ');

  await sock.sendMessage(jid, {
    text: [
      '🕊️ *El Palomo PrePizzas*',
      '━━━━━━━━━━━━━━',
      '',
      '✅ *Pedido recibido*',
      '',
      `> ${pedido}`,
      '',
      '🔔 Te confirmamos por este medio.',
      '💬 Ante cualquier duda, consultános.',
    ].join('\n'),
  });
}
