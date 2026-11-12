# WebJaws — Integrated Operations & Ticket Management Platform

WebJaws is an enterprise operations, contractor distribution, and ticket management platform built with React, TypeScript, Vite, Express, and PostgreSQL (Supabase).

---

## 1. Arsitektur & Spesifikasi

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion
- **Backend API**: Node.js 22, Express 4, Cookie-Parser, Bcryptjs
- **Database**: PostgreSQL (Supabase) via `pg` connection pool
- **Session & Auth Authority**: PostgreSQL-authoritative (`auth_sessions`, `staff_users`, `login_attempts`, `audit_logs`)
- **Session Security**: Deterministic SHA-256 one-way token hashing (`token_hash`), `HttpOnly` + `SameSite=Lax` browser cookie, anti-timing attack verification via `crypto.timingSafeEqual`
- **CSRF Protection**: Fail-closed origin/referer verification on all state-changing HTTP methods
- **Package Manager**: **npm** (Node.js >= 20.0.0, npm >= 10.0.0)

---

## 2. Environment Variables (.env)

Buat file `.env` di direktori root berdasarkan template `.env.example`:

```env
# Koneksi PostgreSQL Supabase (Format URL Transaction Pooler / Session Pooler)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

# Durasi session aktif dalam satuan jam (default: 24)
SESSION_DURATION_HOURS=24

# Token otorisasi satu kali untuk setup awal Superadmin (digenerate secara acak)
WEBJAWS_SETUP_TOKEN=

# Opsional: Supabase REST/SDK credentials
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Port server lokal (default 3000 di development)
PORT=3000
```

> **CATATAN KEAMANAN**: Jangan pernah memasukkan credential asli ke version control (git).

---

## 3. Instalasi Dependency

Gunakan **npm** untuk menginstal dependency:

```bash
# Instalasi bersih dari lockfile
npm install
```

---

## 4. Menjalankan Development Server

Development server menjalankan backend Express dan menyematkan middleware Vite SPA secara terintegrasi:

```bash
npm run dev
```

Aplikasi dapat diakses pada browser di: `http://localhost:3000`

---

## 5. Production Build & Start

Proses production build memvalidasi TypeScript (`tsc --noEmit`), mem-bundle aset frontend (`vite build`), dan mengompilasi backend server (`esbuild server.ts --bundle --platform=node --format=esm --packages=external --outfile=server.js`):

```bash
# Build frontend dan backend
npm run build

# Menjalankan backend server produksi
npm start
```

---

## 6. Database Migrations

Migrasi database dieksekusi secara berurutan dan idempotent:

```bash
npm run migrate
```

Daftar Migration:
1. `001_initial_schema.sql`: Membuat tabel inti (`roles`, `permissions`, `staff_users`, `auth_sessions`, `login_attempts`, `work_orders`, `audit_logs`, dll).
2. `002_session_token_hash.sql`: Menambahkan kolom `token_hash` dan index unik pada `auth_sessions`.
3. `003_session_legacy_hash_cleanup.sql`: Mengonversi session token legacy ke SHA-256 hash, mengosongkan token plaintext di database, dan mempertahankan session aktif yang valid tanpa gangguan.

---

## 7. Pengujian (Testing)

### A. Unit Tests (Non-Destruktif & Keamanan)
Menguji hashing token SHA-256, opsi cookie HttpOnly, sanitasi audit log, dan proteksi anti-CSRF:

```bash
npm run test:unit
```

### B. Comprehensive Authentication Audit & Integration Test
Menguji 20 skenario autentikasi, fail-safe database unavailable, rate limiting PostgreSQL, guard produksi, dan integrasi session:

```bash
npm run test:auth
```

*Catatan: Jika `DATABASE_URL` belum dihubungkan, pengujian yang bergantung langsung pada database PostgreSQL akan dilaporkan berstatus `BLOCKED` (bukan fail) secara jujur dan transparan.*

---

## 8. Panduan First-Time Superadmin Setup

1. Generate random token setup di terminal:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Tambahkan token hasil generate ke `.env` sebagai `WEBJAWS_SETUP_TOKEN=<hasil_token>`.
3. Jalankan server: `npm run dev`.
4. Buka URL: `http://localhost:3000/?setup=1`.
5. Masukkan data nama lengkap, username, email, setup token, dan password (minimal 12 karakter).
6. Setelah Superadmin pertama berhasil dibuat, hapus baris `WEBJAWS_SETUP_TOKEN` dari `.env` dan restart server.
