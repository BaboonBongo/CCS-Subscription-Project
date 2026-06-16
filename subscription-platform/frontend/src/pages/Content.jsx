import { useState, useEffect, useRef } from "react"; 
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
  const [countdown, setCountdown] = useState(10); 

  const [activeTab, setActiveTab] = useState("home");
  const [searchQuery, setSearchQuery] = useState("");

  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // ➕ TAMBAHAN BARU: State untuk melacak durasi dan detik berjalan secara riil
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Menyimpan data lagu yang dimasukkan ke playlist
  const [playlistContents, setPlaylistContents] = useState({
    "My Top Vibes": [],
    "Chill Study": []
  });

  const lastTrackIdRef = useRef(null);
  const navigate = useNavigate();

  // Mock Data Catalog Lagu
  const trackCatalog = [
    { id: "m1", title: "Neon Pulse", artist: "ZARA-X", type: "Trending Chart", requiredTier: "Starter", duration: "3:42", quality: "128 kbps Standard", img: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&auto=format&fit=crop&q=60", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
    { id: "m2", title: "Midnight Echo", artist: "Solaris", type: "Trending Chart", requiredTier: "Starter", duration: "2:50", quality: "128 kbps Standard", img: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=60", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
    { id: "m3", title: "Crystal Void", artist: "Novae", type: "Ad-Free Stream", requiredTier: "Plus", duration: "4:15", quality: "256 kbps High", img: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=60", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
    { id: "m4", title: "Deep Orbit", artist: "Kael", type: "Ad-Free Stream", requiredTier: "Plus", duration: "3:10", quality: "256 kbps High", img: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=60", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" },
    { id: "m5", title: "Phantom Bass (Hi-Fi)", artist: "Dusk Wave", type: "Lossless Audio", requiredTier: "Premium", duration: "5:02", quality: "320 kbps Master", img: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&auto=format&fit=crop&q=60", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" },
    { id: "m6", title: "Hollow (Lossless)", artist: "Elara", type: "Lossless Audio", requiredTier: "Premium", duration: "3:35", quality: "320 kbps Master", img: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&auto=format&fit=crop&q=60", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3" },
    { id: "m7", title: "Collaborative Session Jam", artist: "Studio Users", type: "Shared Session", requiredTier: "Studio", duration: "6:12", quality: "320 kbps Master", img: "https://images.unsplash.com/photo-1453090927415-5f45085b65c0?w=400&auto=format&fit=crop&q=60", src: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3" },
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
      if (audioRef.current) audioRef.current.pause(); 
      setIsPlaying(false);
      alert("Demo premium 10 detik habis! Fitur diturunkan kembali ke Starter (Free Tier).");
      return;
    }

    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, userStatus?.tier]);

  // 🛠️ UPDATE PLAYBACK ENGINE: Mengatur audio asli & event listener waktu berjalan
  useEffect(() => {
    if (activeTrack) {
      // Jika ganti lagu baru, reset total audio object-nya
      if (lastTrackIdRef.current !== activeTrack.id) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        audioRef.current = new Audio(activeTrack.src);
        lastTrackIdRef.current = activeTrack.id;

        // Listener saat metadata lagu siap (untuk mengambil durasi asli)
        audioRef.current.addEventListener("loadedmetadata", () => {
          setDuration(audioRef.current.duration);
        });

        // Listener ketika detiknya berjalan rutin
        audioRef.current.addEventListener("timeupdate", () => {
          setCurrentTime(audioRef.current.currentTime);
        });

        // Listener jika lagu selesai otomatis ganti lagu atau stop
        audioRef.current.addEventListener("ended", () => {
          setIsPlaying(false);
          setCurrentTime(0);
        });
      }
      
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.log("Playback diblokir browser:", err));
    }
  }, [activeTrack]);

  // Handler Putar Musik Berdasarkan Tier
  const handlePlayTrack = (track) => {
    setAccessError("");
    
    const tierHierarchy = { "Starter": 1, "Plus": 2, "Premium": 3, "Studio": 4 };
    const userRank = tierHierarchy[userStatus?.tier] || 1;
    const requiredRank = tierHierarchy[track.requiredTier];

    if (userRank < requiredRank) {
      setAccessError(`Fitur terkunci! Lagu "${track.title}" membutuhkan paket minimum ${track.requiredTier}. Paket Anda saat ini: ${userStatus?.tier}`);
      return;
    }

    if (activeTrack?.id === track.id) {
      handleTogglePlay();
    } else {
      setActiveTrack(track);
    }
  };

  // 🛠️ UPDATE TOGGLE: Berhenti pas di tempat & melanjutkan (resume) tanpa mengulang
  const handleTogglePlay = () => {
    if (!activeTrack || !audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error(err));
    }
  };

  // Handler Fitur Skips
  const handleSkip = () => {
    if (userStatus?.tier === "Starter" && skipCount >= 3) {
      setAccessError("Gagal Skip! Akun Starter (Free) dibatasi maksimal 3 skips. Upgrade ke Plus untuk unlimited skips!");
      return;
    }
    setSkipCount((prev) => prev + 1);
    
    const currentIdx = trackCatalog.findIndex(t => t.id === activeTrack?.id);
    const nextIdx = (currentIdx + 1) % trackCatalog.length;
    
    const tierHierarchy = { "Starter": 1, "Plus": 2, "Premium": 3, "Studio": 4 };
    if ((tierHierarchy[userStatus?.tier] || 1) >= tierHierarchy[trackCatalog[nextIdx].requiredTier]) {
      setActiveTrack(trackCatalog[nextIdx]);
    } else {
      setActiveTrack(trackCatalog[0]); 
    }

    alert("Track skipped successfully!");
  };

  // ➕ TAMBAHAN BARU: Fungsi untuk mengubah lompatan detik saat progress bar di-klik/geser
  const handleScrubbing = (e) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
  };

  // ➕ TAMBAHAN BARU: Helper untuk mengubah format detik angka ke string menit 0:00
  const formatTimeStr = (secs) => {
    if (isNaN(secs)) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // Handler Tambah Playlist
  const handleCreatePlaylist = () => {
    if (userStatus?.tier === "Starter" && playlists.length >= 3) {
      setAccessError("Gagal Membuat Playlist! Batas maksimal paket Starter adalah 3 playlist. Upgrade ke Plus untuk unlimted!");
      return;
    }
    const name = prompt("Enter playlist name:");
    if (name) {
      setPlaylists((prev) => [...prev, name]);
      setPlaylistContents(prev => ({ ...prev, [name]: [] }));
    }
  };

  // Memasukkan Lagu Tertentu ke Dalam List Playlist Pilihan
  const handleAddToPlaylistAction = (e, track) => {
    e.stopPropagation(); 
    const options = playlists.map((p, i) => `${i + 1}. ${p}`).join("\n");
    const choice = prompt(`Ketik Angka Nomor Playlist untuk memasukkan lagu "${track.title}":\n\n${options}`);
    const chosenPlaylist = playlists[parseInt(choice) - 1];

    if (chosenPlaylist) {
      if (playlistContents[chosenPlaylist].some(t => t.id === track.id)) {
        alert("Lagu ini sudah terdaftar di playlist tersebut!");
        return;
      }
      setPlaylistContents(prev => ({
        ...prev,
        [chosenPlaylist]: [...prev[chosenPlaylist], track]
      }));
      alert(`Berhasil memasukkan "${track.title}" ke dalam playlist [${chosenPlaylist}]`);
    }
  };

  // Pencarian filter lagu dinamis jika sedang di tab search
  const filteredCatalog = trackCatalog.filter(track => 
    track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div style={{ color: "#a78bfa", textAlign: "center", marginTop: "20%" }}>Loading SoundStream Engine...</div>;

  return (
    <div style={{ backgroundColor: "#090514", color: "#f3f4f6", minHeight: "100vh", display: "flex", fontFamily: "sans-serif" }}>
      
      {/* ========================================== */}
      {/* 1. SIDEBAR KIRI                            */}
      {/* ========================================== */}
      <div style={{ width: "260px", backgroundColor: "#020006", padding: "1.5rem", display: "flex", flexDirection: "column", borderRight: "1px solid #1f1a2e" }}>
        <h2 style={{ color: "#a78bfa", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.5rem", marginBottom: "2rem" }}>
          🎵 SoundStream
        </h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
          <div 
            onClick={() => setActiveTab("home")} 
            style={{ cursor: "pointer", color: activeTab === "home" ? "#a78bfa" : "#9ca3af", fontWeight: activeTab === "home" ? "bold" : "normal" }}
          >
            🏠 Home
          </div>
          <div 
            onClick={() => setActiveTab("search")} 
            style={{ cursor: "pointer", color: activeTab === "search" ? "#a78bfa" : "#9ca3af", fontWeight: activeTab === "search" ? "bold" : "normal" }}
          >
            🔍 Search
          </div>
          <div 
            onClick={() => setActiveTab("library")} 
            style={{ cursor: "pointer", color: activeTab === "library" ? "#a78bfa" : "#9ca3af", fontWeight: activeTab === "library" ? "bold" : "normal" }}
          >
            📚 Your Library
          </div>
        </div>

        <hr style={{ borderColor: "#1f1a2e", marginBottom: "1.5rem" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#9ca3af", fontWeight: "600" }}>MY PLAYLISTS ({playlists.length})</span>
          <button onClick={handleCreatePlaylist} style={{ background: "#7c3aed", border: "none", color: "#fff", borderRadius: "50%", width: "24px", height: "24px", cursor: "pointer", fontWeight: "bold" }}>+</button>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {playlists.map((p, i) => (
            <div 
              key={i} 
              onClick={() => setActiveTab(`playlist-${p}`)} 
              style={{ 
                color: activeTab === `playlist-${p}` ? "#a78bfa" : "#e5e7eb", 
                fontSize: "0.85rem", 
                padding: "0.25rem 0.5rem", 
                cursor: "pointer",
                fontWeight: activeTab === `playlist-${p}` ? "bold" : "normal",
                backgroundColor: activeTab === `playlist-${p}` ? "rgba(167,139,250,0.1)" : "transparent",
                borderRadius: "4px"
              }}
            >
              • {p} ({playlistContents[p]?.length || 0})
            </div>
          ))}
        </div>
      </div>

      {/* ========================================== */}
      {/* 2. AREA UTAMA / DASHBOARD                  */}
      {/* ========================================== */}
      <div style={{ flexGrow: 1, padding: "2rem", display: "flex", flexDirection: "column", paddingBottom: "100px" }}>
        
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

        {userStatus?.tier !== "Starter" && (
          <div style={{ backgroundColor: "#ef4444", color: "#fff", padding: "0.75rem", borderRadius: "6px", marginBottom: "1.5rem", fontWeight: "bold", textAlign: "center" }}>
            ⚠️ Premium Trial Active! Akun otomatis turun ke Starter dalam: {countdown} detik.
          </div>
        )}

        {accessError && (
          <div style={{ backgroundColor: "#fee2e2", color: "#b91c1c", padding: "1rem", borderRadius: "6px", marginBottom: "1.5rem", fontWeight: "600" }}>
            🛑 {accessError}
          </div>
        )}

        {/* --- DYNAMIC TAB PANEL CONTENT --- */}
        
        {/* PANEL HOME */}
        {activeTab === "home" && (
          <div>
            <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Trending Charts & Curated Tracks</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1.5rem" }}>
              {trackCatalog.map((track) => (
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
                  <div style={{ width: "100%", height: "140px", borderRadius: "6px", marginBottom: "1rem", overflow: "hidden" }}>
                    <img src={track.img} alt={track.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  
                  <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.title}</h4>
                  <p style={{ margin: "0 0 1rem 0", color: "#9ca3af", fontSize: "0.85rem" }}>{track.artist}</p>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "4px", backgroundColor: "#2e1c5b", color: "#c084fc" }}>
                      {track.requiredTier} Only
                    </span>
                    <button 
                      onClick={(e) => handleAddToPlaylistAction(e, track)}
                      style={{ backgroundColor: "transparent", border: "1px solid #7c3aed", color: "#a78bfa", borderRadius: "4px", padding: "0.2rem 0.4rem", fontSize: "0.75rem", cursor: "pointer" }}
                    >
                      ➕ Playlist
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PANEL SEARCH */}
        {activeTab === "search" && (
          <div>
            <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>🔍 Search Music</h3>
            <input 
              type="text"
              placeholder="Search by song name or artist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", maxWidth: "400px", padding: "0.75rem 1rem", borderRadius: "8px", backgroundColor: "#110b21", border: "1px solid #1f1a2e", color: "#fff", marginBottom: "2rem" }}
            />
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1.5rem" }}>
              {filteredCatalog.map((track) => (
                <div key={track.id} onClick={() => handlePlayTrack(track)} style={{ backgroundColor: "#110b21", borderRadius: "8px", padding: "1.25rem", cursor: "pointer", border: "1px solid #1f1a2e" }}>
                  <div style={{ width: "100%", height: "140px", borderRadius: "6px", marginBottom: "1rem", overflow: "hidden" }}>
                    <img src={track.img} alt={track.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem" }}>{track.title}</h4>
                  <p style={{ margin: "0 0 1rem 0", color: "#9ca3af", fontSize: "0.85rem" }}>{track.artist}</p>
                </div>
              ))}
              {filteredCatalog.length === 0 && <p style={{ color: "#9ca3af" }}>No tracks found for "{searchQuery}"</p>}
            </div>
          </div>
        )}

        {/* PANEL LIBRARY */}
        {activeTab === "library" && (
          <div style={{ textAlign: "center", padding: "3rem 0" }}>
            <span style={{ fontSize: "3rem" }}>📚</span>
            <h3 style={{ fontSize: "1.5rem", marginTop: "1rem" }}>Your Music Library is Empty</h3>
            <p style={{ color: "#9ca3af" }}>Follow artists or hit like on trending charts to start building your library database.</p>
          </div>
        )}

        {/* TAMPILAN PLAYLIST */}
        {activeTab.startsWith("playlist-") && (
          <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
            <h3 style={{ fontSize: "1.5rem", marginBottom: "0.5rem", color: "#a78bfa" }}>
              📂 Playlist: {activeTab.replace("playlist-", "")}
            </h3>
            <p style={{ color: "#9ca3af", marginBottom: "2rem" }}>
              Daftar musik pilihan yang kamu simpan di folder ini.
            </p>
            
            {(!playlistContents[activeTab.replace("playlist-", "")] || playlistContents[activeTab.replace("playlist-", "")].length === 0) ? (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexGrow: 1, minHeight: "250px", width: "100%", textAlign: "center" }}>
                <p style={{ color: "#6b7280", fontStyle: "italic", maxWidth: "500px", lineHeight: "1.6" }}>
                  Belum ada lagu di dalam playlist ini. Kembali ke Home lalu klik tombol [➕ Playlist] pada lagu untuk mengelompokkannya di sini.
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1.5rem" }}>
                {(playlistContents[activeTab.replace("playlist-", "")]).map((track) => (
                  <div key={track.id} onClick={() => handlePlayTrack(track)} style={{ backgroundColor: "#110b21", borderRadius: "8px", padding: "1.25rem", cursor: "pointer", border: "1px solid #1f1a2e" }}>
                    <div style={{ width: "100%", height: "140px", borderRadius: "6px", marginBottom: "1rem", overflow: "hidden" }}>
                      <img src={track.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem" }}>{track.title}</h4>
                    <p style={{ margin: "0 0 0.5rem 0", color: "#9ca3af", fontSize: "0.85rem" }}>{track.artist}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ========================================== */}
      {/* 3. MUSIC PLAYER BAR (RIIL SEEKBAR & TIMER) */}
      {/* ========================================== */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, height: "90px", backgroundColor: "#0b0718",
        borderTop: "1px solid #1f1a2e", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2rem", zIndex: 100
      }}>
        <div style={{ width: "30%", display: "flex", alignItems: "center", gap: "1rem" }}>
          {activeTrack ? (
            <>
              <img src={activeTrack.img} alt="" style={{ width: "45px", height: "45px", borderRadius: "4px", objectFit: "cover" }} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: "bold", color: "#fff", fontSize: "0.95rem" }}>{activeTrack.title}</span>
                <span style={{ fontSize: "0.75rem", color: "#a78bfa" }}>{activeTrack.artist} • {activeTrack.quality}</span>
              </div>
            </>
          ) : (
            <span style={{ color: "#4b5563", fontSize: "0.9rem" }}>No track selected. Click a card to stream.</span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", width: "40%" }}>
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
            <span style={{ cursor: "pointer", fontSize: "1.2rem" }} onClick={() => handlePlayTrack(trackCatalog[0])}>⏮️</span>
            <span onClick={handleTogglePlay} style={{ cursor: "pointer", fontSize: "1.8rem", color: "#a78bfa" }}>
              {isPlaying ? "⏸️" : "▶️"}
            </span>
            <span onClick={handleSkip} style={{ cursor: "pointer", fontSize: "1.2rem" }} title="Skip Track">⏭️</span>
          </div>
          
          {/* 🛠️ UPDATE PROGRESS BAR: Dilengkapi dengan Menit Kiri, Menit Kanan, & Fitur Klik Lompat Detik */}
          <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "0.75rem" }}>
            {/* Waktu berjalan (Kiri) */}
            <span style={{ fontSize: "0.75rem", color: "#9ca3af", minWidth: "30px", textAlign: "right" }}>
              {formatTimeStr(currentTime)}
            </span>
            
            {/* Slider Bar Interaktif */}
            <input 
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleScrubbing}
              style={{
                flexGrow: 1,
                accentColor: "#7c3aed",
                cursor: "pointer",
                height: "4px",
                borderRadius: "2px",
                backgroundColor: "#1f1a2e"
              }}
            />
            
            {/* Waktu selesai (Kanan) */}
            <span style={{ fontSize: "0.75rem", color: "#9ca3af", minWidth: "30px", textAlign: "left" }}>
              {formatTimeStr(duration || (activeTrack ? 180 : 0))}
            </span>
          </div>
        </div>

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