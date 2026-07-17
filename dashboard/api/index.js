import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import qrcode from 'qrcode';

import db from './db.js';
import { generateToken, authMiddleware, adminMiddleware } from './auth.js';
import { BotManager } from './bot-manager.js';
import { configurePayPal, isPayPalConfigured, createOrder, captureOrder } from './paypal.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.DASHBOARD_PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));
app.use('/landing', express.static(join(__dirname, '..', '..', 'docs')));

const botManager = new BotManager(db);

// ─── Auth ───────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(400).json({ error: 'El email ya está registrado' });
  }
  const id = uuid();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, email, name, password_hash, role, plan, plan_bots_limit) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, email, name || email.split('@')[0], hash, 'user', 'free', 1);
  const user = db.prepare('SELECT id, email, name, role, plan, plan_bots_limit FROM users WHERE id = ?').get(id);
  const token = await generateToken(user);
  res.status(201).json({ token, ...user });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  }
  const token = await generateToken(user);
  res.json({
    token,
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: user.plan,
    plan_bots_limit: user.plan_bots_limit,
  });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

// ─── Admin: Users ───────────────────────────────────────────────
app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  const users = db.prepare('SELECT id, email, name, role, plan, plan_bots_limit, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

app.put('/api/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { id } = req.params;
  const { role, plan, plan_bots_limit } = req.body;
  db.prepare('UPDATE users SET role = ?, plan = ?, plan_bots_limit = ? WHERE id = ?')
    .run(role || 'user', plan || 'free', plan_bots_limit ?? 1, id);
  res.json({ success: true });
});

// ─── Clients ────────────────────────────────────────────────────
app.get('/api/clients', authMiddleware, (req, res) => {
  let clients;
  if (req.user.role === 'admin') {
    clients = db.prepare(`
      SELECT c.*, u.email as user_email, u.name as user_name
      FROM clients c LEFT JOIN users u ON c.user_id = u.id
      ORDER BY c.created_at DESC
    `).all();
  } else {
    clients = db.prepare('SELECT * FROM clients WHERE user_id = ? ORDER BY created_at DESC').all(req.userId);
  }
  res.json(clients);
});

app.post('/api/clients', authMiddleware, async (req, res) => {
  const { name, phone, business_name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  // Check plan limit
  const count = db.prepare('SELECT COUNT(*) as count FROM clients WHERE user_id = ?').get(req.userId);
  if (count.count >= req.user.plan_bots_limit) {
    return res.status(403).json({
      error: `Límite de ${req.user.plan_bots_limit} bot(s) alcanzado. Actualizá tu plan para crear más.`,
      plan: req.user.plan,
      limit: req.user.plan_bots_limit,
    });
  }

  const id = uuid();
  db.prepare('INSERT INTO clients (id, user_id, name, phone, business_name, status) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.userId, name, phone || '', business_name || name, 'starting');

  const config = {
    name: business_name || name,
    prefix: process.env.BOT_PREFIX || '!',
    cooldown: parseInt(process.env.BOT_COOLDOWN || '172800'),
  };
  botManager.startClient(id, config);

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  res.status(201).json(client);
});

app.delete('/api/clients/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (req.user.role !== 'admin' && client.user_id !== req.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  botManager.stopClient(id);
  db.prepare('DELETE FROM clients WHERE id = ?').run(id);
  res.json({ success: true });
});

app.put('/api/clients/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (req.user.role !== 'admin' && client.user_id !== req.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { name, phone, business_name } = req.body;
  db.prepare('UPDATE clients SET name = COALESCE(?, name), phone = COALESCE(?, phone), business_name = COALESCE(?, business_name) WHERE id = ?')
    .run(name || null, phone !== undefined ? phone : null, business_name || null, id);
  const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  res.json(updated);
});

app.post('/api/clients/:id/restart', authMiddleware, (req, res) => {
  const { id } = req.params;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (req.user.role !== 'admin' && client.user_id !== req.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  botManager.stopClient(id);
  const settings = db.prepare('SELECT * FROM client_settings WHERE client_id = ?').all(id);
  const config = { name: client.business_name || client.name };
  for (const s of settings) config[s.key] = s.value;
  setTimeout(() => botManager.startClient(id, config), 1000);
  res.json({ success: true });
});

// ─── Client Status & QR ─────────────────────────────────────────
app.get('/api/clients/:id/status', authMiddleware, (req, res) => {
  const { id } = req.params;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (req.user.role !== 'admin' && client.user_id !== req.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const status = botManager.getClientStatus(id);
  res.json({ ...client, ...status });
});

app.get('/api/clients/:id/qr', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (req.user.role !== 'admin' && client.user_id !== req.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const rawQr = botManager.getQR(id);
  if (!rawQr) return res.json({ qr: null });
  try {
    const dataUrl = await qrcode.toDataURL(rawQr, { scale: 6, margin: 1 });
    res.json({ qr: dataUrl });
  } catch {
    res.json({ qr: null });
  }
});

app.get('/api/clients/:id/stream', authMiddleware, (req, res) => {
  const { id } = req.params;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (req.user.role !== 'admin' && client.user_id !== req.userId) {
    return res.status(403).end();
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  botManager.subscribe(id, async (event) => {
    if (event.type === 'qr' && event.qr) {
      try {
        event.qr = await qrcode.toDataURL(event.qr, { scale: 6, margin: 1 });
      } catch {}
    }
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });
  req.on('close', () => botManager.unsubscribe(id));
});

// ─── Products ───────────────────────────────────────────────────
app.get('/api/clients/:id/products', authMiddleware, (req, res) => {
  const { id } = req.params;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (req.user.role !== 'admin' && client.user_id !== req.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const products = db.prepare('SELECT * FROM client_products WHERE client_id = ? ORDER BY sort_order').all(id);
  res.json(products);
});

app.post('/api/clients/:id/products', authMiddleware, (req, res) => {
  const { id } = req.params;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (req.user.role !== 'admin' && client.user_id !== req.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { name, description, price, category, emoji } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM client_products WHERE client_id = ?').get(id);
  const result = db.prepare(
    'INSERT INTO client_products (client_id, name, description, price, category, emoji, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, name, description || '', price || null, category || 'General', emoji || '🔹', maxOrder.next);
  const product = db.prepare('SELECT * FROM client_products WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(product);
});

app.put('/api/clients/:id/products/:productId', authMiddleware, (req, res) => {
  const { id, productId } = req.params;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (req.user.role !== 'admin' && client.user_id !== req.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { name, description, price, category, emoji } = req.body;
  db.prepare(
    'UPDATE client_products SET name = ?, description = ?, price = ?, category = ?, emoji = ? WHERE id = ? AND client_id = ?'
  ).run(name, description, price, category, emoji, productId, id);
  const product = db.prepare('SELECT * FROM client_products WHERE id = ?').get(productId);
  res.json(product);
});

app.delete('/api/clients/:id/products/:productId', authMiddleware, (req, res) => {
  const { id, productId } = req.params;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (req.user.role !== 'admin' && client.user_id !== req.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.prepare('DELETE FROM client_products WHERE id = ? AND client_id = ?').run(productId, id);
  res.json({ success: true });
});

// ─── Keywords / Auto-responder ──────────────────────────────────
const checkClientAccess = (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) { res.status(404).json({ error: 'Client not found' }); return null; }
  if (req.user.role !== 'admin' && client.user_id !== req.userId) { res.status(403).json({ error: 'Forbidden' }); return null; }
  return client;
};

app.get('/api/clients/:id/keywords', authMiddleware, (req, res) => {
  const client = checkClientAccess(req, res);
  if (!client) return;
  const keywords = db.prepare('SELECT * FROM client_keywords WHERE client_id = ? ORDER BY id').all(req.params.id);
  res.json(keywords);
});

app.post('/api/clients/:id/keywords', authMiddleware, (req, res) => {
  const client = checkClientAccess(req, res);
  if (!client) return;
  const { keyword, response, is_active } = req.body;
  if (!keyword || !response) return res.status(400).json({ error: 'Keyword y respuesta requeridos' });
  try {
    const result = db.prepare('INSERT INTO client_keywords (client_id, keyword, response, is_active) VALUES (?, ?, ?, ?)')
      .run(req.params.id, keyword.toLowerCase().trim(), response, is_active ?? 1);
    const kw = db.prepare('SELECT * FROM client_keywords WHERE id = ?').get(result.lastInsertRowid);
    botManager.syncClientKeywords(req.params.id);
    res.status(201).json(kw);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Esa keyword ya existe' });
    throw e;
  }
});

app.put('/api/clients/:id/keywords/:kwId', authMiddleware, (req, res) => {
  const client = checkClientAccess(req, res);
  if (!client) return;
  const { keyword, response, is_active } = req.body;
  db.prepare('UPDATE client_keywords SET keyword = ?, response = ?, is_active = ? WHERE id = ? AND client_id = ?')
    .run(keyword?.toLowerCase().trim(), response, is_active ?? 1, req.params.kwId, req.params.id);
  const kw = db.prepare('SELECT * FROM client_keywords WHERE id = ?').get(req.params.kwId);
  botManager.syncClientKeywords(req.params.id);
  res.json(kw);
});

app.delete('/api/clients/:id/keywords/:kwId', authMiddleware, (req, res) => {
  const client = checkClientAccess(req, res);
  if (!client) return;
  db.prepare('DELETE FROM client_keywords WHERE id = ? AND client_id = ?').run(req.params.kwId, req.params.id);
  botManager.syncClientKeywords(req.params.id);
  res.json({ success: true });
});

// ─── Settings ───────────────────────────────────────────────────
app.get('/api/clients/:id/settings', authMiddleware, (req, res) => {
  const { id } = req.params;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (req.user.role !== 'admin' && client.user_id !== req.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const rows = db.prepare('SELECT * FROM client_settings WHERE client_id = ?').all(id);
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  res.json(settings);
});

app.put('/api/clients/:id/settings', authMiddleware, (req, res) => {
  const { id } = req.params;
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (req.user.role !== 'admin' && client.user_id !== req.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const upsert = db.prepare(
    'INSERT INTO client_settings (client_id, key, value) VALUES (?, ?, ?) ON CONFLICT(client_id, key) DO UPDATE SET value = excluded.value'
  );
  const txn = db.transaction((settings) => {
    for (const [key, value] of Object.entries(settings)) {
      upsert.run(id, key, String(value));
    }
  });
  txn(req.body);
  res.json({ success: true });
});

app.get('/api/settings', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM global_settings').all();
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  res.json(settings);
});

app.put('/api/settings', authMiddleware, adminMiddleware, (req, res) => {
  const upsert = db.prepare(
    'INSERT INTO global_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const txn = db.transaction((settings) => {
    for (const [key, value] of Object.entries(settings)) {
      upsert.run(key, String(value));
    }
  });
  txn(req.body);
  if (['paypal_client_id', 'paypal_client_secret', 'paypal_mode'].some(k => k in req.body)) reloadPayPalConfig();
  res.json({ success: true });
});

// ─── Plans / PayPal ─────────────────────────────────────────────
app.get('/api/plans', (req, res) => {
  res.json([
    { id: 'free', name: 'Gratuito', price: 0, bots: 1, features: ['1 bot', 'Todas las funciones', 'Sin límite de tiempo'] },
    { id: 'premium', name: 'Premium', price: 9.99, bots: 5, features: ['Hasta 5 bots', 'Todas las funciones', 'Soporte prioritario'] },
    { id: 'unlimited', name: 'Ilimitado', price: 24.99, bots: 999, features: ['Bots ilimitados', 'Todas las funciones', 'Soporte VIP'] },
  ]);
});

app.post('/api/create-preference', authMiddleware, async (req, res) => {
  try {
    const { plan_id } = req.body;
    const plans = { premium: { price: 9.99, bots: 5, name: 'Premium' }, unlimited: { price: 24.99, bots: 999, name: 'Ilimitado' } };
    const plan = plans[plan_id];
    if (!plan) return res.status(400).json({ error: 'Plan inválido' });
    if (!isPayPalConfigured()) return res.status(400).json({ error: 'PayPal no está configurado. Contactá al administrador.' });

    const externalRef = `${req.userId}_${plan_id}_${Date.now()}`;
    const host = req.get('host');
    const protocol = req.protocol;
    const base = `${protocol}://${host}`;

    const result = await createOrder({
      title: `Plan ${plan.name} - BotAr`,
      price: plan.price,
      description: `${plan.bots} bot(s) - ${plan.name}`,
      externalReference: externalRef,
      returnUrl: `${base}/api/paypal/capture?external_ref=${externalRef}`,
      cancelUrl: `${base}/`,
    });

    const subId = `paypal_${req.userId}_${plan_id}_${Date.now()}`;
    db.prepare('INSERT INTO subscriptions (id, user_id, plan, status, mp_preference_id) VALUES (?, ?, ?, ?, ?)')
      .run(subId, req.userId, plan_id, 'pending', result.id);

    res.json({ approve_link: result.approveLink, order_id: result.id });
  } catch (err) {
    console.error('[PayPal] createOrder error:', err.message);
    res.status(500).json({ error: 'Error al crear el pago en PayPal' });
  }
});

app.get('/api/paypal/capture', async (req, res) => {
  try {
    const { token: orderId, external_ref } = req.query;
    if (!orderId) return res.redirect('/?error=missing_token');

    const result = await captureOrder(orderId);
    if (result.captureStatus === 'COMPLETED') {
      const ref = result.externalReference || external_ref;
      if (ref) {
        const parts = ref.split('_');
        const userId = parts[0];
        const planId = parts[1];
        const limits = { premium: 5, unlimited: 999 };
        const newLimit = limits[planId] || 1;

        db.prepare('UPDATE users SET plan = ?, plan_bots_limit = ? WHERE id = ?')
          .run(planId, newLimit, userId);
        db.prepare(`UPDATE subscriptions SET status = 'active', mp_payment_id = ?, end_date = datetime("now", "+30 days") WHERE user_id = ? AND plan = ? AND status = 'pending'`)
          .run(result.captureId, userId, planId);
      }
    }
    res.redirect('/');
  } catch (err) {
    console.error('[PayPal] capture error:', err.message);
    res.redirect('/?error=capture_failed');
  }
});

app.post('/api/paypal/webhook', async (req, res) => {
  try {
    if (!isPayPalConfigured()) return res.sendStatus(200);

    const eventType = req.body?.event_type;
    console.log('[PayPal] Webhook:', eventType);

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const resource = req.body?.resource;
      const customId = resource?.custom_id;
      if (customId) {
        const parts = customId.split('_');
        const userId = parts[0];
        const planId = parts[1];
        const limits = { premium: 5, unlimited: 999 };
        const newLimit = limits[planId] || 1;

        db.prepare('UPDATE users SET plan = ?, plan_bots_limit = ? WHERE id = ?')
          .run(planId, newLimit, userId);
        db.prepare(`UPDATE subscriptions SET status = 'active', mp_payment_id = ?, end_date = datetime("now", "+30 days") WHERE user_id = ? AND plan = ? AND status = 'pending'`)
          .run(resource.id, userId, planId);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[PayPal] Webhook error:', err.message);
    res.sendStatus(200);
  }
});

// ─── Init PayPal ────────────────────────────────────────────────
function reloadPayPalConfig() {
  const clientId = db.prepare("SELECT value FROM global_settings WHERE key = 'paypal_client_id'").get()?.value || process.env.PAYPAL_CLIENT_ID;
  const clientSecret = db.prepare("SELECT value FROM global_settings WHERE key = 'paypal_client_secret'").get()?.value || process.env.PAYPAL_CLIENT_SECRET;
  const mode = db.prepare("SELECT value FROM global_settings WHERE key = 'paypal_mode'").get()?.value || process.env.PAYPAL_MODE || 'sandbox';
  if (clientId && clientSecret) {
    configurePayPal({ clientId, clientSecret, mode });
    console.log(`[PayPal] Configured (${mode})`);
  } else {
    console.log('[PayPal] Not configured (set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET)');
  }
}
reloadPayPalConfig();

// ─── Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Dashboard] Server running on http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
  console.log('[Dashboard] Shutting down...');
  await botManager.stopAll();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await botManager.stopAll();
  process.exit(0);
});