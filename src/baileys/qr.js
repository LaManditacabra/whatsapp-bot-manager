import qrcode from 'qrcode-terminal';
import logger from '../utils/logger.js';

export function handleQR(qr) {
  qrcode.generate(qr, { small: true });
  logger.info('--- ESCANEA EL CÓDIGO QR DE WHATSAPP ---');
}

export function handleConnectionUpdate(update, startRetryTimer, authState) {
  const { connection, lastDisconnect, qr, isNewLogin } = update;

  if (qr && typeof qr === 'string') {
    handleQR(qr);
  }

  if (isNewLogin) {
    logger.info('Nuevo login detectado');
  }

  if (connection === 'close') {
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    const shouldReconnect = statusCode !== 401;
    logger.info(
      { statusCode, reason: lastDisconnect?.error?.message },
      `Conexión cerrada. Reintentar: ${shouldReconnect}`,
    );
    if (shouldReconnect && authState) {
      setTimeout(() => startRetryTimer(), 1000);
    }
  } else if (connection === 'open') {
    logger.info('WhatsApp conectado exitosamente');
  }
}
