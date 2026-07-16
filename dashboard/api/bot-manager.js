import { fork } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
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
    try {
      const clientDir = join(DATA_DIR, 'clients', clientId);
      const dbPath = join(clientDir, 'bot.db');

      const workerDb = new Database(dbPath);
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
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS client_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL,
          value TEXT,
          UNIQUE(key)
        );
      `);

      // Sync products
      const products = this.db.prepare('SELECT * FROM client_products WHERE client_id = ?').all(clientId);
      if (products.length > 0) {
        const existing = workerDb.prepare('SELECT COUNT(*) as count FROM client_products').get();
        if (existing.count === 0) {
          const insert = workerDb.prepare(
            'INSERT INTO client_products (name, description, price, category, emoji, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
          );
          const txn = workerDb.transaction((items) => {
            for (const p of items) insert.run(p.name, p.description || '', p.price, p.category || 'General', p.emoji || '🔹', p.sort_order || 0);
          });
          txn(products);
        }
      }

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

      workerDb.close();
    } catch (err) {
      console.error(`[BotManager] Error syncing client DB for ${clientId}:`, err.message);
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
