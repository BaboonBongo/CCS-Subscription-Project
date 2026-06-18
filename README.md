# Arsitektur Serverless: Platform Berlangganan Media
## Implementasi AWS End-to-End dengan Integrasi Notifikasi Telegram

Repositori ini berisi kode sumber dan berkas konfigurasi untuk platform berlangganan media bertingkat (tier-based) yang dibangun di atas infrastruktur serverless Amazon Web Services (AWS). Dokumentasi ini disusun secara mendalam sebagai panduan referensi teknis bagi dosen penguji maupun pengembang yang ingin memperluas atau mengimplementasikan ulang arsitektur ini.

Sistem ini mensimulasikan model bisnis distribusi multimedia yang aman secara otomatis, mulai dari pendaftaran pengguna, autentikasi sesi, otorisasi berdasarkan tingkat langganan (Free, Plus, Premium, Studio), simulasi transaksi pembayaran asinkron, hingga orkestrasi berakhirnya masa aktif akun menggunakan mesin status (state machine).

---

## Model Keamanan (Security Model)

Sistem menerapkan beberapa kontrol keamanan cloud yang meliputi:

1. **Autentikasi & Enkripsi Sesi**: 
   * Sesi komunikasi antara klien dan server menggunakan JSON Web Tokens (JWT) yang dikirim melalui header `Authorization: Bearer <token>`.
   * Enkripsi kata sandi menggunakan pustaka `bcryptjs` dengan kekuatan hash sebesar 10 putaran (salt rounds) sebelum disimpan di database DynamoDB.
2. **Proteksi Konten via S3 Pre-signed URL**:
   * Seluruh objek berkas musik (.mp3) disimpan secara privat di Amazon S3 dengan opsi *Block Public Access* diaktifkan penuh.
   * Akses ke berkas asli tidak dapat ditebak atau diakses langsung secara publik. Backend (`app-lambda`) bertindak sebagai gerbang otorisasi dengan menghasilkan tautan sementara (*S3 Pre-signed URL*) berdurasi aktif 30 detik menggunakan SDK AWS `@aws-sdk/s3-request-presigner`.
3. **Otorisasi Berbasis Tier**:
   * Sebelum backend menghasilkan Pre-signed URL, sistem memvalidasi profil pengguna terbaru dari database DynamoDB untuk memastikan status keanggotaan adalah `active` dan tingkat langganan pengguna memenuhi batas minimum konten (User Tier >= Content Required Tier).
4. **Prinsip Hak Akses Minimum (Least Privilege)**:
   * Setiap fungsi AWS Lambda memiliki kebijakan IAM Role khusus yang membatasi hak aksesnya secara ketat. Sebagai contoh, `app-lambda` hanya memiliki akses baca/tulis pada tabel DynamoDB dan baca pada bucket S3, tanpa hak administratif lainnya.
5. **Keamanan CORS (Cross-Origin Resource Sharing)**:
   * Header CORS dikonfigurasi secara eksplisit pada lapisan API Gateway dan Express API untuk memastikan hanya permintaan dari domain terdaftar yang dapat memicu eksekusi API backend.

---

## Arsitektur Sistem & Aliran Data

Sistem diimplementasikan menggunakan arsitektur serverless berikut:

```
                          [ React Frontend (Vite) ]
                                      │
                                      ▼
                        [ API Gateway (HTTP API) ]
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         │                            │                            │
         ▼                            ▼                            ▼
   [ appLambda ]               [ paymentLambda ]           [ notificationLambda ]
   (Express.js)                 (Payment Sim)                (SNS Subscription)
         │                            │                            │
         ├────────────────────────────┼──────────────┐             ▼
         │                            │              │       [ Telegram Bot ]
         ▼                            ▼              │       (Notifikasi)
    [ DynamoDB ]              [ Step Functions ]     │
   (Users & Content)            (Wait 5 sec)         │
         │                            │              │
         ▼                            ▼              │
    [ Amazon S3 ]            [ expirationLambda ]────┘
   (Subscription Expiry)
```

---

## Bagian 1: Analisis Backend & Implementasi API

Backend sistem terbagi menjadi empat fungsi AWS Lambda terpisah yang ditulis menggunakan Node.js (CommonJS):

### 1. app-lambda
Layanan API utama yang dibungkus menggunakan Express.js dan pustaka `serverless-http` agar dapat berjalan di lingkungan AWS Lambda. Layanan ini menangani operasi berikut:
* **Autentikasi (`/auth`)**:
  * `POST /auth/register`: Menerima `email` dan `password`. Memverifikasi apakah email sudah terdaftar melalui pencarian indeks. Jika belum, kata sandi di-hash menggunakan `bcryptjs` dan data disimpan sebagai pengguna baru dengan tingkat default `Starter`.
  * `POST /auth/login`: Melakukan verifikasi email dan kata sandi. Jika cocok, backend menandatangani token JWT yang berisi klaim `userId`, `email`, dan `tier` dengan masa aktif tertentu.
* **Pengambilan Konten (`/content`)**:
  * `GET /content`: Mengembalikan daftar katalog lagu yang tersedia. Rute ini secara sengaja memotong atribut sensitif (seperti `s3Key` dan `thumbnailKey`) dari database sebelum mengirimkannya ke frontend untuk mencegah eksploitasi URL langsung.
  * `GET /content/:id`: Memverifikasi validitas token JWT melalui middleware `verifyToken`. Setelah lolos, sistem mengambil data riil status keanggotaan pengguna dari tabel DynamoDB (bukan mengandalkan payload JWT yang mungkin sudah kedaluwarsa). Jika status adalah `active` dan peringkat tingkatan pengguna memenuhi syarat, fungsi memanggil layanan Amazon S3 untuk menghasilkan tautan akses dinamis (Pre-signed URL) yang valid selama 30 detik.

### 2. payment-lambda
Menangani simulasi transaksi pembayaran pengguna secara terpisah:
* Menerima permintaan `POST /subscribe` yang berisi `userId`, `email`, dan `tier`.
* Menyelesaikan pembayaran secara asinkron dengan rasio keberhasilan tiruan (70% sukses, 30% gagal).
* **Jika Sukses**: Memperbarui status keanggotaan pengguna di database DynamoDB dengan status `active`, memperbarui nama tingkatan, serta mencatat waktu mulai langganan (`subStart`).
* **Notifikasi**: Mengirim notifikasi transaksi ke bot Telegram menggunakan HTTP `fetch` ke API Telegram dengan proteksi `AbortController` berdurasi waktu tunggu 3 detik untuk menghindari pemborosan durasi eksekusi Lambda jika terjadi gangguan koneksi ke Telegram.

*Catatan Penting Integrasi*: Di dalam kode produksi `payment-lambda`, integrasi untuk memicu AWS Step Functions secara terprogram memerlukan pustaka `@aws-sdk/client-sfn`. Jika Anda ingin menyalakan alur kerja Step Functions pasca pembayaran sukses, pengembang dapat menyisipkan kode berikut:

```javascript
const { SFNClient, StartExecutionCommand } = require("@aws-sdk/client-sfn");
const sfnClient = new SFNClient({ region: process.env.AWS_REGION });

// Sisipkan di dalam blok keberhasilan pembayaran (success branch)
const stateMachineArn = process.env.STATE_MACHINE_ARN;
const executionName = `sub-${userId}-${Date.now()}`;

await sfnClient.send(new StartExecutionCommand({
  stateMachineArn: stateMachineArn,
  name: executionName,
  input: JSON.stringify({ userId, email, tier })
}));
```

### 3. expiration-lambda
Fungsi khusus yang dirancang untuk dieksekusi oleh AWS Step Functions sebagai tahap akhir proses hitung mundur:
* Menerima input data pengguna langsung dari *state* sebelumnya (raw payload, bukan melalui HTTP).
* Melakukan pembaruan database DynamoDB untuk mengubah atribut `subStatus` pengguna dari `active` menjadi `expired`.
* Mengirimkan notifikasi langsung ke API Telegram bahwa masa aktif akun pengguna telah berakhir.

### 4. notification-lambda
Fungsi opsional yang bertindak sebagai broker pesan asinkron berbasis peristiwa:
* Dipicu oleh Amazon SNS (Simple Notification Service) ketika sebuah notifikasi diterbitkan pada topik terdaftar.
* Mengekstrak payload dari rekaman pesan SNS dan memformat pesan menggunakan template HTML yang sesuai (`PAYMENT_SUCCESS`, `PAYMENT_FAILED`, atau `SUBSCRIPTION_EXPIRED`) untuk dikirimkan melalui Telegram Bot.

---

## Bagian 2: Analisis Frontend (React.js)

Aplikasi klien dikembangkan menggunakan React.js dengan bundler Vite. Aplikasi ini beroperasi dalam mode **hibrida** (gabungan antara simulasi lokal dan integrasi AWS langsung):

### 1. Sesi Otentikasi dan Katalog (Simulasi Lokal / Mock)
Untuk memudahkan demonstrasi tanpa ketergantungan API backend secara penuh, beberapa fungsi di dalam berkas `frontend/src/services/api.js` saat ini dikonfigurasi menggunakan simulasi lokal:
* **Registrasi & Login**: Data pendaftaran disimpan secara lokal di dalam `localStorage` penjelajah web (*browser*). Sesi login diverifikasi terhadap data tersebut dan menghasilkan token JWT buatan sendiri (*dummy*).
* **Katalog Media**: Daftar katalog musik dimuat dari daftar data statis lokal. Tombol putar akan mengakses berkas audio dummy yang dialirkan dari tautan statis pihak ketiga.

### 2. Pembelian Langganan (Integrasi AWS Riil)
Fungsi `subscribe` pada frontend terhubung langsung ke API Gateway AWS yang sebenarnya:
* Mengirim permintaan HTTP POST ke URL eksternal `/subscribe` pada API Gateway dengan membawa data `userId`, `email`, dan `tier` pilihan.
* Menerima respons status pembayaran dari `payment-lambda`.

### 3. Sinkronisasi Masa Aktif Akun (Countdown Fallback)
Di dalam `frontend/src/pages/Subscription.jsx`, sistem menerapkan mekanisme sinkronisasi waktu tunggu lokal. Ketika menerima sinyal keberhasilan pembayaran dari AWS API Gateway, frontend menyalakan waktu tunggu lokal (`setTimeout`) selama 6 detik. Hal ini bertujuan untuk mensimulasikan perubahan status akun kembali ke tingkat dasar (*Starter*) di sisi klien secara visual sesaat setelah Step Functions di cloud menyelesaikan masa hitung mundur 5 detiknya.

### 4. Migrasi Menuju Integrasi Penuh Backend
Untuk mengubah frontend agar sepenuhnya menggunakan rute backend riil (tidak lagi menggunakan mock lokal), pengembang dapat mengganti fungsi-fungsi di dalam `frontend/src/services/api.js` sebagai berikut:

* **Otentikasi Riil**:
  ```javascript
  export async function login(email, password) {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) throw new Error("Gagal login ke server.");
    const data = await response.json();
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data;
  }
  ```
* **Katalog Riil**:
  ```javascript
  export async function getContent() {
    const token = localStorage.getItem("token");
    const response = await fetch(`${import.meta.env.VITE_API_URL}/content`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!response.ok) throw new Error("Gagal memuat katalog media.");
    return await response.json();
  }
  ```

*Peringatan Mismatch Tingkatan*: Terdapat perbedaan penamaan tingkatan antara frontend dan database. Di database, tingkat keanggotaan didefinisikan sebagai `free`, `basic`, `standard`, `premium` di dalam kode `tierRank.js` backend. Sedangkan di frontend, tingkat didefinisikan sebagai `Starter`, `Plus`, `Premium`, `Studio`. Pengembang baru harus menyelaraskan penamaan ini di `tierRank.js` agar otorisasi berbasis peringkat tingkatan dapat berfungsi dengan benar saat mengakses berkas privat S3.

---

## Bagian 3: Analisis Infrastruktur AWS

Pengaturan sumber daya cloud AWS secara manual dilakukan dengan spesifikasi teknis berikut:

### 1. Amazon DynamoDB
Sistem menggunakan dua tabel NoSQL utama:
* **Tabel `Users`**:
  * Partition Key: `userId` (String).
  * Global Secondary Index (GSI): **`email-index`** (Partition Key: `email`, Projection: ALL). Indeks ini sangat krusial untuk mengizinkan Express melakukan pencarian profil pengguna berdasarkan alamat email secara efisien tanpa melakukan pemindaian tabel penuh (*table scan*).
  * Atribut data: `userId`, `email`, `password`, `tier`, `subStatus`, `subStart`.
* **Tabel `Content`**:
  * Partition Key: `contentId` (String).
  * Atribut data: `contentId`, `title`, `description`, `artist`, `requiredTier` (starter/plus/premium/studio), `type` (audio/video), dan `s3Key`.

### 2. Amazon S3 (Simple Storage Service)
Penyimpanan aset multimedia dikonfigurasi privat:
* Konfigurasi bucket: Opsi **Block Public Access** disetel ke posisi aktif (ON).
* Struktur folder bucket: Aset dikelompokkan ke dalam direktori berdasarkan tingkat akses keamanan, yaitu `starter/`, `plus/`, `premium/`, dan `studio/`.
* Pengambilan konten oleh frontend dilakukan dengan memicu `GetObjectCommand` dari SDK S3 di backend, yang membuat URL akses dengan tanda tangan kriptografis berkunci AWS IAM Role yang hanya valid selama 30 detik.

### 3. AWS Step Functions
Untuk mengorkestrasi status keanggotaan pengguna, sebuah mesin status (State Machine) dibuat menggunakan konfigurasi JSON yang tersedia pada berkas **[subscription-expiration-workflow.json](file:///c:/Users/fookm/Downloads/Uni/Sixth%20Semester/Cloud%20Computing%20Security/CCS%20Subscription%20Project/subscription-platform/infra/stepfunctions/subscription-expiration-workflow.json)**.

Alur eksekusi mesin status terdiri dari:
1. **Wait State (`WaitSubscription`)**: Menahan jalannya eksekusi selama nilai konstan 5 detik.
2. **Task State (`ExpireSubscription`)**: Memicu eksekusi fungsi `expirationLambda` dengan membawa parameter input `userId` dan `email` pengguna yang status keanggotaannya akan dinonaktifkan.

---

## Struktur Repositori

```text
CCS-Subscription-Project/
├── README.md                          # Dokumentasi Utama Proyek
└── subscription-platform/
    ├── backend/                       # Source Code AWS Lambda (Backend)
    │   ├── app-lambda/                # Express API & Otorisasi Konten
    │   ├── expiration-lambda/         # Pemrosesan Akun Kedaluwarsa
    │   ├── notification-lambda/       # Integrasi Notifikasi SNS ke Telegram
    │   └── payment-lambda/            # Simulasi Transaksi Pembayaran
    ├── frontend/                      # Aplikasi React (Frontend)
    │   ├── src/
    │   │   ├── components/            # Komponen UI
    │   │   ├── pages/                 # Halaman Utama (Login, Content, dll)
    │   │   └── services/              # Integrasi Fetching API ke AWS
    │   └── package.json
    └── infra/                         # File Konfigurasi Infrastruktur AWS
        └── stepfunctions/             # Alur Kerja Orkestrasi Waktu Tunggu
```

---

## Konfigurasi Variabel Lingkungan (.env)

Buat berkas `.env` pada masing-masing direktori berikut dengan menggunakan berkas `.env.example` sebagai referensi utama:

### 1. [app-lambda](file:///c:/Users/fookm/Downloads/Uni/Sixth%20Semester/Cloud%20Computing%20Security/CCS%20Subscription%20Project/subscription-platform/backend/app-lambda) (.env)
* `JWT_SECRET`: Untaian string acak untuk enkripsi tanda tangan JWT.
* `AWS_REGION`: Wilayah tempat sumber daya AWS dideploy (contoh: `ap-southeast-1`).
* `USERS_TABLE`: Nama tabel database DynamoDB untuk data pengguna (contoh: `Users`).
* `CONTENT_TABLE`: Nama tabel database DynamoDB untuk metadata lagu (contoh: `Content`).
* `MEDIA_BUCKET`: Nama Bucket S3 privat tempat menyimpan musik.

### 2. [payment-lambda](file:///c:/Users/fookm/Downloads/Uni/Sixth%20Semester/Cloud%20Computing%20Security/CCS%20Subscription%20Project/subscription-platform/backend/payment-lambda) (.env)
* `AWS_REGION`: Wilayah tempat sumber daya AWS dideploy.
* `USERS_TABLE`: Nama tabel database DynamoDB untuk data pengguna.
* `STATE_MACHINE_ARN`: ARN dari State Machine AWS Step Functions yang akan dijalankan.
* `TELEGRAM_BOT_TOKEN`: Token rahasia API Bot Telegram yang dibuat melalui @BotFather.
* `TELEGRAM_CHAT_ID`: ID percakapan obrolan Telegram tujuan penerima notifikasi.

### 3. [expiration-lambda](file:///c:/Users/fookm/Downloads/Uni/Sixth%20Semester/Cloud%20Computing%20Security/CCS%20Subscription%20Project/subscription-platform/backend/expiration-lambda) (.env)
* `AWS_REGION`: Wilayah tempat sumber daya AWS dideploy.
* `USERS_TABLE`: Nama tabel database DynamoDB untuk data pengguna.
* `TELEGRAM_BOT_TOKEN`: Token rahasia API Bot Telegram.
* `TELEGRAM_CHAT_ID`: ID percakapan obrolan Telegram.

### 4. [notification-lambda](file:///c:/Users/fookm/Downloads/Uni/Sixth%20Semester/Cloud%20Computing%20Security/CCS%20Subscription%20Project/subscription-platform/backend/notification-lambda) (.env)
* `TELEGRAM_BOT_TOKEN`: Token rahasia API Bot Telegram.
* `TELEGRAM_CHAT_ID`: ID percakapan obrolan Telegram.

### 5. [frontend](file:///c:/Users/fookm/Downloads/Uni/Sixth%20Semester/Cloud%20Computing%20Security/CCS%20Subscription%20Project/subscription-platform/frontend) (.env)
* `VITE_API_URL`: URL endpoint utama API Gateway untuk memicu rute langganan.

---

## Panduan Instalasi & Pengoperasian Lokal

### 1. Kloning Repositori
```bash
git clone <url-repositori>
cd CCS-Subscription-Project/subscription-platform
```

### 2. Instalasi Dependensi Serverless Backend (Local Setup)
Jalankan perintah penginstalan dependensi berikut untuk masing-masing folder Lambda:
```bash
# Direktori app-lambda
cd backend/app-lambda && npm install && cd ../..

# Direktori payment-lambda
cd backend/payment-lambda && npm install && cd ../..

# Direktori expiration-lambda
cd backend/expiration-lambda && npm install && cd ../..

# Direktori notification-lambda
cd backend/notification-lambda && npm install && cd ../..
```

### 3. Jalankan Frontend React secara Lokal
```bash
cd frontend
npm install
npm install react-router-dom

# Menjalankan server pengembangan lokal Vite
npm run dev
```

---

## Skenario Pengujian Alur Sistem (Demo Flow)

Gunakan panduan skenario pengujian di bawah ini untuk menunjukkan bagaimana arsitektur backend, frontend, dan infrastruktur cloud berinteraksi satu sama lain secara dinamis:

1. **Registrasi Akun Baru**:
   Buka halaman antarmuka pengguna pada penjelajah web, arahkan ke menu registrasi, lalu daftarkan pengguna baru. Akun akan terdaftar di database lokal (frontend) atau tabel DynamoDB (bila backend penuh diintegrasikan).
2. **Login Akun**:
   Masuk dengan akun yang terdaftar. Token JWT berhasil dibuat dan disimpan di LocalStorage. Akun pengguna saat ini diatur pada tingkatan gratis dasar (Starter).
3. **Pemberian Akses Berkas Gratis**:
   Masuk ke katalog musik dan putar berkas audio gratis. Backend atau mock frontend akan mengizinkan proses streaming musik karena batasan tingkat minimum adalah Starter.
4. **Verifikasi Keamanan Akses Berkas Berbayar**:
   Cobalah untuk memutar konten audio dengan kategori Plus, Premium, atau Studio. Sistem akan memotong hak akses pengguna dan menampilkan notifikasi kesalahan "Subscription inactive" atau "Tier too low".
5. **Memicu Pembaruan Tingkat Langganan**:
   Navigasikan ke halaman berlangganan, pilih paket Premium, lalu klik tombol berlangganan. Langkah ini akan mengirimkan permintaan API POST ke AWS API Gateway.
6. **Eksekusi Transaksi dan Log Notifikasi**:
   * Jika respons transaksi adalah Kegagalan (probabilitas 30%): Frontend akan menampilkan pesan kegagalan transaksi, dan Telegram Bot mengirimkan detail kegagalan.
   * Jika respons transaksi adalah Keberhasilan (probabilitas 70%): Status akun pengguna di DynamoDB diperbarui menjadi active, profil pengguna teraktual diperbarui pada memori lokal frontend, dan Telegram Bot mengirimkan notifikasi keberhasilan aktivasi secara instan.
7. **Pengujian Pemutaran File Musik Berbayar**:
   Setelah langganan aktif, putar berkas audio Premium. Frontend memanggil backend untuk menghasilkan URL bertanda tangan (Pre-signed URL). Lagu dapat diputar dengan sukses langsung dari bucket privat Amazon S3.
8. **Hitung Mundur dan Kedaluwarsa Otomatis**:
   Setelah waktu tunggu terlampaui (5 detik), Step Functions akan menyelesaikan masa hitung mundurnya di sisi cloud dan mengeksekusi `expirationLambda` yang merubah status akun di DynamoDB menjadi `expired`.
9. **Penutupan Kembali Hak Akses Media**:
   Pesan kedaluwarsa langganan dikirimkan oleh Bot Telegram. Jika pengguna mencoba memutar ulang lagu Premium, backend akan menolak permintaan pemutaran lagu tersebut karena mendeteksi status keanggotaan pengguna di database DynamoDB sudah tidak aktif lagi.

---

## Lisensi
Proyek ini dilisensikan di bawah MIT License.
