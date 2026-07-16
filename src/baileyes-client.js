import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import config from './config/index.js';
import logger from './utils/logger.js';
import { handleQR, handleConnectionUpdate } from './baileys/qr.js';

let sock = null;

export async function connect(handlers) {
  const authState = await useMultiFileAuthState(config.paths.auth);

  sock = makeWASocket({
    auth: authState.state,

    browser: [`${config.bot.name}`, 'Chrome', '120.0'],
    syncFullHistory: false,
    logger: logger.child({ module: 'baileys' }),
  });

  sock.ev.on('qr', handleQR);

  sock.ev.on('connection.update', (update) => {
    handleConnectionUpdate(update, () => {
      sock?.end();
      connect(handlers);
    }, authState);
    if (update.connection === 'open') {
      authState.saveCreds();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key?.fromMe) continue;
      await handlers.processMessage(sock, msg);
    }
  });

  sock.ev.on('creds.update', authState.saveCreds);

  return sock;
}

export function getSock() {
  return sock;
}
