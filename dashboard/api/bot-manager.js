import { fork } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(__dirname, '..', '..', 'bot', 'worker.js');
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', '..', 'data');

export class BotManager {
  constructor(db) {
    this.db = db;
    this.instances = new Map();   // clientId -> { process, status, qr, subscribers }
    this._startExistingClients();
  }

  _startExistingClients() {
    const clients = this.db.prepare('SELECT * FROM clients').all();
    for (const client of clients) {
      const settings = this.db.prepare('SELECT * FROM client_settings WHERE client_id = ?').all(client.id);
      const config = { name: client.business_name || client.name };
      for (const s of settings) config[s.key] = s.value;
      this.startClient(client.id, config);
    }
  }

  startClient(clientId, config) {
    if (this.instances.has(clientId)) return;

    const clientDir = join(DATA_DIR, 'clients', clientId);
    if (!existsSync(clientDir)) mkdirSync(clientDir, { recursive: true });

    const authDir = join(clientDir, 'auth');
    if (!existsSync(authDir)) mkdirSync(authDir, { recursive: true });

    // Sync data from dashboard DB to the client's bot.db
    this._syncClientDb(clientId);

    writeFileSync(join(clientDir, 'config.json'), JSON.stringify({ id: clientId, authDir, ...config }));

    const worker = fork(WORKER_PATH, [], {
      cwd: join(__dirname, '..', '..'),
      env: { ...process.env, CLIENT_ID: clientId, DATA_DIR },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    const entry = {
      process: worker,
      status: 'starting',
      qr: null,
      subscribers: [],
      lastHeartbeat: Date.now(),
      restartCount: 0,
      restartTimer: null,
      heartbeatTimer: null,
    };

    worker.on('message', (msg) => {
      if (msg.type === 'qr') {
        entry.qr = msg.qr;
        entry.status = 'awaiting_scan';
        this.db.prepare('UPDATE clients SET status = ? WHERE id = ?').run('awaiting_scan', clientId);
        this._notify(clientId, { type: 'qr', qr: msg.qr });
      } else if (msg.type === 'connected') {
        entry.status = 'online';
        entry.qr = null;
        this.db.prepare('UPDATE clients SET status = ?, last_seen = datetime(\'now\') WHERE id = ?').run('online', clientId);
        this._notify(clientId, { type: 'status', status: 'online' });
      } else if (msg.type === 'disconnected') {
        entry.status = 'offline';
        this.db.prepare('UPDATE clients SET status = ? WHERE id = ?').run('offline', clientId);
        this._notify(clientId, { type: 'status', status: 'offline' });
      } else if (msg.type === 'error') {
        entry.status = 'error';
        this.db.prepare('UPDATE clients SET status = ? WHERE id = ?').run('error', clientId);
        this._notify(clientId, { type: 'error', error: msg.error });
      } else if (msg.type === 'ready') {
        entry.restartCount = 0;
        // Don't set online — wait for actual 'connected' event
      } else if (msg.type === 'heartbeat') {
        entry.lastHeartbeat = Date.now();
      } else if (msg.type === 'new_order') {
        // Create notification for the bot owner
        try {
          const client = this.db.prepare('SELECT * FROM clients WHERE id = ?').get(msg.clientId);
          if (client) {
            this.db.prepare('INSERT INTO notifications (user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?)')
              .run(client.user_id, 'order', '🛵 Nuevo pedido', msg.items,
                JSON.stringify({ clientId: msg.clientId, orderId: msg.orderId, items: msg.items, userName: msg.userName }));
          }
        } catch (e) {
          console.error(`[BotManager] Error creating order notification:`, e.message);
        }
      } else if (msg.type === 'comprobante') {
        try {
          const client = this.db.prepare('SELECT * FROM clients WHERE id = ?').get(msg.clientId);
          if (client) {
            this.db.prepare('INSERT INTO notifications (user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?)')
              .run(client.user_id, 'comprobante', '📸 Comprobante recibido',
                `${msg.userName} envió comprobante para ${msg.productName}`,
                JSON.stringify({ clientId: msg.clientId, productId: msg.productId, productName: msg.productName, userName: msg.userName }));
          }
        } catch (e) {
          console.error(`[BotManager] Error creating comprobante notification:`, e.message);
        }
      }
    });

    worker.on('exit', (code) => {
      entry.status = 'offline';
      this.db.prepare('UPDATE clients SET status = ? WHERE id = ?').run('offline', clientId);
      this._notify(clientId, { type: 'status', status: 'offline' });
      this.instances.delete(clientId);

      // Auto-restart on unexpected exit (not logged out)
      if (code !== 0 && code !== null) {
        console.log(`[BotManager] Worker ${clientId} exited with code ${code}, restarting...`);
        entry.restartCount++;
        const delay = Math.min(5000 * entry.restartCount, 60000);
        entry.restartTimer = setTimeout(() => {
          const settings = this.db.prepare('SELECT * FROM client_settings WHERE client_id = ?').all(clientId);
          const config = { name: clientId };
          for (const s of settings) config[s.key] = s.value;
          this.startClient(clientId, config);
        }, delay);
      }
    });

    // Heartbeat monitor — restart if no heartbeat for 90s
    entry.heartbeatTimer = setInterval(() => {
      const elapsed = Date.now() - entry.lastHeartbeat;
      if (elapsed > 90000 && entry.status === 'online') {
        console.log(`[BotManager] Worker ${clientId} heartbeat timeout (${elapsed}ms), restarting...`);
        this.stopClient(clientId);
      }
    }, 30000);

    worker.stdout.on('data', (data) => {
      console.log(`[Bot ${clientId}] ${data.toString().trim()}`);
    });
    worker.stderr.on('data', (data) => {
      console.error(`[Bot ${clientId} ERROR] ${data.toString().trim()}`);
    });

    this.instances.set(clientId, entry);
  }

  _syncClientDb(clientId) {
    let workerDb;
    try {
      const clientDir = join(DATA_DIR, 'clients', clientId);
      const dbPath = join(clientDir, 'bot.db');

      workerDb = new Database(dbPath);
      workerDb.pragma('journal_mode = WAL');

      // Ensure tables exist
      workerDb.exec(`
        CREATE TABLE IF NOT EXISTS client_products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          price REAL,
          category TEXT DEFAULT 'General',
          emoji TEXT DEFAULT '🔹',
          image TEXT,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS client_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL,
          value TEXT,
          UNIQUE(key)
        );
        CREATE TABLE IF NOT EXISTS keywords (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          keyword TEXT NOT NULL UNIQUE,
          response TEXT NOT NULL,
          media_url TEXT,
          media_type TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS client_coupons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          discount_type TEXT NOT NULL DEFAULT 'percentage',
          discount_value REAL NOT NULL DEFAULT 10,
          max_uses INTEGER DEFAULT 0,
          used_count INTEGER DEFAULT 0,
          active INTEGER DEFAULT 1,
          expires_at TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS client_reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          message TEXT DEFAULT '',
          frequency TEXT NOT NULL DEFAULT 'once',
          day_of_week INTEGER,
          time TEXT NOT NULL DEFAULT '10:00',
          last_sent TEXT,
          active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          user_name TEXT DEFAULT '',
          items TEXT NOT NULL,
          total REAL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);

      // Migration: add image column to existing client_products
      try { workerDb.exec("ALTER TABLE client_products ADD COLUMN image TEXT"); } catch (e) { /* column may already exist */ }

      // Sync products - always re-sync to keep in sync with dashboard
      const products = this.db.prepare('SELECT * FROM client_products WHERE client_id = ?').all(clientId);
      const upsertProduct = workerDb.prepare(
        'INSERT OR REPLACE INTO client_products (id, name, description, price, category, emoji, image, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      workerDb.transaction(() => {
        workerDb.prepare('DELETE FROM client_products').run();
        for (const p of products) upsertProduct.run(p.id, p.name, p.description || '', p.price, p.category || 'General', p.emoji || '🔹', p.image || null, p.sort_order || 0);
      })();

      // Sync settings
      const settings = this.db.prepare('SELECT * FROM client_settings WHERE client_id = ?').all(clientId);
      if (settings.length > 0) {
        const insert = workerDb.prepare(
          'INSERT OR REPLACE INTO client_settings (key, value) VALUES (?, ?)'
        );
        const txn = workerDb.transaction((items) => {
          for (const s of items) insert.run(s.key, s.value);
        });
        txn(settings);
      }

      // Sync keywords
      workerDb.exec(`
        CREATE TABLE IF NOT EXISTS keywords (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          keyword TEXT NOT NULL UNIQUE,
          response TEXT NOT NULL,
          media_url TEXT,
          media_type TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        )
      `);
      const keywords = this.db.prepare('SELECT * FROM client_keywords WHERE client_id = ?').all(clientId);
      if (keywords.length > 0) {
        const upsert = workerDb.prepare(
          'INSERT OR REPLACE INTO keywords (keyword, response, is_active) VALUES (?, ?, ?)'
        );
        const txn = workerDb.transaction((items) => {
          for (const k of items) upsert.run(k.keyword, k.response, k.is_active);
        });
        txn(keywords);
      }
    } catch (err) {
      console.error(`[BotManager] Error syncing client DB for ${clientId}:`, err.message);
    } finally {
      if (workerDb) try { workerDb.close(); } catch {}
    }
  }

  syncClientKeywords(clientId) {
    let workerDb;
    try {
      workerDb = new Database(join(DATA_DIR, 'clients', clientId, 'bot.db'));
      workerDb.pragma('journal_mode = WAL');
      workerDb.exec(`CREATE TABLE IF NOT EXISTS keywords (id INTEGER PRIMARY KEY AUTOINCREMENT, keyword TEXT NOT NULL UNIQUE, response TEXT NOT NULL, media_url TEXT, media_type TEXT, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`);
      const upsert = workerDb.prepare('INSERT OR REPLACE INTO keywords (keyword, response, is_active) VALUES (?, ?, ?)');
      workerDb.transaction(() => {
        workerDb.prepare('DELETE FROM keywords').run();
        const keywords = this.db.prepare('SELECT * FROM client_keywords WHERE client_id = ?').all(clientId);
        for (const k of keywords) upsert.run(k.keyword, k.response, k.is_active);
      })();
    } catch (err) {
      console.error(`[BotManager] Error syncing keywords for ${clientId}:`, err.message);
    } finally {
      if (workerDb) try { workerDb.close(); } catch {}
    }
  }

  syncClientSettings(clientId) {
    let workerDb;
    try {
      workerDb = new Database(join(DATA_DIR, 'clients', clientId, 'bot.db'));
      workerDb.pragma('journal_mode = WAL');
      workerDb.exec(`CREATE TABLE IF NOT EXISTS client_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE, value TEXT)`);
      const upsert = workerDb.prepare('INSERT OR REPLACE INTO client_settings (key, value) VALUES (?, ?)');
      workerDb.transaction(() => {
        workerDb.prepare('DELETE FROM client_settings').run();
        const settings = this.db.prepare('SELECT * FROM client_settings WHERE client_id = ?').all(clientId);
        for (const s of settings) upsert.run(s.key, s.value);
      })();
      if (workerDb) { workerDb.close(); workerDb = null; }

      // Re-write config.json preserving existing properties
      const client = this.db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
      if (client) {
        const configPath = join(DATA_DIR, 'clients', clientId, 'config.json');
        let existing = {};
        try { existing = JSON.parse(readFileSync(configPath, 'utf-8')); } catch {}
        writeFileSync(configPath, JSON.stringify({ ...existing, id: clientId, name: client.name, phone: client.phone }, null, 2));
      }

      // Send IPC to worker if running
      const entry = this.instances.get(clientId);
      if (entry && entry.process.connected) {
        entry.process.send({ type: 'reload_settings' });
      }
    } catch (err) {
      console.error(`[BotManager] Error syncing settings for ${clientId}:`, err.message);
    } finally {
      if (workerDb) try { workerDb.close(); } catch {}
    }
  }

  syncClientProducts(clientId) {
    let workerDb;
    try {
      workerDb = new Database(join(DATA_DIR, 'clients', clientId, 'bot.db'));
      workerDb.pragma('journal_mode = WAL');
      workerDb.exec(`CREATE TABLE IF NOT EXISTS client_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT,
        price REAL, category TEXT DEFAULT 'General', emoji TEXT DEFAULT '🔹',
        image TEXT, stock INTEGER DEFAULT 0, payment_link TEXT, sort_order INTEGER DEFAULT 0
      )`);
      // Migration for existing tables
      try { workerDb.exec("ALTER TABLE client_products ADD COLUMN image TEXT"); } catch {}
      try { workerDb.exec("ALTER TABLE client_products ADD COLUMN stock INTEGER DEFAULT 0"); } catch {}
      try { workerDb.exec("ALTER TABLE client_products ADD COLUMN payment_link TEXT"); } catch {}
      const upsert = workerDb.prepare('INSERT OR REPLACE INTO client_products (id, name, description, price, category, emoji, image, stock, payment_link, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      workerDb.transaction(() => {
        workerDb.prepare('DELETE FROM client_products').run();
        const products = this.db.prepare('SELECT * FROM client_products WHERE client_id = ?').all(clientId);
        for (const p of products) upsert.run(p.id, p.name, p.description || '', p.price, p.category || 'General', p.emoji || '🔹', p.image || null, p.stock || 0, p.payment_link || null, p.sort_order || 0);
      })();
    } catch (err) {
      console.error(`[BotManager] Error syncing products for ${clientId}:`, err.message);
    } finally {
      if (workerDb) try { workerDb.close(); } catch {}
    }
  }

  syncClientCoupons(clientId) {
    let workerDb;
    try {
      workerDb = new Database(join(DATA_DIR, 'clients', clientId, 'bot.db'));
      workerDb.pragma('journal_mode = WAL');
      workerDb.exec(`CREATE TABLE IF NOT EXISTS client_coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE,
        discount_type TEXT NOT NULL DEFAULT 'percentage', discount_value REAL NOT NULL DEFAULT 10,
        max_uses INTEGER DEFAULT 0, used_count INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
        expires_at TEXT, created_at TEXT DEFAULT (datetime('now'))
      )`);
      const upsert = workerDb.prepare('INSERT OR REPLACE INTO client_coupons (id, code, discount_type, discount_value, max_uses, used_count, active, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      workerDb.transaction(() => {
        workerDb.prepare('DELETE FROM client_coupons').run();
        const coupons = this.db.prepare('SELECT * FROM client_coupons WHERE client_id = ?').all(clientId);
        for (const c of coupons) upsert.run(c.id, c.code, c.discount_type, c.discount_value, c.max_uses, c.used_count, c.active, c.expires_at);
      })();
    } catch (err) {
      console.error(`[BotManager] Error syncing coupons for ${clientId}:`, err.message);
    } finally {
      if (workerDb) try { workerDb.close(); } catch {}
    }
  }

  syncClientReminders(clientId) {
    let workerDb;
    try {
      workerDb = new Database(join(DATA_DIR, 'clients', clientId, 'bot.db'));
      workerDb.pragma('journal_mode = WAL');
      workerDb.exec(`CREATE TABLE IF NOT EXISTS client_reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, message TEXT DEFAULT '',
        frequency TEXT NOT NULL DEFAULT 'once', day_of_week INTEGER, time TEXT NOT NULL DEFAULT '10:00',
        last_sent TEXT, active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now'))
      )`);
      const upsert = workerDb.prepare('INSERT OR REPLACE INTO client_reminders (id, title, message, frequency, day_of_week, time, last_sent, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      workerDb.transaction(() => {
        workerDb.prepare('DELETE FROM client_reminders').run();
        const reminders = this.db.prepare('SELECT * FROM client_reminders WHERE client_id = ?').all(clientId);
        for (const r of reminders) upsert.run(r.id, r.title, r.message, r.frequency, r.day_of_week, r.time, r.last_sent, r.active);
      })();
    } catch (err) {
      console.error(`[BotManager] Error syncing reminders for ${clientId}:`, err.message);
    } finally {
      if (workerDb) try { workerDb.close(); } catch {}
    }
  }

  stopClient(clientId) {
    const entry = this.instances.get(clientId);
    if (!entry) return;
    if (entry.heartbeatTimer) clearInterval(entry.heartbeatTimer);
    if (entry.restartTimer) clearTimeout(entry.restartTimer);
    entry.process.kill('SIGTERM');
    setTimeout(() => {
      if (this.instances.has(clientId)) {
        entry.process.kill('SIGKILL');
        this.instances.delete(clientId);
      }
    }, 5000);
  }

  async stopAll() {
    const promises = [];
    for (const [clientId] of this.instances) {
      this.stopClient(clientId);
    }
  }

  getClientStatus(clientId) {
    const entry = this.instances.get(clientId);
    if (!entry) return { status: 'offline', qr: null };
    return { status: entry.status, qr: entry.qr };
  }

  getQR(clientId) {
    const entry = this.instances.get(clientId);
    return entry ? entry.qr : null;
  }

  subscribe(clientId, callback) {
    const entry = this.instances.get(clientId);
    if (entry) entry.subscribers.push(callback);
  }

  unsubscribe(clientId) {
    const entry = this.instances.get(clientId);
    if (entry) entry.subscribers = [];
  }

  _notify(clientId, event) {
    const entry = this.instances.get(clientId);
    if (entry) {
      for (const cb of entry.subscribers) {
        try { cb(event); } catch {}
      }
    }
  }
}
