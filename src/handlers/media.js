import logger from '../utils/logger.js';
import db from '../database/db.js';

export async function handleMedia(sock, msg) {
  const jid = msg.key.remoteJid;
  const msgType = Object.keys(msg.message || {})[0];

  if (msgType === 'imageMessage') {
    logger.info(`Imagen recibida de ${jid}`);
    const caption = msg.message.imageMessage?.caption || '';
    await sock.sendMessage(jid, {
      text: `📸 *Imagen recibida*\n${caption ? `Texto: ${caption}` : 'Sin texto'}`,
    });
    return true;
  }

  if (msgType === 'videoMessage') {
    logger.info(`Video recibido de ${jid}`);
    await sock.sendMessage(jid, { text: '🎥 *Video recibido*' });
    return true;
  }

  if (msgType === 'documentMessage') {
    logger.info(`Documento recibido de ${jid}`);
    await sock.sendMessage(jid, { text: '📄 *Documento recibido*' });
    return true;
  }

  return false;
}
