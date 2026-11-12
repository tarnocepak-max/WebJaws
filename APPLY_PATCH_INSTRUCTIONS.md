# Integrasi patch ke project

1. Tambahkan di `server.ts`:
```ts
import { setupRouter } from './server/routes/setupRoutes.js';
```
Setelah `app.use(cookieParser());`:
```ts
app.use('/api/setup', setupRouter);
```

2. Tambahkan di `src/App.tsx`:
```tsx
import { FirstSuperadminSetupPage } from './pages/FirstSuperadminSetupPage';
```
Dalam `AppRouter`, tambahkan state:
```tsx
const [showSetup, setShowSetup] = useState(
  new URLSearchParams(window.location.search).get('setup') === '1'
);
```
Ganti blok:
```tsx
if (!user) {
  return <LoginPage />;
}
```
menjadi:
```tsx
if (!user) {
  if (showSetup) {
    return <FirstSuperadminSetupPage onComplete={() => {
      window.history.replaceState({}, '', window.location.pathname);
      setShowSetup(false);
    }} />;
  }
  return <LoginPage />;
}
```

3. Tambahkan `WEBJAWS_SETUP_TOKEN` pada environment backend dengan nilai random hasil generator:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Jangan gunakan token contoh. Restart server.
4. Buka `/?setup=1`, isi form, dan buat akun pertama.
5. Setelah akun dibuat, hapus `WEBJAWS_SETUP_TOKEN` dari environment dan restart server.
6. Catatan: source auth existing masih in-memory. Login dari akun database belum otomatis bekerja sampai tahap migrasi login/session ke PostgreSQL.
