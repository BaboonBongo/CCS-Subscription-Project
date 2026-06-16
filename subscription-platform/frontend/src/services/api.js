// ============
// 1. LOGIN
// ============
export async function login(email, password) {
  console.log("Mock Login SoundStream:", { email, password });

  const registeredEmail = localStorage.getItem("registered_email");
  const registeredPassword = localStorage.getItem("registered_password");

  const masterEmail = "admin@dummy.com";
  const masterPassword = "password123";

  if (
    (email === registeredEmail && password === registeredPassword) ||
    (email === masterEmail && password === masterPassword)
  ) {
    const dummy = {
      token: "dummy_jwt_token_12345",
      // --- PERUBAHAN DI SINI: "id" diubah menjadi "userId" agar cocok dengan AWS DynamoDB ---
      user: { userId: "user_test_123", email: email } 
    };
    
    localStorage.setItem("token", dummy.token);
    localStorage.setItem("user", JSON.stringify(dummy.user));
    localStorage.setItem("user_email", email); 
    
    return dummy;
  } else {
    throw new Error("Login Gagal! Email belum terdaftar atau password salah.");
  }
}

// ==============
// 2. REGISTER
// ==============
export async function register(email, password) {
  localStorage.setItem("registered_email", email);
  localStorage.setItem("registered_password", password);

  return { message: "Dummy User Registered Successfully!", success: true };
}

// ====================================
// 3. REAL AWS SUBSCRIBE INTERACTION
// ====================================
export async function subscribe(userId, email, tier) {
  try {
    // Menembak langsung ke AWS API Gateway milik tim backend kamu
    const response = await fetch(
      "https://nxy7ykfna6.execute-api.us-east-1.amazonaws.com/dev/subscribe",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userId,
          email: email,
          tier: tier.toLowerCase(), // Diubah ke lowercase (starter/plus/premium) sesuai spek Lambda
        }),
      }
    );

    // Mengantisipasi jika terjadi Internal Server Error (HTTP 500) dari AWS
    if (!response.ok && response.status === 500) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Terjadi kesalahan internal pada server AWS Lambda.");
    }

    // Mengembalikan data JSON hasil respons dari Lambda (success: true atau false)
    return await response.json();
  } catch (error) {
    console.error("Gagal menyambungkan ke AWS Lambda:", error);
    throw new Error(error.message || "Koneksi ke server backend gagal.");
  }
}

// =============
// 4. STATUS 
// =============
export async function getStatus() {
  const savedTier = localStorage.getItem("active_subscription"); 
  const savedEmail = localStorage.getItem("user_email") || "guest@soundstream.com";

  return {
    success: true,
    email: savedEmail,
    tier: savedTier || "Starter", 
    status: savedTier ? "active" : "none"
  };
}

// ==========================================
// 5. DUMMY KATALOG LAGU SOUNDSTREAM (REVISI TOTAL)
// ==========================================
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
// 6. ACCESS URL UNTUK AUDIO PLAYER RIIL
// ==========================================
export async function accessContent(contentId) {
  return { 
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"};
}