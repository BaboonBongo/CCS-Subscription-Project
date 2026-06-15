import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { login } from "../services/api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successNotif, setSuccessNotif] = useState("");
  const [loading, setLoading] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();

  // Menangkap notifikasi sukses dari halaman Register
  useEffect(() => {
    if (location.state?.message) {
      setSuccessNotif(location.state.message);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Memanggil fungsi login dummy/API kita
      const data = await login(email, password);
      
      console.log("Login sukses, mengecek status user:", data);
      
      // Ambil status tier user saat ini (untuk simulasi local storage/data backend)
      const userStatus = localStorage.getItem("subscription_status");

      if (!userStatus || userStatus === "" || userStatus === "none") {
        console.log("User baru atau belum pilih plan, arahkan ke /subscription");
        navigate("/subscription");
      } else {
        console.log("User lama/sudah ada akun aktif, arahkan ke /content");
        navigate("/content");
      }
      
    } catch (err) {
      setError(err.message || "Email atau password salah.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      backgroundColor: "#090514", // Hitam keunguan pekat khas Spotify UI revisi
      color: "#f3f4f6",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "sans-serif",
      padding: "1.5rem"
    }}>
      <div style={{
        backgroundColor: "#110b21", // Card background sedikit lebih terang dari base canvas
        borderRadius: "16px",
        padding: "2.5rem",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
        border: "1px solid #1f1a2e"
      }}>
        
        {/* LOGO BRAND BARU REVISI */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{ color: "#a78bfa", display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "2rem", margin: "0 0 0.5rem 0" }}>
            🎵 SoundStream
          </h1>
          <p style={{ color: "#9ca3af", margin: 0, fontSize: "0.9rem" }}>
            Sign in to start listening to your premium waves
          </p>
        </div>

        {/* Notifikasi Hijau dari Register */}
        {successNotif && (
          <div style={{ 
            backgroundColor: "#10b981", 
            color: "#fff", 
            padding: "0.75rem", 
            borderRadius: "8px", 
            marginBottom: "1.5rem", 
            textAlign: "center",
            fontSize: "0.85rem",
            fontWeight: "bold"
          }}>
            {successNotif}
          </div>
        )}

        <form onSubmit={handleLogin}>
          {/* INPUT EMAIL STYLE MUSIC APP */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: "600", color: "#9ca3af" }}>
              Email Address
            </label>
            <input 
              type="email" 
              placeholder="name@email.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                backgroundColor: "#1c1435",
                border: "1px solid #2d2254",
                color: "#fff",
                fontSize: "0.95rem",
                outline: "none",
                boxSizing: "border-box"
              }}
              onFocus={(e) => e.target.style.borderColor = "#a78bfa"}
              onBlur={(e) => e.target.style.borderColor = "#2d2254"}
            />
          </div>
          
          {/* INPUT PASSWORD */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: "600", color: "#9ca3af" }}>
              Password
            </label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                backgroundColor: "#1c1435",
                border: "1px solid #2d2254",
                color: "#fff",
                fontSize: "0.95rem",
                outline: "none",
                boxSizing: "border-box"
              }}
              onFocus={(e) => e.target.style.borderColor = "#a78bfa"}
              onBlur={(e) => e.target.style.borderColor = "#2d2254"}
            />
          </div>

          {/* NOTIFIKASI EROR */}
          {error && (
            <div style={{ 
              color: "#ef4444", 
              fontSize: "0.85rem", 
              marginBottom: "1rem",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              padding: "0.5rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid rgba(239, 68, 68, 0.2)"
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* TOMBOL LOGIN PILL-SHAPED ala SPOTIFY */}
          <button 
            type="submit" 
            disabled={loading} 
            style={{ 
              width: "100%",
              padding: "0.85rem",
              borderRadius: "30px", // Membuat tombol melengkung penuh (Pill-shaped)
              backgroundColor: "#7c3aed", // Ungu premium cerah
              color: "#fff",
              border: "none",
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background-color 0.2s, transform 0.1s",
              boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)"
            }}
            onMouseEnter={(e) => { if(!loading) e.target.style.backgroundColor = "#6d28d9" }}
            onMouseLeave={(e) => { if(!loading) e.target.style.backgroundColor = "#7c3aed" }}
          >
            {loading ? "Connecting to SoundStream..." : "Sign In"}
          </button>
        </form>

        {/* LINK REGISTER */}
        <div style={{ 
          textAlign: "center", 
          marginTop: "1.5rem", 
          fontSize: "0.85rem", 
          color: "#9ca3af" 
        }}>
          New to SoundStream?{" "}
          <Link to="/register" style={{ color: "#a78bfa", textDecoration: "none", fontWeight: "600" }}>
            Create an account
          </Link>
        </div>

      </div>
    </div>
  );
}

export default Login;