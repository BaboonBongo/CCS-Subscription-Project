import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register } from "../services/api";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register(email, password);
      
      // Kirim pesan sukses ke halaman Login melalui state navigasi
      navigate("/", { 
        state: { message: "Registrasi berhasil! Silakan masuk menggunakan akun Anda." } 
      });
    } catch (err) {
      setError(err.message || "Registrasi gagal. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      backgroundColor: "#090514", // Senada dengan background Login
      color: "#f3f4f6",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "sans-serif",
      padding: "1.5rem"
    }}>
      <div style={{
        backgroundColor: "#110b21", // Card background mewah keunguan
        borderRadius: "16px",
        padding: "2.5rem",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
        border: "1px solid #1f1a2e"
      }}>
        
        {/* BRANDING LOGO */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{ color: "#a78bfa", display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "2rem", margin: "0 0 0.5rem 0" }}>
            🎵 SoundStream
          </h1>
          <p style={{ color: "#9ca3af", margin: 0, fontSize: "0.9rem" }}>
            Sign up to start your endless musical journey
          </p>
        </div>
        
        <form onSubmit={handleRegister}>
          {/* INPUT EMAIL */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: "600", color: "#9ca3af" }}>
              Email Address
            </label>
            <input 
              type="email" 
              placeholder="user@example.com"
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
              minLength="6"
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
          
          {/* TOMBOL REGISTER PILL-SHAPED */}
          <button 
            type="submit" 
            disabled={loading} 
            style={{ 
              width: "100%",
              padding: "0.85rem",
              borderRadius: "30px", // Bentuk pil ala Spotify
              backgroundColor: "#7c3aed",
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
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>
        
        {/* LINK LOGIN */}
        <div style={{ 
          textAlign: "center", 
          marginTop: "1.5rem", 
          fontSize: "0.85rem", 
          color: "#9ca3af" 
        }}>
          Already have an account?{" "}
          <Link to="/" style={{ color: "#a78bfa", textDecoration: "none", fontWeight: "600" }}>
            Login here
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Register;