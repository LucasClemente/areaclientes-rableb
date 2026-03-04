/**
 * Crea public/panel.sqlite con el esquema y usuario super_admin.
 * Ejecutar: node scripts/create-db.js
 */
import initSqlJs from 'sql.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const dbPath = join(publicDir, 'panel.sqlite');
const uploadsDir = join(publicDir, 'uploads');

const SQL = await initSqlJs();
const db = new SQL.Database();

db.run(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'user',
    name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
db.run(`
  CREATE TABLE login_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
db.run('CREATE INDEX IF NOT EXISTS idx_lc_email ON login_codes(email)');
db.run('CREATE INDEX IF NOT EXISTS idx_lc_expires ON login_codes(expires_at)');

db.run(`
  CREATE TABLE clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
db.run('CREATE INDEX IF NOT EXISTS idx_clients_slug ON clients(slug)');

db.run(`
  CREATE TABLE client_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(client_id, user_id)
  )
`);

db.run(`
  CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    period_date TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    uploaded_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
  )
`);

db.run(
  "INSERT INTO users (email, role, name) VALUES ('info@rableb.com','super_admin','Super Admin')"
);

const data = db.export();
const buffer = Buffer.from(data);
writeFileSync(dbPath, buffer);
db.close();

if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

console.log('✓ Base de datos creada:', dbPath);
console.log('✓ Carpeta uploads:', uploadsDir);
console.log('\nPodés iniciar sesión con: info@rableb.com');
