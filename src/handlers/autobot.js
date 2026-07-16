import db from '../database/db.js';
import logger from '../utils/logger.js';

export async function autoRespond(sock, msg, text) {
  const jid = msg.key.remoteJid;
  const lowerText = text.toLowerCase();

  const keywords = await db('keywords')
    .where('is_active', true)
    .orderByRaw('LENGTH(keyword) DESC');

  for (const kw of keywords) {
    if (lowerText.includes(kw.keyword.toLowerCase())) {
      logger.info(`Auto-respuesta para keyword: "${kw.keyword}"`);

      const payload = { text: kw.response };

      if (kw.media_url && kw.media_type) {
        if (kw.media_type === 'image') {
          await sock.sendMessage(jid, { image: { url: kw.media_url }, caption: kw.response });
          return true;
        }
      }

      await sock.sendMessage(jid, payload);
      return true;
    }
  }

  return false;
}
