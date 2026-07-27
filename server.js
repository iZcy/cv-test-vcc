require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_ganti_yah';

function log(tag, msg) {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}][${tag}] ${msg}`);
}

console.log('\n=== SERVER START ===');
log('SERVER', 'Memulai Express.js...');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    log('MULTER', `Menyimpan file upload ke: public/uploads`);
    cb(null, path.join(__dirname, 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const filename = Date.now() + '-' + file.originalname;
    log('MULTER', `File asli: "${file.originalname}" -> disimpan sebagai: "${filename}"`);
    cb(null, filename);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      log('MULTER', `File "${file.originalname}" adalah GAMBAR (${file.mimetype}) ✅`);
      cb(null, true);
    } else {
      log('MULTER', `File "${file.originalname}" BUKAN gambar (${file.mimetype}) ❌`);
      cb(new Error('File harus gambar!'), false);
    }
  }
});
log('SERVER', 'Multer siap (upload file)');

app.set('view engine', 'ejs');
log('SERVER', 'View engine: EJS');

app.use(express.static(path.join(__dirname, 'public')));
log('SERVER', 'Static folder: /public');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
log('SERVER', 'Body parser: urlencoded + JSON');

app.use(cookieParser());
log('SERVER', 'Cookie parser siap');

app.use((req, res, next) => {
  log('REQUEST', `${req.method} ${req.url}`);
  if (req.method === 'POST' || req.method === 'PUT') {
    log('REQUEST-BODY', `Data diterima: ${JSON.stringify(req.body)}`);
  }
  next();
});
log('SERVER', 'Middleware request logger aktif');

function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  log('AUTH', `Memeriksa token...`);

  if (!token) {
    log('AUTH', '❌ Tidak ada token! Redirect ke /admin/login');
    return res.redirect('/admin/login');
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    log('AUTH', `✅ Token valid! User: ${req.user.username} (id: ${req.user.id})`);
    log('AUTH', `   Token akan expired: ${new Date(req.user.exp * 1000).toLocaleString()}`);
    next();
  } catch (err) {
    log('AUTH', `❌ Token tidak valid! Error: ${err.message}`);
    log('AUTH', '   Menghapus cookie token...');
    res.clearCookie('token');
    log('AUTH', '   Redirect ke halaman login');
    res.redirect('/admin/login');
  }
}

app.get('/', (req, res) => {
  log('ROUTE', '>>> [GET] / - Halaman CV Publik');
  log('DB', 'Mengambil data profile...');
  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
  log('DB', `   Profile: "${profile ? profile.name : 'Kosong'}"`);

  log('DB', 'Mengambil data experiences...');
  const experiences = db.prepare('SELECT * FROM experiences ORDER BY order_index ASC, start_date DESC').all();
  log('DB', `   Experiences: ${experiences.length} item`);

  log('DB', 'Mengambil data education...');
  const education = db.prepare('SELECT * FROM education ORDER BY order_index ASC, start_year DESC').all();
  log('DB', `   Education: ${education.length} item`);

  log('DB', 'Mengambil data skills...');
  const skills = db.prepare('SELECT * FROM skills ORDER BY order_index ASC, name ASC').all();
  log('DB', `   Skills: ${skills.length} item`);

  const categories = [...new Set(skills.map(s => s.category))];
  log('DB', `   Kategori skills: ${categories.join(', ')}`);

  log('RENDER', 'Merender template: index.ejs dengan data profile, experiences, education, skills');
  res.render('index', { profile, experiences, education, skills, categories });
  log('ROUTE', '<<< [GET] / - Selesai');
});

app.get('/admin/login', (req, res) => {
  log('ROUTE', '>>> [GET] /admin/login - Halaman login');
  const token = req.cookies.token;

  if (token) {
    log('AUTH', 'Token ditemukan, memeriksa validitas...');
    try {
      jwt.verify(token, JWT_SECRET);
      log('AUTH', 'Token masih valid! Redirect ke dashboard');
      return res.redirect('/admin/dashboard');
    } catch (err) {
      log('AUTH', `Token expired/tidak valid: ${err.message}`);
    }
  }

  log('RENDER', 'Merender template: admin/login.ejs');
  res.render('admin/login', { error: null });
  log('ROUTE', '<<< [GET] /admin/login - Selesai');
});

app.post('/admin/login', (req, res) => {
  log('ROUTE', '>>> [POST] /admin/login - Proses login');
  const { username, password } = req.body;
  log('AUTH', `Login attempt: username="${username}"`);

  log('DB', 'Mencari admin di database...');
  const admin = db.prepare('SELECT * FROM admin WHERE username = ?').get(username);

  if (!admin) {
    log('AUTH', `❌ Username "${username}" tidak ditemukan!`);
    log('RENDER', 'Merender login.ejs dengan pesan error');
    return res.render('admin/login', { error: 'Username atau password salah!' });
  }
  log('AUTH', `✅ Username "${username}" ditemukan di database`);

  log('AUTH', 'Membandingkan password (bcrypt)...');
  const passwordMatch = bcrypt.compareSync(password, admin.password);

  if (!passwordMatch) {
    log('AUTH', '❌ Password salah!');
    log('RENDER', 'Merender login.ejs dengan pesan error');
    return res.render('admin/login', { error: 'Username atau password salah!' });
  }
  log('AUTH', '✅ Password cocok!');

  log('AUTH', 'Membuat JWT token...');
  const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '7d' });
  log('AUTH', `✅ Token berhasil dibuat! Expired: 7 hari`);

  log('AUTH', 'Menyimpan token ke cookie (httpOnly)...');
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  log('AUTH', '✅ Cookie disimpan! Redirect ke /admin/dashboard');
  res.redirect('/admin/dashboard');
});

app.get('/admin/logout', (req, res) => {
  log('ROUTE', '>>> [GET] /admin/logout - Logout');
  log('AUTH', 'Menghapus cookie token...');
  res.clearCookie('token');
  log('AUTH', '✅ Cookie dihapus! Redirect ke /admin/login');
  res.redirect('/admin/login');
});

app.get('/admin/dashboard', authMiddleware, (req, res) => {
  log('ROUTE', `>>> [GET] /admin/dashboard - Dashboard (user: ${req.user.username})`);

  log('DB', 'Mengambil data untuk statistik dashboard...');
  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();

  const experiences = db.prepare('SELECT * FROM experiences ORDER BY order_index ASC').all();
  const education = db.prepare('SELECT * FROM education ORDER BY order_index ASC').all();
  const skills = db.prepare('SELECT * FROM skills ORDER BY order_index ASC').all();

  log('DB', `   Profile: ${profile ? profile.name : 'belum diisi'}`);
  log('DB', `   Experiences: ${experiences.length}`);
  log('DB', `   Education: ${education.length}`);
  log('DB', `   Skills: ${skills.length}`);

  log('RENDER', 'Merender template: admin/dashboard.ejs');
  res.render('admin/dashboard', {
    profile,
    stats: {
      experiences: experiences.length,
      education: education.length,
      skills: skills.length
    }
  });
  log('ROUTE', '<<< [GET] /admin/dashboard - Selesai');
});

app.get('/admin/profile', authMiddleware, (req, res) => {
  log('ROUTE', `>>> [GET] /admin/profile - Edit profile (user: ${req.user.username})`);

  log('DB', 'Mengambil data profile...');
  const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get() || {};
  log('DB', `   Nama: "${profile.name}", Title: "${profile.title}", Email: "${profile.email}"`);

  log('RENDER', 'Merender template: admin/profile.ejs');
  res.render('admin/profile', { profile, success: null, error: null });
  log('ROUTE', '<<< [GET] /admin/profile - Selesai');
});

app.post('/admin/profile', authMiddleware, upload.single('photo'), (req, res) => {
  log('ROUTE', `>>> [POST] /admin/profile - Menyimpan profile (user: ${req.user.username})`);
  const { name, title, bio, email, phone, location, linkedin, github, website } = req.body;

  log('DATA', `   name: "${name}"`);
  log('DATA', `   title: "${title}"`);
  log('DATA', `   email: "${email}"`);
  log('DATA', `   phone: "${phone}"`);
  log('DATA', `   location: "${location}"`);

  log('DB', 'Mengecek apakah profile sudah ada...');
  const existingProfile = db.prepare('SELECT * FROM profile WHERE id = 1').get();

  let photo = existingProfile?.photo || null;
  if (req.file) {
    photo = '/uploads/' + req.file.filename;
    log('DATA', `   photo: ${photo} (file baru diupload)`);
  } else {
    log('DATA', `   photo: ${photo || 'tidak ada'} (pakai foto lama)`);
  }

  if (existingProfile) {
    log('DB', 'Profile sudah ada -> UPDATE data...');
    db.prepare(`UPDATE profile SET name=?, title=?, photo=?, bio=?, email=?, phone=?, location=?, linkedin=?, github=?, website=? WHERE id=1`)
      .run(name, title, photo, bio, email, phone, location, linkedin, github, website);
    log('DB', '✅ Profile berhasil di UPDATE!');
  } else {
    log('DB', 'Profile belum ada -> INSERT data baru...');
    db.prepare(`INSERT INTO profile (name, title, photo, bio, email, phone, location, linkedin, github, website) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(name, title, photo, bio, email, phone, location, linkedin, github, website);
    log('DB', '✅ Profile baru berhasil di INSERT!');
  }

  log('RENDER', 'Merender admin/profile.ejs dengan pesan sukses');
  res.render('admin/profile', {
    profile: { ...req.body, photo },
    success: 'Profil berhasil disimpan!',
    error: null
  });
  log('ROUTE', '<<< [POST] /admin/profile - Selesai');
});

app.get('/admin/experiences', authMiddleware, (req, res) => {
  log('ROUTE', `>>> [GET] /admin/experiences - Manajemen experiences (user: ${req.user.username})`);
  log('DB', 'Mengambil semua data experiences...');
  const experiences = db.prepare('SELECT * FROM experiences ORDER BY order_index ASC').all();
  log('DB', `   Ditemukan ${experiences.length} experiences`);
  experiences.forEach((e, i) => log('DB', `   [${i+1}] ${e.position} @ ${e.company} (${e.start_date} - ${e.end_date || 'Sekarang'})`));

  log('RENDER', 'Merender template: admin/experiences.ejs');
  res.render('admin/experiences', { experiences, success: null, error: null });
  log('ROUTE', '<<< [GET] /admin/experiences - Selesai');
});

app.post('/admin/experiences', authMiddleware, (req, res) => {
  log('ROUTE', `>>> [POST] /admin/experiences - Menambah experience baru (user: ${req.user.username})`);
  const { position, company, location, start_date, end_date, current, description, order_index } = req.body;

  log('DATA', `   Posisi: "${position}"`);
  log('DATA', `   Perusahaan: "${company}"`);
  log('DATA', `   Periode: ${start_date} - ${current ? 'Sekarang (current)' : (end_date || '-')}`);

  log('DB', 'Menjalankan INSERT INTO experiences...');
  db.prepare('INSERT INTO experiences (position, company, location, start_date, end_date, current, description, order_index) VALUES (?,?,?,?,?,?,?,?)')
    .run(position, company, location, start_date, end_date || null, current ? 1 : 0, description, order_index || 0);
  log('DB', `✅ Experience "${position}" berhasil ditambahkan!`);
  log('ROUTE', '<<< Redirect ke /admin/experiences');
  res.redirect('/admin/experiences');
});

app.post('/admin/experiences/update/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  log('ROUTE', `>>> [POST] /admin/experiences/update/${id} - Update experience (user: ${req.user.username})`);
  const { position, company, location, start_date, end_date, current, description, order_index } = req.body;

  log('DATA', `   Posisi: "${position}"`);
  log('DATA', `   Perusahaan: "${company}"`);
  log('DATA', `   Periode: ${start_date} - ${current ? 'Sekarang' : (end_date || '-')}`);

  log('DB', `Menjalankan UPDATE experiences WHERE id = ${id}...`);
  db.prepare('UPDATE experiences SET position=?, company=?, location=?, start_date=?, end_date=?, current=?, description=?, order_index=? WHERE id=?')
    .run(position, company, location, start_date, end_date || null, current ? 1 : 0, description, order_index || 0, id);
  log('DB', `✅ Experience ID ${id} berhasil diupdate!`);
  log('ROUTE', '<<< Redirect ke /admin/experiences');
  res.redirect('/admin/experiences');
});

app.post('/admin/experiences/delete/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  log('ROUTE', `>>> [POST] /admin/experiences/delete/${id} - Hapus experience (user: ${req.user.username})`);

  log('DB', `Menjalankan DELETE FROM experiences WHERE id = ${id}...`);
  db.prepare('DELETE FROM experiences WHERE id = ?').run(id);
  log('DB', `✅ Experience ID ${id} berhasil dihapus!`);
  log('ROUTE', '<<< Redirect ke /admin/experiences');
  res.redirect('/admin/experiences');
});

app.get('/admin/education', authMiddleware, (req, res) => {
  log('ROUTE', `>>> [GET] /admin/education - Manajemen education (user: ${req.user.username})`);
  log('DB', 'Mengambil semua data education...');
  const education = db.prepare('SELECT * FROM education ORDER BY order_index ASC').all();
  log('DB', `   Ditemukan ${education.length} pendidikan`);
  education.forEach((e, i) => log('DB', `   [${i+1}] ${e.degree} @ ${e.institution} (${e.start_year} - ${e.end_year || 'Sekarang'})`));

  log('RENDER', 'Merender template: admin/education.ejs');
  res.render('admin/education', { education, success: null, error: null });
  log('ROUTE', '<<< [GET] /admin/education - Selesai');
});

app.post('/admin/education', authMiddleware, (req, res) => {
  log('ROUTE', `>>> [POST] /admin/education - Menambah education baru (user: ${req.user.username})`);
  const { degree, institution, field, start_year, end_year, description, order_index } = req.body;

  log('DATA', `   Degree: "${degree}"`);
  log('DATA', `   Institusi: "${institution}"`);
  log('DATA', `   Tahun: ${start_year} - ${end_year || 'Sekarang'}`);

  log('DB', 'Menjalankan INSERT INTO education...');
  db.prepare('INSERT INTO education (degree, institution, field, start_year, end_year, description, order_index) VALUES (?,?,?,?,?,?,?)')
    .run(degree, institution, field, start_year, end_year || null, description, order_index || 0);
  log('DB', `✅ Education "${degree}" berhasil ditambahkan!`);
  res.redirect('/admin/education');
});

app.post('/admin/education/update/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  log('ROUTE', `>>> [POST] /admin/education/update/${id} - Update education (user: ${req.user.username})`);
  const { degree, institution, field, start_year, end_year, description, order_index } = req.body;

  log('DATA', `   Degree: "${degree}"`);
  log('DATA', `   Institusi: "${institution}"`);
  log('DATA', `   Tahun: ${start_year} - ${end_year || 'Sekarang'}`);

  log('DB', `Menjalankan UPDATE education WHERE id = ${id}...`);
  db.prepare('UPDATE education SET degree=?, institution=?, field=?, start_year=?, end_year=?, description=?, order_index=? WHERE id=?')
    .run(degree, institution, field, start_year, end_year || null, description, order_index || 0, id);
  log('DB', `✅ Education ID ${id} berhasil diupdate!`);
  res.redirect('/admin/education');
});

app.post('/admin/education/delete/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  log('ROUTE', `>>> [POST] /admin/education/delete/${id} - Hapus education (user: ${req.user.username})`);
  log('DB', `Menjalankan DELETE FROM education WHERE id = ${id}...`);
  db.prepare('DELETE FROM education WHERE id = ?').run(id);
  log('DB', `✅ Education ID ${id} berhasil dihapus!`);
  res.redirect('/admin/education');
});

app.get('/admin/skills', authMiddleware, (req, res) => {
  log('ROUTE', `>>> [GET] /admin/skills - Manajemen skills (user: ${req.user.username})`);
  log('DB', 'Mengambil semua data skills...');
  const skills = db.prepare('SELECT * FROM skills ORDER BY category ASC, order_index ASC').all();
  log('DB', `   Ditemukan ${skills.length} skills`);

  log('DB', 'Mengambil daftar kategori...');
  const categories = db.prepare('SELECT DISTINCT category FROM skills ORDER BY category ASC').all().map(c => c.category);
  log('DB', `   Kategori: ${categories.join(', ') || 'belum ada'}`);

  log('RENDER', 'Merender template: admin/skills.ejs');
  res.render('admin/skills', { skills, categories, success: null, error: null });
  log('ROUTE', '<<< [GET] /admin/skills - Selesai');
});

app.post('/admin/skills', authMiddleware, (req, res) => {
  log('ROUTE', `>>> [POST] /admin/skills - Menambah skill baru (user: ${req.user.username})`);
  const { name, category, level, order_index } = req.body;
  log('DATA', `   Skill: "${name}"`);
  log('DATA', `   Kategori: "${category || 'Lainnya'}"`);
  log('DATA', `   Level: ${Number(level) || 50}%`);

  log('DB', 'Menjalankan INSERT INTO skills...');
  db.prepare('INSERT INTO skills (name, category, level, order_index) VALUES (?,?,?,?)')
    .run(name, category || 'Lainnya', Number(level) || 50, order_index || 0);
  log('DB', `✅ Skill "${name}" berhasil ditambahkan!`);
  res.redirect('/admin/skills');
});

app.post('/admin/skills/update/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  log('ROUTE', `>>> [POST] /admin/skills/update/${id} - Update skill (user: ${req.user.username})`);
  const { name, category, level, order_index } = req.body;
  log('DATA', `   Skill: "${name}", Kategori: "${category}", Level: ${Number(level) || 50}%`);

  log('DB', `Menjalankan UPDATE skills WHERE id = ${id}...`);
  db.prepare('UPDATE skills SET name=?, category=?, level=?, order_index=? WHERE id=?')
    .run(name, category || 'Lainnya', Number(level) || 50, order_index || 0, id);
  log('DB', `✅ Skill ID ${id} berhasil diupdate!`);
  res.redirect('/admin/skills');
});

app.post('/admin/skills/delete/:id', authMiddleware, (req, res) => {
  const id = req.params.id;
  log('ROUTE', `>>> [POST] /admin/skills/delete/${id} - Hapus skill (user: ${req.user.username})`);
  log('DB', `Menjalankan DELETE FROM skills WHERE id = ${id}...`);
  db.prepare('DELETE FROM skills WHERE id = ?').run(id);
  log('DB', `✅ Skill ID ${id} berhasil dihapus!`);
  res.redirect('/admin/skills');
});

app.get('/admin/password', authMiddleware, (req, res) => {
  log('ROUTE', `>>> [GET] /admin/password - Ganti password (user: ${req.user.username})`);
  log('RENDER', 'Merender template: admin/password.ejs');
  res.render('admin/password', { success: null, error: null });
  log('ROUTE', '<<< [GET] /admin/password - Selesai');
});

app.post('/admin/password', authMiddleware, (req, res) => {
  log('ROUTE', `>>> [POST] /admin/password - Proses ganti password (user: ${req.user.username})`);
  const { old_password, new_password, confirm_password } = req.body;

  log('DB', 'Mengambil data admin dari database...');
  const admin = db.prepare('SELECT * FROM admin WHERE id = ?').get(req.user.id);
  log('DB', `   Admin ditemukan: ${admin.username}`);

  log('AUTH', 'Memeriksa password lama...');
  if (!bcrypt.compareSync(old_password, admin.password)) {
    log('AUTH', '❌ Password lama salah!');
    return res.render('admin/password', { success: null, error: 'Password lama salah!' });
  }
  log('AUTH', '✅ Password lama cocok!');

  log('AUTH', 'Memeriksa kecocokan password baru...');
  if (new_password !== confirm_password) {
    log('AUTH', '❌ Password baru tidak cocok dengan konfirmasi!');
    return res.render('admin/password', { success: null, error: 'Password baru tidak cocok!' });
  }
  log('AUTH', '✅ Password baru cocok!');

  if (new_password.length < 4) {
    log('AUTH', '❌ Password terlalu pendek!');
    return res.render('admin/password', { success: null, error: 'Password minimal 4 karakter!' });
  }
  log('AUTH', `✅ Password baru: ${new_password.length} karakter`);

  log('AUTH', 'Hash password baru dengan bcrypt...');
  const hashed = bcrypt.hashSync(new_password, 10);
  log('AUTH', '✅ Hash selesai!');

  log('DB', 'Menyimpan password baru ke database...');
  db.prepare('UPDATE admin SET password = ? WHERE id = ?').run(hashed, req.user.id);
  log('DB', '✅ Password berhasil diupdate!');

  log('RENDER', 'Merender admin/password.ejs dengan pesan sukses');
  res.render('admin/password', { success: 'Password berhasil diganti!', error: null });
  log('ROUTE', '<<< [POST] /admin/password - Selesai');
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  log('SERVER', `✅ Website:    http://localhost:${PORT}`);
  log('SERVER', `✅ Admin Panel: http://localhost:${PORT}/admin/login`);
  log('SERVER', `✅ Mode:        ${process.env.NODE_ENV || 'development'}`);
  console.log(`========================================\n`);
});
