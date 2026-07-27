require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./database');

console.log('\n=== SEED DATA ===');
console.log('[Seed] Memulai pengisian data awal...\n');

const adminExists = db.prepare('SELECT id FROM admin WHERE username = ?').get('admin');
if (!adminExists) {
  console.log('[Seed] Membuat akun admin...');
  const hashed = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO admin (username, password) VALUES (?, ?)').run('admin', hashed);
  console.log('[Seed] ✓ Akun admin dibuat: username=admin, password=admin123');
} else {
  console.log('[Seed] - Akun admin sudah ada, skip.');
}

const profile = db.prepare('SELECT id FROM profile WHERE id = 1').get();
if (!profile) {
  console.log('[Seed] Membuat profile default...');
  db.prepare(`INSERT INTO profile (name, title, bio, email, phone, location, linkedin, github, website)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    'Nama Kamu',
    'Web Developer',
    'Tulis bio singkat tentang dirimu di sini.',
    'email@example.com',
    '0812-3456-7890',
    'Kota, Indonesia',
    'https://linkedin.com/in/username',
    'https://github.com/username',
    'https://websitekamu.com'
  );
  console.log('[Seed] ✓ Profile default dibuat.');
} else {
  console.log('[Seed] - Profile sudah ada, skip.');
}

const expCount = db.prepare('SELECT COUNT(*) as c FROM experiences').get().c;
if (expCount === 0) {
  console.log('[Seed] Membuat data pengalaman default...');
  const insert = db.prepare('INSERT INTO experiences (position, company, location, start_date, end_date, current, description, order_index) VALUES (?,?,?,?,?,?,?,?)');
  insert.run('Web Developer', 'Perusahaan ABC', 'Jakarta', '2022-01', '2024-06', 0, 'Mengembangkan website perusahaan menggunakan React dan Node.js.', 1);
  console.log('[Seed]   ✓ Web Developer - Perusahaan ABC (2022-2024)');
  insert.run('Junior Developer', 'Startup XYZ', 'Bandung', '2020-07', '2021-12', 0, 'Membantu pengembangan fitur backend dengan Express.js.', 2);
  console.log('[Seed]   ✓ Junior Developer - Startup XYZ (2020-2021)');
} else {
  console.log('[Seed] - Data pengalaman sudah ada, skip.');
}

const eduCount = db.prepare('SELECT COUNT(*) as c FROM education').get().c;
if (eduCount === 0) {
  console.log('[Seed] Membuat data pendidikan default...');
  const insert = db.prepare('INSERT INTO education (degree, institution, field, start_year, end_year, description, order_index) VALUES (?,?,?,?,?,?,?)');
  insert.run('S1 Teknik Informatika', 'Universitas Indonesia', 'Ilmu Komputer', '2016', '2020', 'Lulus dengan predikat cumlaude.', 1);
  console.log('[Seed]   ✓ S1 Teknik Informatika - Universitas Indonesia (2016-2020)');
} else {
  console.log('[Seed] - Data pendidikan sudah ada, skip.');
}

const skillCount = db.prepare('SELECT COUNT(*) as c FROM skills').get().c;
if (skillCount === 0) {
  console.log('[Seed] Membuat data skills default...');
  const insert = db.prepare('INSERT INTO skills (name, category, level, order_index) VALUES (?,?,?,?)');
  insert.run('JavaScript', 'Frontend', 80, 1);
  console.log('[Seed]   ✓ JavaScript (Frontend) - 80%');
  insert.run('React', 'Frontend', 75, 2);
  console.log('[Seed]   ✓ React (Frontend) - 75%');
  insert.run('HTML & CSS', 'Frontend', 85, 3);
  console.log('[Seed]   ✓ HTML & CSS (Frontend) - 85%');
  insert.run('Node.js', 'Backend', 70, 4);
  console.log('[Seed]   ✓ Node.js (Backend) - 70%');
  insert.run('Express.js', 'Backend', 65, 5);
  console.log('[Seed]   ✓ Express.js (Backend) - 65%');
  insert.run('SQLite / MySQL', 'Database', 60, 6);
  console.log('[Seed]   ✓ SQLite/MySQL (Database) - 60%');
} else {
  console.log('[Seed] - Data skills sudah ada, skip.');
}

console.log('\n[Seed] ✅ Seed selesai! Semua data awal berhasil diisi.\n');
