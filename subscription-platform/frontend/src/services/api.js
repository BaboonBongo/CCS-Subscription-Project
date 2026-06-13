// ==========================================
// 1. DUMMY LOGIN (DITAMBAH VALIDASI)
// ==========================================
export async function login(email, password) {
  console.log("Mock Login:", { email, password });

  // 🌟 TAMBAHAN: Mengambil data yang tadi didaftarkan di halaman Register
  const registeredEmail = localStorage.getItem("registered_email");
  const registeredPassword = localStorage.getItem("registered_password");

  // 🌟 TAMBAHAN: Akun master cadangan (supaya dosen/kamu bisa login instan tanpa register dulu)
  const masterEmail = "admin@dummy.com";
  const masterPassword = "password123";

  // 🌟 TAMBAHAN: Logika pengecekan kecocokan akun
  if (
    (email === registeredEmail && password === registeredPassword) ||
    (email === masterEmail && password === masterPassword)
  ) {
    // Logika asli kelompokmu tetap utuh jika akun cocok
    const dummy = {
      token: "dummy_jwt_token_12345",
      user: { id: "user_dummy_99", email: email }
    };
    localStorage.setItem("token", dummy.token);
    localStorage.setItem("user_email", email); // Simpan email buat status bar nanti
    return dummy;
  } else {
    // 🌟 TAMBAHAN: Jika tidak cocok, lempar pesan eror ke Login.jsx
    throw new Error("Login Gagal! Email belum terdaftar atau password salah.");
  }
}

// ==========================================
// 2. DUMMY REGISTER (DITAMBAH PENYIMPANAN DATA)
// ==========================================
export async function register(email, password) {
  // 🌟 TAMBAHAN: Menyimpan email dan password pendaftaran ke memori browser
  localStorage.setItem("registered_email", email);
  localStorage.setItem("registered_password", password);

  // Logika asli kelompokmu tetap utuh
  return { message: "Dummy User Registered Successfully!", success: true };
}

// ==========================================
// 3. DUMMY SUBSCRIBE (Asli Kelompokmu)
// ==========================================
export async function subscribe(userId, email, tier) {
  return { success: true };
}

// ==========================================
// 4. DUMMY STATUS (Asli Kelompokmu)
// ==========================================
export async function getStatus() {
  // Cek apakah user sudah mengklik TYPE A atau TYPE B di halaman subscription
  const savedTier = localStorage.getItem("active_subscription"); 
  const savedEmail = localStorage.getItem("user_email") || "guest@dummy.com";

  return {
    success: true,
    email: savedEmail,
    tier: savedTier || null, // Jika belum pilih paket, tipenya NULL
    status: savedTier ? "active" : "none" // Jika ada tipe, statusnya ACTIVE
  };
}

// ==========================================
// 5. DUMMY KONTEN VIDEO/MEDIA KATALOG (Asli Kelompokmu)
// ==========================================
export async function getContent() {
  return [
    { contentId: "1", title: "Premium Video Tutorial TYPE A", description: "Rahasia coding frontend kilat.", requiredTier: "TYPE A", type: "video" },
    { contentId: "2", title: "Premium Video Tutorial TYPE B", description: "Panduan setup server AWS Lambda.", requiredTier: "TYPE B", type: "video" },
    { contentId: "3", title: "E-Book Premium Guide", description: "Dokumentasi komplit platform.", requiredTier: "TYPE A", type: "document" }
  ];
}

// ==========================================
// 6. DUMMY ACCESS URL (Asli Kelompokmu)
// ==========================================
export async function accessContent(contentId) {
  return { url: "https://example.com/dummy-media-stream-link" };
}