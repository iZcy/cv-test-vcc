const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
const db = require('./database');

console.log('[Build] Membuat versi statis untuk Netlify...\n');

const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get() || {};
const experiences = db.prepare('SELECT * FROM experiences ORDER BY order_index ASC, start_date DESC').all();
const education = db.prepare('SELECT * FROM education ORDER BY order_index ASC, start_year DESC').all();
const skills = db.prepare('SELECT * FROM skills ORDER BY order_index ASC, name ASC').all();
const categories = [...new Set(skills.map(s => s.category))];

const data = { profile, experiences, education, skills, categories };

const outDir = path.join(__dirname, 'static');
fs.mkdirSync(outDir, { recursive: true });

const headerPath = path.join(__dirname, 'views', 'header.ejs');
const footerPath = path.join(__dirname, 'views', 'footer.ejs');
const indexPath = path.join(__dirname, 'views', 'index.ejs');

let indexContent = fs.readFileSync(indexPath, 'utf8');

const headerHtml = ejs.render(fs.readFileSync(headerPath, 'utf8'), data, { filename: headerPath });
const footerHtml = ejs.render(fs.readFileSync(footerPath, 'utf8'), data, { filename: footerPath });

indexContent = indexContent
  .replace('<%- include(\'header\') %>', headerHtml)
  .replace('<%- include(\'footer\') %>', footerHtml);

const fullHtml = ejs.render(indexContent, data, { filename: indexPath });

fs.writeFileSync(path.join(outDir, 'index.html'), fullHtml);
console.log('[Build] ✓ index.html berhasil dibuat');

fs.mkdirSync(path.join(outDir, 'uploads'), { recursive: true });

const cssFiles = ['style.css'];
cssFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, 'public', file))) {
    fs.copyFileSync(
      path.join(__dirname, 'public', file),
      path.join(outDir, file)
    );
    console.log('[Build] ✓ ' + file + ' berhasil dicopy');
  }
});

if (profile.photo && fs.existsSync(path.join(__dirname, 'public', profile.photo))) {
  const photoPath = path.join(__dirname, 'public', profile.photo);
  const photoDest = path.join(outDir, 'uploads', path.basename(profile.photo));
  fs.mkdirSync(path.join(outDir, 'uploads'), { recursive: true });
  fs.copyFileSync(photoPath, photoDest);
  console.log('[Build] ✓ Foto profil berhasil dicopy');
}

console.log('\n[Build] ✅ Selesai! Folder static/ siap di-deploy ke Netlify.');
console.log('[Build] Jalankan: cd static && npx netlify deploy --prod\n');
