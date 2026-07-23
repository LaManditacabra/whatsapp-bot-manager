import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';

import { createClientDb } from './database.js';
import { getTheme } from './themes.js';

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

// Migration: add awaiting_order columns for conversational pedido
try { db.exec("ALTER TABLE users ADD COLUMN awaiting_order INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN awaiting_order_at TEXT"); } catch (e) {}
// Migration: add pending_purchase columns for stock purchase flow
try { db.exec("ALTER TABLE users ADD COLUMN pending_purchase INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN pending_product_id INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN pending_product_name TEXT"); } catch (e) {}

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

// Listen for IPC messages from parent
process.on('message', (msg) => {
  if (msg.type === 'reload_settings') {
    const configPath = join(DATA_DIR, 'clients', clientId, 'config.json');
    if (existsSync(configPath)) {
      const newConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
      Object.assign(config, newConfig);
    }
    _themeCache = { theme: null, timestamp: 0 }
    console.log(`[${clientId}] Settings reloaded`);
  }
});

let botRestartCount = 0;
let botRestartTimer = null;
let reminderInterval = null;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: process.env.NODE_ENV !== 'production',
    logger,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    browser: ['BotAr', 'Chrome', 'BotAr'],
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

  // Start reminder scheduler
  if (isFeatureEnabled(db, 'recordatorios')) {
    startReminderScheduler(sock, db, config);
  }
}

async function startReminderScheduler(sock, db, config) {
  if (reminderInterval) clearInterval(reminderInterval);
  const checkInterval = 60000; // check every minute
  reminderInterval = setInterval(async () => {
    try {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const currentDay = now.getDay();

      let reminders;
      try {
        reminders = db.prepare('SELECT * FROM client_reminders WHERE active = 1').all();
      } catch {
        return; // table may not exist yet
      }
      for (const r of reminders) {
        if (r.time !== currentTime) continue;
        if (r.frequency === 'weekly' && r.day_of_week !== currentDay) continue;
        if (r.frequency === 'monthly' && now.getDate() !== 1) continue;

        // Send to all users who have interacted
        const users = db.prepare('SELECT DISTINCT id FROM users WHERE id LIKE ?').all('%@s.whatsapp.net');
        for (const u of users) {
          try {
            await sock.sendMessage(u.id, { text: r.message || `📌 *${r.title}*` });
          } catch {}
        }
        db.prepare('UPDATE client_reminders SET last_sent = datetime(\'now\') WHERE id = ?').run(r.id);
      }
    } catch (err) {
      console.error(`[${clientId}] Reminder scheduler error:`, err.message);
    }
  }, checkInterval);
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

  // Fuera de horario check
  if (isFeatureEnabled(db, 'fuera_horario') && !isWithinBusinessHours(db)) {
    const outMsg = setting(db, 'fuera_horario_msg', '');
    if (outMsg) {
      await sock.sendMessage(jid, { text: outMsg });
    }
    return;
  }

  // Command handling
  if (text.startsWith(prefix)) {
    const parts = text.slice(prefix.length).trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    await handleCommand(sock, jid, cmd, args, db, config, { pushName: name }, sender);
    return;
  }

  // Numeric menu (1-4)
  if (/^[1-4]$/.test(text)) {
    const commands = ['productos', 'pedido', 'horario', 'contacto'];
    const featureMap = ['productos', 'pedidos', 'horario', 'contacto'];
    const cmd = commands[parseInt(text) - 1];
    const fid = featureMap[parseInt(text) - 1];
    if (isFeatureEnabled(db, fid)) {
      await handleCommand(sock, jid, cmd, [], db, config, { pushName: name }, sender);
    } else {
      const theme = getActiveTheme(db);
      await sock.sendMessage(jid, { text: getHelpText(theme, config.name || 'Mi Bot', db) });
    }
    return;
  }

  // "Menu" / "Menú" keyword
  if (/^menu|menú$/i.test(text)) {
    const theme = getActiveTheme(db);
    await sock.sendMessage(jid, { text: getHelpText(theme, config.name || 'Mi Bot', db) });
    return;
  }

  // Keyword auto-responder
  const keywordMatch = checkKeywords(db, text);
  if (keywordMatch) {
    await sock.sendMessage(jid, { text: keywordMatch.response });
    logConversation(db, sender, text, keywordMatch.response);
    return;
  }

  const lastReply = db.prepare('SELECT last_auto_reply, awaiting_order, awaiting_order_at, pending_purchase, pending_product_id, pending_product_name FROM users WHERE id = ?').get(sender);

  // Purchase comprobante: user sent a message after being given a payment link
  if (lastReply?.pending_purchase) {
    const productName = lastReply.pending_product_name || 'producto';
    const productId = lastReply.pending_product_id;
    const isImage = !!(msg.message?.imageMessage);
    await sock.sendMessage(jid, { text: wrapBorder(getActiveTheme(db), [
      formatHeader(getActiveTheme(db), config.name || 'Mi Bot'),
      '',
      `✅ *Comprobante recibido por ${productName}*`,
      '',
      'Gracias por tu compra. Te confirmamos en cuanto verifiquemos el pago.',
      isImage ? '📸 Imagen recibida correctamente.' : '📝 Mensaje recibido.',
    ].join('\n')) });
    db.prepare('UPDATE users SET pending_purchase = 0, pending_product_id = NULL, pending_product_name = NULL WHERE id = ?').run(sender);
    // Notify admin
    sendToParent({ type: 'comprobante', clientId, productId, productName, userName: msg.pushName || 'Unknown', hasImage: isImage });
    // Deduct stock
    try {
      db.prepare('UPDATE client_products SET stock = MAX(0, stock - 1) WHERE id = ?').run(productId);
    } catch (e) {
      console.error(`[${clientId}] Error deducting stock:`, e.message);
    }
    logConversation(db, sender, text, null);
    return;
  }

  // Conversational pedido: check BEFORE cooldown so awaiting_order is not blocked
  if (lastReply?.awaiting_order) {
    // Check timeout (5 min)
    if (lastReply.awaiting_order_at) {
      const elapsed = (Date.now() - new Date(lastReply.awaiting_order_at.replace(' ', 'T') + 'Z').getTime()) / 1000;
      if (elapsed > 300) {
        db.prepare('UPDATE users SET awaiting_order = 0, awaiting_order_at = NULL WHERE id = ?').run(sender);
        return;
      }
    }
    const theme = getActiveTheme(db);
    const pedido = text;
    let orderText;
    const custom = setting(db, 'autoreply_pedido_recibido', '');
    if (custom) {
      orderText = custom.replace(/\{name\}/g, config.name || 'Mi Bot').replace(/\{pedido\}/g, pedido);
    } else {
      const fakeArgs = pedido.split(/\s+/);
      orderText = getOrderText(theme, config.name || 'Mi Bot', fakeArgs, prefix) + getPaymentLinksText(db, pedido);
    }
    await sock.sendMessage(jid, { text: orderText });
    // Store order
    try {
      const senderName = msg?.pushName || '';
      const result = db.prepare('INSERT INTO orders (user_id, user_name, items) VALUES (?, ?, ?)')
        .run(sender, senderName, pedido);
      if (typeof process.send === 'function') {
        process.send({ type: 'new_order', clientId, orderId: result.lastInsertRowid, items: pedido, userName: senderName });
      }
    } catch (e) {
      console.error(`[${clientId}] Error storing order:`, e.message);
    }
    db.prepare('UPDATE users SET awaiting_order = 0, awaiting_order_at = NULL, last_auto_reply = datetime(\'now\') WHERE id = ?').run(sender);
    logConversation(db, sender, text, orderText);
    return;
  }

  // Cooldown check for auto-reply (after awaiting_order so conversacional flow is not blocked)
  if (lastReply?.last_auto_reply) {
    const elapsed = (Date.now() - new Date(lastReply.last_auto_reply.replace(' ', 'T') + 'Z').getTime()) / 1000;
    if (elapsed < cooldown) return;
  }

  const welcome = setting(db, 'autoreply_welcome', '');
  const theme = getActiveTheme(db);
  await sock.sendMessage(jid, { text: welcome.replace(/\{name\}/g, config.name || 'Mi Bot') || getHelpText(theme, config.name || 'Mi Bot', db) });
  db.prepare('UPDATE users SET last_auto_reply = datetime(\'now\') WHERE id = ?').run(sender);
  logConversation(db, sender, text, null);
}

function setting(db, key, fallback) {
  const row = db.prepare('SELECT value FROM client_settings WHERE key = ?').get(key);
  return row?.value || fallback;
}

function isFeatureEnabled(db, featureId) {
  const raw = setting(db, 'features', null);
  if (!raw) return ['productos', 'pedidos', 'horario', 'contacto'].includes(featureId); // default: only basic features
  try {
    const list = JSON.parse(raw);
    return list.includes(featureId);
  } catch {
    return ['productos', 'pedidos', 'horario', 'contacto'].includes(featureId);
  }
}

function isWithinBusinessHours(db) {
  const raw = setting(db, 'horario', '');
  if (!raw) return true;
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const hour = now.getHours();
  const minute = now.getMinutes();
  const currentMin = hour * 60 + minute;
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const match = line.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!match) continue;
    const start = parseInt(match[1]) * 60 + parseInt(match[2]);
    const end = parseInt(match[3]) * 60 + parseInt(match[4]);
    if (currentMin >= start && currentMin <= end) return true;
  }
  return false;
}

async function sendMessageOrImage(sock, jid, text, image) {
  if (image) {
    const buf = Buffer.from(image.split(',')[1] || image, 'base64');
    await sock.sendMessage(jid, { image: buf, caption: text });
  } else {
    await sock.sendMessage(jid, { text });
  }
}

// ─── Theme cache ──────────────────────────────────────────
let _themeCache = { theme: null, timestamp: 0 }
const THEME_CACHE_TTL = 30000 // 30s

function getActiveTheme(db) {
  const now = Date.now()
  if (_themeCache.theme && (now - _themeCache.timestamp) < THEME_CACHE_TTL) {
    return _themeCache.theme
  }
  const themeId = setting(db, 'message_theme', '')
  const theme = { ...getTheme(themeId) }
  const customKeys = ['headerIcon', 'separator', 'bullet', 'titlePrefix', 'titleSuffix',
    'accentEmoji', 'productBullet', 'productConnector', 'orderReceiptIcon', 'orderNoteIcon',
    'scheduleIcon', 'contactIcon', 'borderChar']
  let hasCustom = false
  for (const key of customKeys) {
    const val = setting(db, `custom_theme_${key}`, null)
    if (val !== null && val !== '') { theme[key] = val; hasCustom = true }
  }
  _themeCache = { theme, timestamp: now }
  return theme
}

function formatHeader(theme, name) {
  const icon = theme.headerIcon ? `${theme.headerIcon} ` : ''
  const prefix = theme.titlePrefix ? `${theme.titlePrefix} ` : ''
  const suffix = theme.titleSuffix ? ` ${theme.titleSuffix}` : ''
  return `${icon}*${prefix}${name}${suffix}*`
}

function wrapBorder(theme, text) {
  if (!theme.borderChar) return text
  const lines = text.split('\n')
  let maxLen = 0
  for (const l of lines) {
    const plain = l.replace(/\*|_|~/g, '')
    if (plain.length > maxLen) maxLen = plain.length
  }
  const b = theme.borderChar
  const width = Math.min(maxLen + 4, 44)
  const border = b.length === 1 ? b.repeat(width) : b
  const pad = '  '
  const wrapped = lines.map(l => `${pad}${l}`).join('\n')
  return `${border}\n${wrapped}\n${border}`
}

async function handleCommand(sock, jid, cmd, args, db, config, msg, sender) {
  const prefix = config.prefix || '!';
  const name = config.name || 'Mi Bot';
  const theme = getActiveTheme(db);

  const featureMap = {
    productos: 'productos',
    menu: 'productos',
    pedido: 'pedidos',
    horario: 'horario',
    contacto: 'contacto',
  };
  const featureId = featureMap[cmd];
  if (featureId && !isFeatureEnabled(db, featureId)) {
    await sock.sendMessage(jid, { text: getHelpText(theme, name, db) });
    return;
  }

  switch (cmd) {
    case 'help': {
      const custom = setting(db, 'autoreply_help', '');
      const text = custom || getHelpText(theme, name, db);
      await sock.sendMessage(jid, { text });
      break;
    }
    case 'productos':
    case 'menu': {
      const custom = setting(db, 'autoreply_productos', '');
      if (custom) {
        await sock.sendMessage(jid, { text: custom.replace(/\{name\}/g, name) });
      } else {
        const products = db.prepare(`
          SELECT name, description, price, emoji, category, image, stock
          FROM client_products
          ORDER BY sort_order
        `).all();
        if (isFeatureEnabled(db, 'catalogo_visual')) {
          await sock.sendMessage(jid, { text: getProductsText(theme, name, products) });
          const pdfBase64 = setting(db, 'menu_pdf', '');
          if (pdfBase64) {
            try {
              const buf = Buffer.from(pdfBase64, 'base64');
              await sock.sendMessage(jid, {
                document: buf,
                mimetype: 'application/pdf',
                fileName: `menu_${name.replace(/\s+/g, '_').toLowerCase()}.pdf`,
                caption: `📄 *${name}* — Menú completo`,
              });
            } catch (e) {
              console.error(`[${clientId}] Error sending menu PDF: ${e.message}`);
            }
          }
        } else {
          await sock.sendMessage(jid, { text: getProductsText(theme, name, products) });
        }
      }
      break;
    }
    case 'pedido': {
      console.log(`[${clientId}] PEDIDO args="${args?.join(' ')}" sender="${sender}"`);
      if (args && args.length > 0) {
        const pedido = args.join(' ');
        let orderText;
        const custom = setting(db, 'autoreply_pedido_recibido', '');
        if (custom) {
          orderText = custom.replace(/\{name\}/g, name).replace(/\{pedido\}/g, pedido);
        } else {
          orderText = getOrderText(theme, name, args, prefix) + getPaymentLinksText(db, pedido);
        }
        await sock.sendMessage(jid, { text: orderText });

        // Store order
        try {
          const senderName = msg?.pushName || '';
          const result = db.prepare('INSERT INTO orders (user_id, user_name, items) VALUES (?, ?, ?)')
            .run(sender, senderName, pedido);
          console.log(`[${clientId}] Order stored: id=${result.lastInsertRowid} user="${senderName}" items="${pedido}"`);
          // Notify parent process
          if (typeof process.send === 'function') {
            process.send({ type: 'new_order', clientId, orderId: result.lastInsertRowid, items: pedido, userName: senderName });
            console.log(`[${clientId}] IPC new_order sent`);
          }
        } catch (e) {
          console.error(`[${clientId}] Error storing order:`, e.message);
        }
      } else {
        db.prepare('UPDATE users SET awaiting_order = 1, awaiting_order_at = datetime(\'now\') WHERE id = ?').run(sender);
        const theme = getActiveTheme(db);
        await sock.sendMessage(jid, { text: wrapBorder(theme, [
          formatHeader(theme, name),
          theme.separator || '',
          '',
          `${theme.orderReceiptIcon || '🛵'} Decime qué querés pedir`,
          '',
          `Ej: \`2 prepizzas\``,
          `Ej: \`1 pizzeta x6 y 3 prepizzas\``,
        ].join('\n')) });
      }
      break;
    }
    case 'cupon': {
      if (!isFeatureEnabled(db, 'cupones')) {
        await sock.sendMessage(jid, { text: getHelpText(theme, name, db) });
        break;
      }
      if (!args || args.length === 0) {
        await sock.sendMessage(jid, { text: '💬 Usá: `!cupon CODIGO` para aplicar un descuento.' });
        break;
      }
      const code = args[0].toUpperCase();
      const cupon = db.prepare('SELECT * FROM client_coupons WHERE code = ? AND active = 1').get(code);
      if (!cupon) {
        await sock.sendMessage(jid, { text: '❌ Cupón inválido o vencido.' });
        break;
      }
      if (cupon.expires_at && new Date(cupon.expires_at) < new Date()) {
        await sock.sendMessage(jid, { text: '❌ Este cupón ya venció.' });
        break;
      }
      if (cupon.max_uses > 0 && cupon.used_count >= cupon.max_uses) {
        await sock.sendMessage(jid, { text: '❌ Este cupón ya no tiene usos disponibles.' });
        break;
      }
      const discountText = cupon.discount_type === 'percentage' ? `${cupon.discount_value}%` : `$${cupon.discount_value}`;
      await sock.sendMessage(jid, { text: `✅ *Cupón aplicado:* ${cupon.code}\nDescuento: ${discountText}\n\nMencionalo al hacer tu pedido.` });
      db.prepare('UPDATE client_coupons SET used_count = used_count + 1 WHERE id = ?').run(cupon.id);
      break;
    }
    case 'horario': {
      const custom = setting(db, 'autoreply_horario', '');
      if (custom) {
        await sock.sendMessage(jid, { text: custom.replace(/\{name\}/g, name) });
      } else {
        const horario = setting(db, 'horario', 'Lunes a Sábados: 10:00 - 14:00 y 17:00 - 21:00\nDomingos: Cerrado');
        await sock.sendMessage(jid, { text: getScheduleText(theme, name, horario) });
      }
      break;
    }
    case 'contacto': {
      const custom = setting(db, 'autoreply_contacto', '');
      if (custom) {
        await sock.sendMessage(jid, { text: custom.replace(/\{name\}/g, name) });
      } else {
        const contacto = setting(db, 'contacto', '📱 No configurado');
        await sock.sendMessage(jid, { text: getContactText(theme, name, contacto) });
      }
      break;
    }
    case 'stock': {
      const stockProducts = db.prepare("SELECT id, name, description, price, emoji, stock, payment_link FROM client_products WHERE stock > 0 ORDER BY category, sort_order").all();
      if (stockProducts.length === 0) {
        await sock.sendMessage(jid, { text: wrapBorder(theme, `${formatHeader(theme, name)}\n${theme.separator || ''}\n\n📦 No hay productos en stock en este momento.`) });
      } else {
        const lines = [formatHeader(theme, name)];
        if (theme.separator) lines.push(theme.separator, '');
        else lines.push('');
        lines.push('📦 *Productos en stock*', '');
        let idx = 1;
        for (const p of stockProducts) {
          const price = p.price ? ` ${theme.productConnector || '—'} $${p.price}` : '';
          lines.push(`${idx}. ${p.emoji || '🔹'} ${p.name}${price} (${p.stock} uds)`);
          if (p.description) lines.push(`   ${p.description}`);
          idx++;
        }
        lines.push('');
        lines.push(`💬 Respondé \`${prefix}comprar 1\` para comprar el primer producto, o \`${prefix}comprar [nombre]\``);
        await sock.sendMessage(jid, { text: wrapBorder(theme, lines.join('\n')) });
      }
      break;
    }
    case 'comprar': {
      const stockProducts = db.prepare("SELECT id, name, price, emoji, stock, payment_link FROM client_products WHERE stock > 0 ORDER BY category, sort_order").all();
      if (stockProducts.length === 0) {
        await sock.sendMessage(jid, { text: wrapBorder(theme, `${formatHeader(theme, name)}\n${theme.separator || ''}\n\n📦 No hay productos en stock en este momento.`) });
        break;
      }
      let selected = null;
      if (args && args.length > 0) {
        const num = parseInt(args[0]);
        if (!isNaN(num) && num >= 1 && num <= stockProducts.length) {
          selected = stockProducts[num - 1];
        } else {
          const query = args.join(' ').toLowerCase();
          selected = stockProducts.find(p => p.name.toLowerCase().includes(query));
        }
      }
      if (!selected) {
        const lines = [formatHeader(theme, name)];
        if (theme.separator) lines.push(theme.separator, '');
        else lines.push('');
        lines.push('📦 *Elegí un producto:*', '');
        stockProducts.forEach((p, i) => {
          const price = p.price ? ` $${p.price}` : '';
          lines.push(`${i + 1}. ${p.emoji || '🔹'} ${p.name}${price} (${p.stock} uds)`);
        });
        lines.push('', `Usá: \`${prefix}comprar [número]\` o \`${prefix}comprar [nombre]\``);
        await sock.sendMessage(jid, { text: wrapBorder(theme, lines.join('\n')) });
        break;
      }
      if (selected.payment_link) {
        db.prepare('UPDATE users SET pending_purchase = 1, pending_product_id = ?, pending_product_name = ? WHERE id = ?').run(selected.id, selected.name, sender);
        const lines = [formatHeader(theme, name)];
        if (theme.separator) lines.push(theme.separator, '');
        else lines.push('');
        lines.push(`🔗 *Link de pago para ${selected.emoji || '🔹'} ${selected.name}*`, '', selected.payment_link, '');
        lines.push('✅ Pagá con ese link y enviá el *comprobante* (captura de pantalla) por este chat.');
        lines.push('Te confirmaremos la compra y descontaremos del stock.');
        await sock.sendMessage(jid, { text: wrapBorder(theme, lines.join('\n')) });
      } else {
        await sock.sendMessage(jid, { text: wrapBorder(theme, `${formatHeader(theme, name)}\n${theme.separator || ''}\n\n❌ ${selected.emoji || '🔹'} *${selected.name}* no tiene link de pago configurado.\n\nConsultá al administrador.`) });
      }
      break;
    }
    default:
      await sock.sendMessage(jid, { text: getHelpText(theme, name, db) });
  }
}

function getHelpText(theme, name, db) {
  const header = formatHeader(theme, name);
  const items = [];
  let idx = 1;
  const featureOpts = [
    { id: 'productos', icon: '🍕', label: 'Productos' },
    { id: 'pedidos', icon: null, label: 'Pedido' },
    { id: 'horario', icon: null, label: 'Horarios' },
    { id: 'contacto', icon: null, label: 'Contacto' },
  ];
  if (isFeatureEnabled(db, 'cupones')) {
    featureOpts.push({ id: 'cupon_help', icon: '🏷️', label: 'Cupón' });
  }
  const hasStock = db.prepare("SELECT COUNT(*) as c FROM client_products WHERE stock > 0").get().c > 0;
  if (hasStock) {
    featureOpts.push({ id: 'stock_help', icon: '📦', label: 'Comprar' });
  }
  for (const opt of featureOpts) {
    if (opt.id === 'cupon_help' || opt.id === 'stock_help' || isFeatureEnabled(db, opt.id)) {
      const icon = opt.icon || (opt.id === 'pedidos' ? theme.orderReceiptIcon || '🛵' : opt.id === 'horario' ? theme.scheduleIcon || '🕐' : theme.contactIcon || '📞');
      items.push(`${idx} ${icon} ${opt.label}`);
      idx++;
    }
  }
  return wrapBorder(theme, [
    header,
    '',
    theme.titlePrefix ? `${theme.titlePrefix} *Encargos por mayor* ${theme.titleSuffix}`.trim() : '*Encargos por mayor*',
    '',
    ...items,
    '',
  ].join('\n'));
}

function getPaymentLinksText(db, pedido) {
  const products = db.prepare("SELECT name, payment_link FROM client_products WHERE payment_link IS NOT NULL AND payment_link != ''").all();
  const matched = products.filter(p => pedido.toLowerCase().includes(p.name.toLowerCase()));
  if (matched.length === 0) return '';
  const lines = matched.map(p => `🔗 *${p.name}*: ${p.payment_link}`);
  return '\n\n' + lines.join('\n');
}

function getProductsText(theme, name, products) {
  if (products.length === 0) {
    return wrapBorder(theme, `${theme.headerIcon} No hay productos disponibles.`.trim());
  }
  const lines = [];
  if (theme.separator) {
    lines.push(formatHeader(theme, name), theme.separator, '');
  } else {
    lines.push(formatHeader(theme, name), '');
  }
  let currentCat = '';
  for (const p of products) {
    if (p.category !== currentCat) {
      currentCat = p.category;
      lines.push(`*${p.emoji || '📋'} ${p.category}*`);
    }
    const stockIcon = p.stock > 0 ? '✅' : p.stock === 0 ? '❌' : '';
    const stockLabel = p.stock > 0 ? '' : p.stock === 0 ? ' (Agotado)' : '';
    const price = p.price ? ` ${theme.productConnector || '—'} $${p.price}` : '';
    lines.push(`  ${theme.productBullet || '•'} ${stockIcon} ${p.name}${stockLabel}${price}`);
    if (p.description) lines.push(`    ${p.description}`);
  }
  lines.push('');
  const accent = theme.accentEmoji || '💬';
  lines.push(`${accent} _Respondé 2 para pedir o 4 para contactar_`);
  return wrapBorder(theme, lines.join('\n'));
}

function getOrderText(theme, name, args, prefix) {
  const separator = theme.separator ? `\n${theme.separator}\n` : '\n';
  const header = `${formatHeader(theme, name)}${separator}`;

  if (args && args.length > 0) {
    const pedido = args.join(' ');
    return wrapBorder(theme, [
      header,
      `${theme.orderReceiptIcon || '✅'} *Pedido recibido*`,
      '',
      `> ${pedido}`,
      '',
      `${theme.orderNoteIcon || '🔔'} Te confirmamos por este medio.`,
      `${theme.accentEmoji || '💬'} Ante cualquier duda, consultános.`,
    ].join('\n'));
  }

  return wrapBorder(theme, [
    header,
    `${theme.orderReceiptIcon || '🛵'} *Hacé tu pedido*`,
    '',
    `Usá: \`${prefix}pedido [producto] [cantidad]\``,
    '',
    `Ej: \`${prefix}pedido 2 prepizzas\``,
    `Ej: \`${prefix}pedido 3 pizzetas x6\``,
  ].join('\n'));
}

function getScheduleText(theme, name, horario) {
  return wrapBorder(theme, [
    formatHeader(theme, name),
    ...(theme.separator ? [theme.separator] : []),
    '',
    `${theme.scheduleIcon || '🕐'} *Horarios*`,
    '',
    horario,
  ].join('\n'));
}

function getContactText(theme, name, contacto) {
  return wrapBorder(theme, [
    formatHeader(theme, name),
    ...(theme.separator ? [theme.separator] : []),
    '',
    contacto,
  ].join('\n'));
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
