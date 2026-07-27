const Database = require('better-sqlite3');
const path = require('path');

console.log('=== DATABASE ===');
console.log('[DB] Membuka koneksi ke SQLite...');

const db = new Database(path.join(__dirname, 'cv.db'));
console.log('[DB] Koneksi berhasil! File database: cv.db');

db.pragma('journal_mode = WAL');
console.log('[DB] Journal mode: WAL');

db.pragma('foreign_keys = ON');
console.log('[DB] Foreign keys: ON');

console.log('[DB] Membuat tabel-tabel jika belum ada...');

db.exec(`
  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    photo TEXT DEFAULT NULL,
    bio TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    linkedin TEXT NOT NULL DEFAULT '',
    github TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS experiences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    position TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL,
    end_date TEXT DEFAULT NULL,
    current INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    order_index INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS education (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    degree TEXT NOT NULL,
    institution TEXT NOT NULL,
    field TEXT NOT NULL DEFAULT '',
    start_year TEXT NOT NULL,
    end_year TEXT DEFAULT NULL,
    description TEXT NOT NULL DEFAULT '',
    order_index INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Lainnya',
    level INTEGER NOT NULL DEFAULT 50,
    order_index INTEGER NOT NULL DEFAULT 0
  );
`);

console.log('[DB] Tabel berhasil dibuat/dicek: admin, profile, experiences, education, skills');
console.log('[DB] Database siap digunakan!\n');

module.exports = db;
