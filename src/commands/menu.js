import db from '../database/db.js';
import { sendMenuList, sendCommandList } from '../utils/interactive.js';

export default async function menu(sock, msg, args) {
  const jid = msg.key.remoteJid;

  const categories = await db('menu_categories')
    .where('is_active', true)
    .orderBy('sort_order');

  if (categories.length === 0) {
    await sock.sendMessage(jid, { text: '📋 No hay productos disponibles.' });
    return;
  }

  await sendMenuList(sock, jid, categories, db);
}
