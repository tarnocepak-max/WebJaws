WEBJAWS — PATCH SETUP SUPERADMIN PERTAMA
=========================================

Patch ini hanya menambahkan endpoint setup satu kali dan halaman UI.
Patch TIDAK mengubah login yang saat ini masih memakai webJawsStore.
Jadi pembuatan akun di PostgreSQL saja belum menjamin akun tersebut bisa
login sampai autentikasi login dipindahkan ke PostgreSQL.

CARA PASANG
1. Backup project.
2. Extract isi ZIP ini ke root project WebJaws dan izinkan file ditambahkan.
3. Tambahkan import dan mount route di server.ts (lihat instruksi di bawah).
4. Tambahkan WEBJAWS_SETUP_TOKEN di environment backend.
5. Jalankan build dan uji endpoint status.
6. Buka /setup-superadmin (instruksi integrasi UI di bawah).

PERUBAHAN server.ts
Tambahkan:
  import { setupRouter } from './server/routes/setupRoutes.js';
Setelah cookieParser dan sebelum API route lainnya:
  app.use('/api/setup', setupRouter);

PERUBAHAN .env SERVER
Buat token acak panjang minimal 32 byte. Contoh generator Node:
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
Set hasilnya sebagai:
  WEBJAWS_SETUP_TOKEN=<hasil-generator>
Jangan memakai contoh token, jangan commit .env, jangan mengirim token ke chat.
Restart server setelah menambahkan environment variable.

INTEGRASI HALAMAN
Di src/App.tsx:
  import { FirstSuperadminSetupPage } from './pages/FirstSuperadminSetupPage';
Tambahkan state:
  const [showSetup, setShowSetup] = useState(false);
Di dalam AppRouter, saat !user:
  if (showSetup) return <FirstSuperadminSetupPage onComplete={() => setShowSetup(false)} />;
  return <LoginPage />;
Untuk menampilkan halaman awal secara manual sementara:
  const params = new URLSearchParams(window.location.search);
  const [showSetup, setShowSetup] = useState(params.get('setup') === '1');
Lalu buka /?setup=1 setelah endpoint route terpasang.
Setelah selesai, hapus parameter URL dan jangan publikasikan link setup.

PENTING — BATASAN KOMPATIBILITAS
Pada source ZIP yang diperiksa, authRoutes.ts dan auth.ts masih membaca
webJawsStore untuk login dan session. Karena itu patch ini membuat akun
pertama tersimpan di staff_users, tetapi login akun tersebut belum akan
berhasil sampai backend login/session juga dimigrasikan ke PostgreSQL.
Jangan mengira setup sudah menyelesaikan full database authentication.

Keamanan:
- Endpoint memerlukan WEBJAWS_SETUP_TOKEN.
- Transaksi + advisory lock mencegah bootstrap ganda bersamaan.
- Endpoint menolak jika Superadmin sudah ada.
- Password di-hash bcrypt cost 12.
- Tidak ada kredensial default.
