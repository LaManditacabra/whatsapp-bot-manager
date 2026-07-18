import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || join(__dirname, '..', '..', 'data');
const DB_PATH = join(DATA_DIR, 'dashboard.db');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    plan TEXT NOT NULL DEFAULT 'free',
    plan_bots_limit INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    business_name TEXT,
    status TEXT DEFAULT 'offline',
    last_seen TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS client_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price REAL,
    category TEXT DEFAULT 'General',
    emoji TEXT DEFAULT '🔹',
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS client_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    UNIQUE(client_id, key),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS client_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    response TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    UNIQUE(client_id, keyword),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS global_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ticket_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    mp_preference_id TEXT,
    mp_payment_id TEXT,
    start_date TEXT DEFAULT (datetime('now')),
    end_date TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

  // Compatibility: add columns if missing (for upgrade from old schema)
  const tableInfo = db.prepare("PRAGMA table_info('users')").all();
  const hasUsername = tableInfo.some(c => c.name === 'username');
  if (hasUsername) {
    // Old schema: rename username -> email, add new columns
    db.exec(`
      ALTER TABLE users ADD COLUMN email TEXT;
      ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT '';
      ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
      ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
      ALTER TABLE users ADD COLUMN plan_bots_limit INTEGER NOT NULL DEFAULT 1;
      UPDATE users SET email = username;
    `);
    const firstUser = db.prepare("SELECT id FROM users ORDER BY created_at ASC LIMIT 1").get();
    if (firstUser) {
      db.prepare('UPDATE users SET role = ?, plan = ?, plan_bots_limit = ? WHERE id = ?').run('admin', 'premium', 999, firstUser.id);
    }
    console.log('[DB] Migrated from old schema');
  }

  const hasUserId = db.prepare("PRAGMA table_info('clients')").all().some(c => c.name === 'user_id');
  if (!hasUserId) {
    db.exec('ALTER TABLE clients ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE');
    const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
    if (admin) {
      db.prepare('UPDATE clients SET user_id = ? WHERE user_id IS NULL').run(admin.id);
    }
  }

const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (row.count === 0) {
  const hash = bcrypt.hashSync('admin', 10);
  db.prepare('INSERT INTO users (id, email, name, password_hash, role, plan, plan_bots_limit) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uuid(), 'admin', 'Admin', hash, 'admin', 'premium', 999);
  console.log('[DB] Default admin user created (admin / admin)');
} else {
  // Ensure at least one admin exists
  const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!admin) {
    const first = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get();
    if (first) {
      db.prepare('UPDATE users SET role = ?, plan = ?, plan_bots_limit = ? WHERE id = ?').run('admin', 'premium', 999, first.id);
      console.log(`[DB] Promoted ${first.id} to admin`);
    }
  }
}

export default db;
