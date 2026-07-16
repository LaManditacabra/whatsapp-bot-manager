export async function sendMenuList(sock, jid, categories, db) {
  const lines = ['🕊️ *El Palomo PrePizzas*\n'];

  for (const cat of categories) {
    const items = await db('menu_items')
      .where({ category_id: cat.id, is_active: true });

    lines.push(`*${cat.emoji} ${cat.name}*`);
    for (const item of items) {
      const price = item.price ? ` — $${item.price}` : '';
      lines.push(`  • ${item.name}${price}`);
      if (item.description) lines.push(`    ${item.description}`);
    }
    lines.push('');
  }

  lines.push('💬 _Respondé 2 para pedir o 4 para contactar_');

  await sock.sendMessage(jid, { text: lines.join('\n') });
}

export async function sendCommandList(sock, jid) {
  await sock.sendMessage(jid, {
    text: [
      '🕊️ *El Palomo PrePizzas*',
      '',
      '🍕 *Encargos por mayor* 🍕',
      '',
      '1 \u{1F355} Productos',
      '2 \u{1F6F5} Pedido',
      '3 \u{1F550} Horarios',
      '4 \u{1F4DE} Contacto',
      '',
    ].join('\n'),
  });
}
