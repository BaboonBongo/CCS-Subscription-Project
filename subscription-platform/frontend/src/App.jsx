import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Content from "./pages/Content";
import Subscription from "./pages/Subscription";
import ProtectedRoute from "./components/ProtectedRoute";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("token");

  // REVISI UI: Sembunyikan navbar global ini jika user sudah masuk ke halaman Content dashboard musik,
  // karena halaman content nanti akan memiliki sidebar & top-barnya sendiri ala Spotify asli.
  if (location.pathname === "/content") return null;

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("active_subscription");
    localStorage.removeItem("subscription_status");
    navigate("/");
  };

  return (
    <nav style={{
      backgroundColor: "#020006", // Hitam pekat selaras dasar musik app
      padding: "1rem 2rem",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: "1px solid #1f1a2e",
      fontFamily: "sans-serif"
    }}>
      {/* BRANDING BARU */}
      <Link to={token ? "/content" : "/"} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "1.5rem" }}>🎵</span>
        <span style={{ color: "#a78bfa", fontWeight: "bold", fontSize: "1.3rem" }}>SoundStream</span>
      </Link>
      
      {token && (
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <Link to="/content" style={{ color: "#9ca3af", textDecoration: "none", fontSize: "0.95rem", fontWeight: "500" }} 
            onMouseEnter={(e) => e.target.style.color = "#fff"} onMouseLeave={(e) => e.target.style.color = "#9ca3af"}>
            Music Library
          </Link>
          <Link to="/subscription" style={{ color: "#9ca3af", textDecoration: "none", fontSize: "0.95rem", fontWeight: "500" }}
            onMouseEnter={(e) => e.target.style.color = "#fff"} onMouseLeave={(e) => e.target.style.color = "#9ca3af"}>
            Plans
          </Link>
          <button 
            onClick={handleLogout} 
            style={{ 
              backgroundColor: "transparent", 
              border: "1px solid #ef4444", 
              color: "#ef4444", 
              padding: "0.4rem 1rem", 
              borderRadius: "20px", 
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: "600",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => { e.target.style.backgroundColor = "#ef4444"; e.target.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.target.style.backgroundColor = "transparent"; e.target.style.color = "#ef4444"; }}
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}

// Wrapper komponen pendukung agar Navbar bisa membaca hooks useLocation() dengan aman
function AppContent() {
  return (
    <div style={{ backgroundColor: "#090514", minHeight: "100vh" }}>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route 
            path="/content" 
            element={
              <ProtectedRoute>
                <Content />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/subscription" 
            element={
              <ProtectedRoute>
                <Subscription />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;