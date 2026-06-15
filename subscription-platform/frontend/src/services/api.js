// ==========================================
// 1. DUMMY LOGIN (DITAMBAH VALIDASI)
// ==========================================
export async function login(email, password) {
  console.log("Mock Login SoundStream:", { email, password });

  // Mengambil data yang tadi didaftarkan di halaman Register
  const registeredEmail = localStorage.getItem("registered_email");
  const registeredPassword = localStorage.getItem("registered_password");

  // Akun master cadangan (supaya dosen/kamu bisa login instan tanpa register dulu)
  const masterEmail = "admin@dummy.com";
  const masterPassword = "password123";

  // Logika pengecekan kecocokan akun
  if (
    (email === registeredEmail && password === registeredPassword) ||
    (email === masterEmail && password === masterPassword)
  ) {
    const dummy = {
      token: "dummy_jwt_token_12345",
      // Menyimpan objek user utuh dalam bentuk string JSON agar aman dibaca di localstorage
      user: { id: "user_dummy_99", email: email }
    };
    
    localStorage.setItem("token", dummy.token);
    localStorage.setItem("user", JSON.stringify(dummy.user));
    localStorage.setItem("user_email", email); 
    
    return dummy;
  } else {
    throw new Error("Login Gagal! Email belum terdaftar atau password salah.");
  }
}

// ==========================================
// 2. DUMMY REGISTER (DITAMBAH PENYIMPANAN DATA)
// ==========================================
export async function register(email, password) {
  // Menyimpan email dan password pendaftaran ke memori browser
  localStorage.setItem("registered_email", email);
  localStorage.setItem("registered_password", password);

  return { message: "Dummy User Registered Successfully!", success: true };
}

// ==========================================
// 3. DUMMY SUBSCRIBE 
// ==========================================
export async function subscribe(userId, email, tier) {
  // Simulasi kegagalan pembayaran 30% untuk tantangan demonstrasi kelompok
  const isSuccess = Math.random() > 0.3; 
  return { success: isSuccess };
}

// ==========================================
// 4. DUMMY STATUS 
// ==========================================
export async function getStatus() {
  // Cek paket aktif milik user
  const savedTier = localStorage.getItem("active_subscription"); 
  const savedEmail = localStorage.getItem("user_email") || "guest@soundstream.com";

  return {
    success: true,
    email: savedEmail,
    tier: savedTier || "Starter", // Default ke Starter (Free) jika kosong
    status: savedTier ? "active" : "none"
  };
}

// ==========================================
// 5. DUMMY KATALOG LAGU SOUNDSTREAM (REVISI TOTAL)
// ==========================================
// Mengganti video tutorial TYPE A/B menjadi metadata track lagu riil sesuai batasan tier
export async function getContent() {
  return [
    { contentId: "m1", title: "Neon Pulse", artist: "ZARA-X", requiredTier: "Starter", type: "audio", quality: "128 kbps Standard" },
    { contentId: "m2", title: "Midnight Echo", artist: "Solaris", requiredTier: "Starter", type: "audio", quality: "128 kbps Standard" },
    { contentId: "m3", title: "Crystal Void", artist: "Novae", requiredTier: "Plus", type: "audio", quality: "256 kbps High" },
    { contentId: "m4", title: "Deep Orbit", artist: "Kael", requiredTier: "Plus", type: "audio", quality: "256 kbps High" },
    { contentId: "m5", title: "Phantom Bass (Hi-Fi)", artist: "Dusk Wave", requiredTier: "Premium", type: "audio", quality: "320 kbps Master" },
    { contentId: "m6", title: "Hollow (Lossless)", artist: "Elara", requiredTier: "Premium", type: "audio", quality: "320 kbps Master" },
    { contentId: "m7", title: "Collaborative Session Jam", artist: "Studio Users", requiredTier: "Studio", type: "audio", quality: "320 kbps Master" }
  ];
}

// ==========================================
// 6. DUMMY ACCESS URL 
// ==========================================
export async function accessContent(contentId) {
  return { url: "https://example.com/dummy-music-stream-audio-file.mp3" };
}