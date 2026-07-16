export default async function help(sock, msg) {
  const jid = msg.key.remoteJid;

  await sock.sendMessage(jid, {
    text: [
      '🕊️ *El Palomo PrePizzas*',
      '',
      '🍕 *Encargos por mayor* 🍕',
      '',
      `1 \u{1F355} Productos`,
      `2 \u{1F6F5} Pedido`,
      `3 \u{1F550} Horarios`,
      `4 \u{1F4DE} Contacto`,
      '',
    ].join('\n'),
  });
}
