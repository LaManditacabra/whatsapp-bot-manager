import db from '../database/db.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';
import { handle, execute } from '../commands/index.js';
import { autoRespond } from './autobot.js';
import { handleMedia } from './media.js';
import { sendCommandList } from '../utils/interactive.js';

const COOLDOWN_MS = (config.bot.cooldown || 30) * 1000;

async function shouldThrottle(jid) {
  const user = await db('users').where({ id: jid }).select('last_auto_reply').first();
  if (!user?.last_auto_reply) return false;
  const elapsed = Date.now() - new Date(user.last_auto_reply).getTime();
  return elapsed < COOLDOWN_MS;
}

async function markReply(jid) {
  await db('users').where({ id: jid }).update({ last_auto_reply: db.fn.now() });
}

const menuMap = {
  '1': 'productos',
  '2': 'pedido',
  '3': 'horario',
  '4': 'contacto',
};

function handleNumericMenu(text) {
  const t = text.trim();
  if (/^[1-4]$/.test(t)) return menuMap[t];
  return null;
}

export async function processMessage(sock, msg) {
  try {
    const jid = msg.key.remoteJid;
    if (!jid || jid.includes('@broadcast')) return;

    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      '';

    const senderId = msg.key.participant || jid;
    const senderName =
      msg.pushName || msg.participant || 'Desconocido';

    logger.info({ jid, text }, 'Mensaje recibido');

    await upsertUser(senderId, senderName, jid);

    const handledByCommand = await handle(sock, msg, text.trim());
    if (handledByCommand) {
      logger.info('Comando ejecutado');
      return;
    }

    const numericCmd = handleNumericMenu(text.trim());
    if (numericCmd) {
      logger.info({ cmd: numericCmd }, 'Menú numérico');
      await execute(sock, msg, numericCmd);
      return;
    }

    const isMedia = await handleMedia(sock, msg);
    if (isMedia) {
      logger.info('Media manejado');
      return;
    }

    const lower = text.trim().toLowerCase();
    if (lower === 'menu' || lower === 'menú') {
      logger.info('Keyword "menu" → help');
      await execute(sock, msg, 'help');
      return;
    }

    const handledByAuto = await autoRespond(sock, msg, text.trim());
    if (handledByAuto) {
      logger.info('Auto-respuesta enviada');
      return;
    }

    if (await shouldThrottle(jid)) {
      logger.debug({ jid }, 'Throttled — respuesta omitida');
      return;
    }

    await markReply(jid);
    await sendCommandList(sock, jid);
  } catch (err) {
    logger.error({ err, stack: err.stack }, 'Error procesando mensaje');
  }
}

async function upsertUser(id, name, phone) {
  try {
    await db('users')
      .insert({
        id,
        name,
        phone,
        last_interaction: db.fn.now(),
      })
      .onConflict('id')
      .merge({
        name,
        phone,
        last_interaction: db.fn.now(),
      });
  } catch (err) {
    logger.error({ err }, 'Error guardando usuario');
  }
}
