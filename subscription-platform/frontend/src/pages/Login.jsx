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
      // Catatan: Jika user baru daftar, biasanya nilai tier-nya kosong atau belum diset
      const userStatus = localStorage.getItem("subscription_status");

      if (!userStatus || userStatus === "" || userStatus === "none") {
        // REVISI POIN 2 & 3: User baru/belum langganan langsung dipaksa ke halaman subscription plan
        console.log("User baru atau belum pilih plan, arahkan ke /subscription");
        navigate("/subscription");
      } else {
        // REVISI POIN 2: Jika sudah memiliki akun/langganan dari awal, langsung ke content website
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
    <div className="auth-container">
      <div className="auth-card">
        <h1>Welcome Back</h1>
        <p className="subtitle">Sign in to access your dashboard</p>

        {/* Notifikasi Hijau dari Register */}
        {successNotif && (
          <div className="result-message success" style={{ backgroundColor: '#10b981', color: '#fff', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '1rem', textAlign: 'center' }}>
            {successNotif}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input 
              type="email" 
              placeholder="user@example.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          {error && <div className="error-message" style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ marginTop: '1rem' }}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="auth-link">
          Don't have an account? <Link to="/register">Register here</Link>
        </div>
      </div>
    </div>
  );
}

export default Login;