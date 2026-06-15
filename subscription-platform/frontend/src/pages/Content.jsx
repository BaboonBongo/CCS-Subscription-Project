import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getStatus } from "../services/api";

function Content() {
  const [userStatus, setUserStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // State interaktif simulasi musik
  const [activeTrack, setActiveTrack] = useState(null);
  const [playlists, setPlaylists] = useState(["My Top Vibes", "Chill Study"]);
  const [skipCount, setSkipCount] = useState(0);
  const [accessError, setAccessError] = useState("");
  const [countdown, setCountdown] = useState(10); // Naikkan ke 10 detik biar demo lagu sempat dicoba

  const navigate = useNavigate();

  // Mock Data Catalog Lagu disesuaikan dengan kualifikasi Tier dari Subscription
  const trackCatalog = [
    { id: "m1", title: "Neon Pulse", artist: "ZARA-X", type: "Trending Chart", requiredTier: "Starter", duration: "3:42", quality: "128 kbps Standard" },
    { id: "m2", title: "Midnight Echo", artist: "Solaris", type: "Trending Chart", requiredTier: "Starter", duration: "2:50", quality: "128 kbps Standard" },
    { id: "m3", title: "Crystal Void", artist: "Novae", type: "Ad-Free Stream", requiredTier: "Plus", duration: "4:15", quality: "256 kbps High" },
    { id: "m4", title: "Deep Orbit", artist: "Kael", type: "Ad-Free Stream", requiredTier: "Plus", duration: "3:10", quality: "256 kbps High" },
    { id: "m5", title: "Phantom Bass (Hi-Fi)", artist: "Dusk Wave", type: "Lossless Audio", requiredTier: "Premium", duration: "5:02", quality: "320 kbps Master" },
    { id: "m6", title: "Hollow (Lossless)", artist: "Elara", type: "Lossless Audio", requiredTier: "Premium", duration: "3:35", quality: "320 kbps Master" },
    { id: "m7", title: "Collaborative Session Jam", artist: "Studio Users", type: "Shared Session", requiredTier: "Studio", duration: "6:12", quality: "320 kbps Master" },
  ];

  useEffect(() => {
    async function initDashboard() {
      try {
        const savedTier = localStorage.getItem("active_subscription") || "Starter";
        const savedStatus = localStorage.getItem("subscription_status") || "active";
        
        setUserStatus({
          email: JSON.parse(localStorage.getItem("user") || "{}").email || "user@soundstream.com",
          tier: savedTier,
          status: savedStatus
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    initDashboard();
  }, []);

  // Timer Hitung Mundur Demo Paket Premium
  useEffect(() => {
    if (!userStatus?.tier || userStatus?.tier === "Starter") return;

    if (countdown <= 0) {
      setUserStatus((prev) => ({ ...prev, tier: "Starter", status: "expired" }));
      localStorage.setItem("active_subscription", "Starter");
      localStorage.setItem("subscription_status", "expired");
      setActiveTrack(null);
      alert("Demo premium 10 detik habis! Fitur diturunkan kembali ke Starter (Free Tier).");
      return;
    }

    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, userStatus?.tier]);

  // Handler Putar Musik Berdasarkan Tier
  const handlePlayTrack = (track) => {
    setAccessError("");
    
    // Proteksi Hak Akses bertingkat
    const tierHierarchy = { "Starter": 1, "Plus": 2, "Premium": 3, "Studio": 4 };
    const userRank = tierHierarchy[userStatus?.tier] || 1;
    const requiredRank = tierHierarchy[track.requiredTier];

    if (userRank < requiredRank) {
      setAccessError(`Fitur terkunci! Lagu "${track.title}" membutuhkan paket minimum ${track.requiredTier}. Paket Anda saat ini: ${userStatus?.tier}`);
      return;
    }

    setActiveTrack(track);
  };

  // Handler Fitur Skips (Plus ke atas Unlimited, Starter dibatasi)
  const handleSkip = () => {
    if (userStatus?.tier === "Starter" && skipCount >= 3) {
      setAccessError("Gagal Skip! Akun Starter (Free) dibatasi maksimal 3 skips. Upgrade ke Plus untuk unlimited skips!");
      return;
    }
    setSkipCount((prev) => prev + 1);
    alert("Track skipped successfully!");
  };

  // Handler Tambah Playlist (Starter max 3)
  const handleCreatePlaylist = () => {
    if (userStatus?.tier === "Starter" && playlists.length >= 3) {
      setAccessError("Gagal Membuat Playlist! Batas maksimal paket Starter adalah 3 playlist. Upgrade ke Plus untuk unlimted!");
      return;
    }
    const name = prompt("Enter playlist name:");
    if (name) setPlaylists((prev) => [...prev, name]);
  };

  if (loading) return <div style={{ color: "#a78bfa", textAlign: "center", marginTop: "20%" }}>Loading SoundStream Engine...</div>;

  return (
    <div style={{ backgroundColor: "#090514", color: "#f3f4f6", minHeight: "100vh", display: "flex", fontFamily: "sans-serif" }}>
      
      {/* 1. SIDEBAR KIRI STYLE SPOTIFY */}
      <div style={{ width: "260px", backgroundColor: "#020006", padding: "1.5rem", display: "flex", flexDirection: "column", borderRight: "1px solid #1f1a2e" }}>
        <h2 style={{ color: "#a78bfa", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.5rem", marginBottom: "2rem" }}>
          🎵 SoundStream
        </h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
          <div style={{ cursor: "pointer", color: "#a78bfa", fontWeight: "bold" }}>🏠 Home</div>
          <div style={{ cursor: "pointer", color: "#9ca3af" }}>🔍 Search</div>
          <div style={{ cursor: "pointer", color: "#9ca3af" }}>📚 Your Library</div>
        </div>

        <hr style={{ borderColor: "#1f1a2e", marginBottom: "1.5rem" }} />

        {/* Fitur Manage Playlist Terikat Aturan Tier */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#9ca3af", fontWeight: "600" }}>MY PLAYLISTS ({playlists.length})</span>
          <button onClick={handleCreatePlaylist} style={{ background: "#7c3aed", border: "none", color: "#fff", borderRadius: "50%", width: "24px", height: "24px", cursor: "pointer", fontWeight: "bold" }}>+</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {playlists.map((p, i) => (
            <div key={i} style={{ color: "#e5e7eb", fontSize: "0.85rem", padding: "0.25rem 0" }}>• {p}</div>
          ))}
        </div>
      </div>

      {/* 2. AREA UTAMA / DASHBOARD KATALOG */}
      <div style={{ flexGrow: 1, padding: "2rem", display: "flex", flexDirection: "column", paddingBottom: "100px" }}>
        
        {/* Header bar informasi akun */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#120c24", padding: "1rem 1.5rem", borderRadius: "8px", marginBottom: "2rem" }}>
          <div>
            <span style={{ marginRight: "1.5rem", color: "#9ca3af" }}>User: <strong style={{ color: "#fff" }}>{userStatus?.email}</strong></span>
            <span style={{ marginRight: "1.5rem" }}>Tier: <span style={{ backgroundColor: "#7c3aed", padding: "0.25rem 0.6rem", borderRadius: "4px", fontSize: "0.8rem", fontWeight: "bold" }}>{userStatus?.tier?.toUpperCase()}</span></span>
            <span>Status: <span style={{ color: userStatus?.status === "active" ? "#10b981" : "#ef4444" }}>{userStatus?.status?.toUpperCase()}</span></span>
          </div>

          <div style={{ display: "flex", gap: "1rem" }}>
            {userStatus?.tier === "Starter" && (
              <button onClick={() => navigate("/subscription")} style={{ backgroundColor: "#10b981", border: "none", color: "#fff", padding: "0.5rem 1rem", borderRadius: "20px", fontWeight: "bold", cursor: "pointer" }}>
                🚀 Upgrade Plan
              </button>
            )}
            <button 
              onClick={() => {
                localStorage.removeItem("active_subscription");
                localStorage.removeItem("subscription_status");
                window.location.reload();
              }}
              style={{ background: "none", border: "1px solid #ef4444", color: "#ef4444", padding: "0.5rem 1rem", borderRadius: "20px", cursor: "pointer" }}
            >
              Reset Demo
            </button>
          </div>
        </div>

        {/* Notifikasi Hitung Mundur Demo Premium */}
        {userStatus?.tier !== "Starter" && (
          <div style={{ backgroundColor: "#ef4444", color: "#fff", padding: "0.75rem", borderRadius: "6px", marginBottom: "1.5rem", fontWeight: "bold", textAlign: "center" }}>
            ⚠️ Premium Trial Active! Akun otomatis turun ke Starter dalam: {countdown} detik.
          </div>
        )}

        {/* Pesan Kesalahan Akses (Fitur Terkunci) */}
        {accessError && (
          <div style={{ backgroundColor: "#fee2e2", color: "#b91c1c", padding: "1rem", borderRadius: "6px", marginBottom: "1.5rem", fontWeight: "600" }}>
            🛑 {accessError}
          </div>
        )}

        {/* GRID KATALOG LAGU */}
        <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Trending Charts & Curated Tracks</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1.5rem" }}>
          {trackCatalog.map((track) => {
            const isAccessible = userStatus?.tier === track.requiredTier || (userStatus?.tier !== "Starter" && track.requiredTier === "Starter");
            return (
              <div 
                key={track.id} 
                onClick={() => handlePlayTrack(track)}
                style={{
                  backgroundColor: "#110b21",
                  borderRadius: "8px",
                  padding: "1.25rem",
                  cursor: "pointer",
                  border: activeTrack?.id === track.id ? "2px solid #a78bfa" : "1px solid #1f1a2e",
                  transition: "transform 0.2s",
                  position: "relative"
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.03)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                {/* Cover Album Art Minimalis */}
                <div style={{ width: "100%", height: "140px", backgroundColor: "#251b45", borderRadius: "6px", marginBottom: "1rem", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "2.5rem" }}>
                  📻
                </div>
                <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem" }}>{track.title}</h4>
                <p style={{ margin: "0 0 1rem 0", color: "#9ca3af", fontSize: "0.85rem" }}>{track.artist}</p>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "4px", backgroundColor: "#2e1c5b", color: "#c084fc" }}>
                    {track.requiredTier} Only
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{track.duration}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. MUSIC PLAYER CONTROLLER (BOTTOM FIXED BAR) */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "90px",
        backgroundColor: "#0b0718",
        borderTop: "1px solid #1f1a2e",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 2rem",
        zIndex: 100
      }}>
        {/* Info lagu yang sedang aktif */}
        <div style={{ width: "30%", display: "flex", flexDirection: "column" }}>
          {activeTrack ? (
            <>
              <span style={{ fontWeight: "bold", color: "#fff" }}>▶️ Now Playing: {activeTrack.title}</span>
              <span style={{ fontSize: "0.8rem", color: "#a78bfa" }}>Streaming Quality: {activeTrack.quality}</span>
            </>
          ) : (
            <span style={{ color: "#4b5563", fontSize: "0.9rem" }}>No track selected. Click a card to stream.</span>
          )}
        </div>

        {/* Kontrol Musik & Skips */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", width: "40%" }}>
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
            <span style={{ cursor: "pointer", fontSize: "1.2rem" }}>⏮️</span>
            <span style={{ cursor: "pointer", fontSize: "1.8rem", color: "#a78bfa" }}>{activeTrack ? "⏸️" : "▶️"}</span>
            <span onClick={handleSkip} style={{ cursor: "pointer", fontSize: "1.2rem" }} title="Skip Track">⏭️</span>
          </div>
          <div style={{ width: "100%", height: "4px", backgroundColor: "#1f1a2e", borderRadius: "2px", position: "relative" }}>
            <div style={{ width: activeTrack ? "45%" : "0%", height: "100%", backgroundColor: "#7c3aed", borderRadius: "2px" }}></div>
          </div>
        </div>

        {/* Stat Interaktif Tambahan */}
        <div style={{ width: "30%", textAlign: "right", fontSize: "0.85rem", color: "#9ca3af" }}>
          <div>Simulated Skips Done: <strong style={{ color: "#fff" }}>{skipCount}</strong></div>
          {userStatus?.tier === "Starter" && <div style={{ fontSize: "0.75rem", color: "#ef4444" }}>Ads status: Enabled (Occasional Ads)</div>}
          {userStatus?.tier !== "Starter" && userStatus?.tier !== "Free" && <div style={{ fontSize: "0.75rem", color: "#10b981" }}>Ads status: Disabled (Premium Clean Session)</div>}
        </div>
      </div>

    </div>
  );
}

export default Content;