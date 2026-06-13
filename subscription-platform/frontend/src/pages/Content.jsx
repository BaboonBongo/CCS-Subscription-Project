import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getContent, getStatus, accessContent } from "../services/api";

function Content() {
  const [contentList, setContentList] = useState([]);
  const [userStatus, setUserStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [activeContent, setActiveContent] = useState(null);
  const [accessError, setAccessError] = useState("");
  const [accessLoading, setAccessLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      try {
        const [contentData, statusData] = await Promise.all([
          getContent(),
          getStatus()
        ]);
        setContentList(contentData);
        setUserStatus(statusData);
      } catch (err) {
        setError("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleAccess = async (content) => {
    // PROTEKSI FRONTEND: Jika tipe paket user tidak sesuai dengan kualifikasi video, blokir!
    if (userStatus?.tier !== content.requiredTier) {
      setAccessError(`Konten ini hanya untuk pengguna ${content.requiredTier}. Paket Anda saat ini adalah ${userStatus?.tier}`);
      return;
    }

    setActiveContent(null);
    setAccessError("");
    setAccessLoading(true);

    try {
      const data = await accessContent(content.contentId);
      setActiveContent({ ...content, url: data.url });
    } catch (err) {
      setAccessError(err.message || "Access denied");
    } finally {
      setAccessLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (error) return <div className="page-container"><div className="error-message">{error}</div></div>;

  // 🌟 CABANG 1: JIKA BELUM LANGGANAN (TIER MASIH NULL)
  if (!userStatus?.tier) {
    return (
      <div className="page-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "70vh" }}>
        <div className="auth-card" style={{ textAlign: "center", width: "100%", maxWidth: "450px", padding: "2.5rem" }}>
          <h2>Welcome to Premium Platform</h2>
          <p className="subtitle" style={{ marginBottom: "2rem", color: "var(--text-secondary)" }}>
            You are not subscribed yet. Please subscribe to access our premium library catalog.
          </p>
          <button 
            className="btn btn-primary btn-full" 
            onClick={() => navigate("/subscription")} // 🏃 Pindah ke halaman pilihan TYPE A & B
            style={{ padding: "1.2rem", fontSize: "1.2rem", fontWeight: "bold" }}
          >
            SUBSCRIBE
          </button>
        </div>
      </div>
    );
  }

  // 🌟 CABANG 3: JIKA SUDAH LANGGANAN (TAMPILKAN KATALOG ASLI)
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Content Library</h1>
        <p>Browse our catalog. Your access depends on your current tier and subscription status.</p>
        
        <button 
          onClick={() => {
            localStorage.removeItem("active_subscription");
            window.location.reload(); // Reset simulasi agar kembali jadi user biasa
          }}
          style={{ marginTop: "1rem", background: "none", border: "1px solid #ef4444", color: "#ef4444", padding: "0.5rem 1rem", borderRadius: "4px", cursor: "pointer" }}
        >
          Reset Simulasi (Kembali Belum Langganan)
        </button>
      </div>

      <div className="status-bar">
        <div className="status-item"><span className="status-label">Account:</span><span className="status-value">{userStatus?.email}</span></div>
        <div className="status-item"><span className="status-label">Tier:</span><span className={`tier-badge ${userStatus?.tier}`}>{userStatus?.tier}</span></div>
        <div className="status-item"><span className="status-label">Status:</span><span className={`status-value ${userStatus?.status}`}>{userStatus?.status?.toUpperCase()}</span></div>
      </div>

      {accessError && (
        <div className="error-message" style={{ marginBottom: '2rem', backgroundColor: '#fef2f2', color: '#ef4444', padding: '1rem', borderRadius: '6px' }}>
          <strong>Access Denied:</strong> {accessError}
        </div>
      )}

      {activeContent && (
        <div className="signed-url-display" style={{ marginBottom: '2rem' }}>
          <h3>✅ Access Granted: {activeContent.title}</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>A temporary signed URL has been generated: </p>
          <div className="url-text">{activeContent.url}</div>
          <p style={{ marginTop: '1rem' }}>
            <a href={activeContent.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)' }}>Open Media in New Tab ↗</a>
          </p>
        </div>
      )}

      <div className="content-grid">
        {contentList.map((item) => (
          <div key={item.contentId} className="content-card" onClick={() => handleAccess(item)} style={{ cursor: 'pointer', border: userStatus?.tier === item.requiredTier ? '2px solid #10b981' : '1px solid #374151' }}>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <span className={`tier-badge ${item.requiredTier}`}>{item.requiredTier}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.type}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Content;