import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';

import { createClientDb } from './database.js';

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const clientId = process.env.CLIENT_ID;
if (!clientId) {
  console.error('[Worker] CLIENT_ID required');
  process.exit(1);
}

const logger = pino({ level: 'warn' });
const configPath = join(DATA_DIR, 'clients', clientId, 'config.json');
const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, 'utf-8')) : {};
const authDir = join(DATA_DIR, 'clients', clientId, 'auth');
const db = createClientDb(clientId);

function sendToParent(msg) {
  if (process.send) process.send(msg);
}

// Global error handlers — keep the worker alive
process.on('uncaughtException', (err) => {
  console.error(`[${clientId}] Uncaught exception:`, err.message);
  sendToParent({ type: 'error', error: err.message });
});
process.on('unhandledRejection', (reason) => {
  console.error(`[${clientId}] Unhandled rejection:`, reason?.message || reason);
  sendToParent({ type: 'error', error: reason?.message || String(reason) });
});

// Heartbeat — let parent know we're alive
setInterval(() => {
  sendToParent({ type: 'heartbeat' });
}, 30000);

let botRestartCount = 0;
let botRestartTimer = null;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: process.env.NODE_ENV !== 'production',
    logger,
    syncFullHistory: false,
    markOnlineOnConnect: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrcode.generate(qr, { small: true }, (code) => {
        console.log(`[${clientId}] QR:\n${code}`);
      });
      sendToParent({ type: 'qr', qr });
    }
    if (connection === 'open') {
      console.log(`[${clientId}] Connected`);
      sendToParent({ type: 'connected' });
    }
    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error).output.statusCode;
      console.log(`[${clientId}] Disconnected, reason: ${reason}`);
      sendToParent({ type: 'disconnected', reason });

      if (reason === DisconnectReason.loggedOut) {
        console.log(`[${clientId}] Logged out, cleaning up`);
        process.exit(0);
      }
      botRestartCount++;
      const delay = Math.min(5000 * Math.pow(2, botRestartCount), 120000);
      console.log(`[${clientId}] Reconnecting in ${delay}ms (attempt ${botRestartCount})`);
      if (botRestartTimer) clearTimeout(botRestartTimer);
      botRestartTimer = setTimeout(startBot, delay);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      try {
        if (msg.key.fromMe) continue;
        if (msg.key.remoteJid?.includes('@broadcast')) continue;
        await handleMessage(sock, msg);
      } catch (err) {
        console.error(`[${clientId}] Error handling message:`, err.message);
      }
    }
  });

  sendToParent({ type: 'ready' });
  botRestartCount = 0; // reset restart counter on successful connection
}

async function handleMessage(sock, msg) {
  const jid = msg.key.remoteJid;
  const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
  if (!text) return;

  const sender = msg.key.participant || jid;
  const name = msg.pushName || 'Unknown';

  upsertUser(db, sender, name, jid);

  const prefix = config.prefix || '!';
  const cooldown = parseInt(config.cooldown || '172800');

  // Command handling
  if (text.startsWith(prefix)) {
    const parts = text.slice(prefix.length).trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    await handleCommand(sock, jid, cmd, args, db, config);
    return;
  }

  // Numeric menu (1-4)
  if (/^[1-4]$/.test(text)) {
    const commands = ['productos', 'pedido', 'horario', 'contacto'];
    const cmd = commands[parseInt(text) - 1];
    await handleCommand(sock, jid, cmd, [], db, config);
    return;
  }

  // "Menu" / "Menú" keyword
  if (/^menu|menú$/i.test(text)) {
    await sock.sendMessage(jid, { text: getHelpText(config.name || 'Mi Bot') });
    return;
  }

  // Keyword auto-responder
  const keywordMatch = checkKeywords(db, text);
  if (keywordMatch) {
    await sock.sendMessage(jid, { text: keywordMatch.response });
    logConversation(db, sender, text, keywordMatch.response);
    return;
  }

  // Cooldown check for auto-reply
  const lastReply = db.prepare('SELECT last_auto_reply FROM users WHERE id = ?').get(sender);
  if (lastReply?.last_auto_reply) {
    const elapsed = (Date.now() - new Date(lastReply.last_auto_reply + 'Z').getTime()) / 1000;
    if (elapsed < cooldown) return;
  }

  await sock.sendMessage(jid, { text: getHelpText(config.name || 'Mi Bot') });
  db.prepare('UPDATE users SET last_auto_reply = datetime(\'now\') WHERE id = ?').run(sender);
  logConversation(db, sender, text, null);
}

async function handleCommand(sock, jid, cmd, args, db, config) {
  const name = config.name || 'Mi Bot';

  switch (cmd) {
    case 'help': {
      const text = getHelpText(name);
      await sock.sendMessage(jid, { text });
      break;
    }
    case 'productos':
    case 'menu': {
      const products = db.prepare(`
        SELECT name, description, price, emoji, category
        FROM client_products
        ORDER BY sort_order
      `).all();
      const text = getProductsText(name, products);
      await sock.sendMessage(jid, { text });
      break;
    }
    case 'pedido': {
      const text = getOrderText(name, args);
      await sock.sendMessage(jid, { text });
      break;
    }
    case 'horario': {
      const setting = db.prepare("SELECT value FROM client_settings WHERE key = 'horario'").get();
      const horario = setting?.value || 'Lunes a Sábados: 10:00 - 14:00 y 17:00 - 21:00\nDomingos: Cerrado';
      await sock.sendMessage(jid, { text: getScheduleText(name, horario) });
      break;
    }
    case 'contacto': {
      const setting = db.prepare("SELECT value FROM client_settings WHERE key = 'contacto'").get();
      const contacto = setting?.value || '📱 No configurado';
      await sock.sendMessage(jid, { text: getContactText(name, contacto) });
      break;
    }
    default:
      await sock.sendMessage(jid, { text: getHelpText(name) });
  }
}

function getHelpText(name) {
  return [
    `🕊️ *${name}*`,
    '',
    '🍕 *Encargos por mayor* 🍕',
    '',
    '1 🍕 Productos',
    '2 🛵 Pedido',
    '3 🕐 Horarios',
    '4 📞 Contacto',
    '',
  ].join('\n');
}

function getProductsText(name, products) {
  if (products.length === 0) {
    return `📋 No hay productos disponibles.`;
  }
  const lines = [`🕊️ *${name}*\n`];
  let currentCat = '';
  for (const p of products) {
    if (p.category !== currentCat) {
      currentCat = p.category;
      lines.push(`*${p.emoji || '📋'} ${p.category}*`);
    }
    const price = p.price ? ` — $${p.price}` : '';
    lines.push(`  • ${p.name}${price}`);
    if (p.description) lines.push(`    ${p.description}`);
  }
  lines.push('');
  lines.push('💬 _Respondé 2 para pedir o 4 para contactar_');
  return lines.join('\n');
}

function getOrderText(name, args) {
  const header = `🕊️ *${name}*\n━━━━━━━━━━━━━━\n`;

  if (args && args.length > 0) {
    const pedido = args.join(' ');
    return [
      header,
      '✅ *Pedido recibido*',
      '',
      `> ${pedido}`,
      '',
      '🔔 Te confirmamos por este medio.',
      '💬 Ante cualquier duda, consultános.',
    ].join('\n');
  }

  return [
    header,
    '🛵 *Hacé tu pedido*',
    '',
    'Usá: `!pedido [producto] [cantidad]`',
    '',
    'Ej: `!pedido 2 prepizzas`',
    'Ej: `!pedido 3 pizzetas x6`',
  ].join('\n');
}

function getScheduleText(name, horario) {
  return [
    `🕊️ *${name}*`,
    '━━━━━━━━━━━━━━',
    '',
    `🕐 *Horarios*`,
    '',
    horario,
  ].join('\n');
}

function getContactText(name, contacto) {
  return [
    `🕊️ *${name}*`,
    '━━━━━━━━━━━━━━',
    '',
    contacto,
  ].join('\n');
}

function upsertUser(db, jid, name, remoteJid) {
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(jid);
  if (existing) {
    db.prepare('UPDATE users SET name = ?, phone = ?, last_interaction = datetime(\'now\') WHERE id = ?')
      .run(name, remoteJid.split('@')[0], jid);
  } else {
    db.prepare('INSERT INTO users (id, name, phone, last_interaction) VALUES (?, ?, ?, datetime(\'now\'))')
      .run(jid, name, remoteJid.split('@')[0]);
  }
}

function checkKeywords(db, text) {
  const keywords = db.prepare('SELECT * FROM keywords WHERE is_active = 1 ORDER BY length(keyword) DESC').all();
  for (const kw of keywords) {
    if (text.toLowerCase().includes(kw.keyword.toLowerCase())) {
      return kw;
    }
  }
  return null;
}

function logConversation(db, userId, message, response) {
  db.prepare('INSERT INTO conversations (user_id, message, response) VALUES (?, ?, ?)')
    .run(userId, message, response || null);
}

console.log(`[${clientId}] Worker starting...`);
startBot().catch((err) => {
  console.error(`[${clientId}] Fatal error:`, err);
  sendToParent({ type: 'error', error: err.message });
  process.exit(1);
});
