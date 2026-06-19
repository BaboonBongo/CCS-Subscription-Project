import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getStatus } from "../services/api";

function Content() {
  const [userStatus, setUserStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activeTrack, setActiveTrack] = useState(null);
  const [playlists, setPlaylists] = useState(["My Top Vibes", "Chill Study"]);
  const [skipCount, setSkipCount] = useState(0);
  const [accessError, setAccessError] = useState("");

  const [activeTab, setActiveTab] = useState("home");
  const [searchQuery, setSearchQuery] = useState("");

  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // REVISI LOGIKA: Mengambil data playlist awal dari localStorage jika ada
  const [playlistContents, setPlaylistContents] = useState({
    "My Top Vibes": [],
    "Chill Study": []
  });

  // REVISI LOGIKA: Mengambil data library awal dari localStorage jika ada
  const [libraryTracks, setLibraryTracks] = useState([]);

  const lastTrackIdRef = useRef(null);
  const navigate = useNavigate();

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
        const userObj = JSON.parse(localStorage.getItem("user") || "{}");
        const userEmail = userObj.email || "user@soundstream.com";

        // Membaca status paling baru dari database local storage
        let savedTier = localStorage.getItem("active_subscription") || userObj.tier || "Starter";
        let savedStatus = localStorage.getItem("subscription_status") || "active";

        const expiredStr = localStorage.getItem(`subscription_expired_${userEmail}`);

        // Mekanisme auto-lock jika 30 hari sudah habis terlewati
        if (savedTier !== "Starter" && expiredStr) {
          const now = new Date();
          const expiredDate = new Date(expiredStr);

          if (now >= expiredDate) {
            savedTier = "Starter";
            savedStatus = "active";
            localStorage.setItem("active_subscription", "Starter");
            localStorage.setItem("subscription_status", "active");
            localStorage.removeItem(`subscription_expired_${userEmail}`);

            localStorage.setItem("user", JSON.stringify({
              ...userObj,
              tier: "Starter",
              subStatus: "active"
            }));
          }
        }

        setUserStatus({
          email: userEmail,
          tier: savedTier,
          status: savedStatus
        });

        // REVISI LOGIKA: Muat data Library & Playlist milik spesifik email ini dari localStorage saat app dibuka
        const savedLibrary = localStorage.getItem(`library_${userEmail}`);
        if (savedLibrary) setLibraryTracks(JSON.parse(savedLibrary));

        const savedPlaylistContents = localStorage.getItem(`playlist_contents_${userEmail}`);
        if (savedPlaylistContents) {
          const parsedContents = JSON.parse(savedPlaylistContents);
          setPlaylistContents(parsedContents);
          setPlaylists(Object.keys(parsedContents));
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    initDashboard();
  }, []);

  // REVISI LOGIKA: Efek otomatis menyimpan data ke LocalStorage setiap kali ada perubahan data Library
  useEffect(() => {
    if (userStatus?.email) {
      localStorage.setItem(`library_${userStatus.email}`, JSON.stringify(libraryTracks));
    }
  }, [libraryTracks, userStatus?.email]);

  // REVISI LOGIKA: Efek otomatis menyimpan data ke LocalStorage setiap kali ada perubahan data isi Playlist
  useEffect(() => {
    if (userStatus?.email) {
      localStorage.setItem(`playlist_contents_${userStatus.email}`, JSON.stringify(playlistContents));
    }
  }, [playlistContents, userStatus?.email]);

  // Menghitung sisa hari kalender yang mengikat ke Email Akun
  const getRemainingDays = () => {
    const userEmail = userStatus?.email || "user@soundstream.com";
    const expiredStr = localStorage.getItem(`subscription_expired_${userEmail}`);
    if (!expiredStr) return "30 Days";

    const diffTime = new Date(expiredStr) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? `${diffDays} Days` : "0 Days";
  };

  useEffect(() => {
    if (activeTrack) {
      if (lastTrackIdRef.current !== activeTrack.id) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        audioRef.current = new Audio(activeTrack.src);
        lastTrackIdRef.current = activeTrack.id;

        audioRef.current.addEventListener("loadedmetadata", () => {
          setDuration(audioRef.current.duration);
        });

        audioRef.current.addEventListener("timeupdate", () => {
          setCurrentTime(audioRef.current.currentTime);
        });

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
  };

  const handleScrubbing = (e) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }
  };

  const formatTimeStr = (secs) => {
    if (isNaN(secs)) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

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

  const handleAddToPlaylistAction = (e, track) => {
    e.stopPropagation();
    const options = playlists.map((p, i) => `${i + 1}. ${p}`).join("\n");
    const choice = prompt(`Ketik Angka Nomor Playlist untuk memasukkan lagu "${track.title}":\n\n${options}`);
    const chosenPlaylist = playlists[parseInt(choice) - 1];

    if (chosenPlaylist) {
      if (playlistContents[chosenPlaylist].some(t => t.id === track.id)) {
        return;
      }
      setPlaylistContents(prev => ({
        ...prev,
        [chosenPlaylist]: [...prev[chosenPlaylist], track]
      }));
    }
  };

  const handleAddToLibraryAction = (e, track) => {
    e.stopPropagation();
    if (libraryTracks.some(t => t.id === track.id)) {
      setAccessError(`Lagu "${track.title}" sudah ada di dalam Library Anda.`);
      return;
    }
    setLibraryTracks(prev => [...prev, track]);
  };

  const filteredCatalog = trackCatalog.filter(track =>
    track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div style={{ color: "#a78bfa", textAlign: "center", marginTop: "20%" }}>Loading SoundStream Engine...</div>;

  return (
    <div style={{ backgroundColor: "#090514", color: "#f3f4f6", minHeight: "100vh", display: "flex", fontFamily: "sans-serif" }}>

      {/* 1. SIDEBAR KIRI */}
      <div style={{ width: "260px", backgroundColor: "#020006", padding: "1.5rem", display: "flex", flexDirection: "column", borderRight: "1px solid #1f1a2e" }}>
        <h2 style={{ color: "#a78bfa", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.5rem", marginBottom: "2rem" }}>
          🎵 SoundStream
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
          <div onClick={() => setActiveTab("home")} style={{ cursor: "pointer", color: activeTab === "home" ? "#a78bfa" : "#9ca3af", fontWeight: activeTab === "home" ? "bold" : "normal" }}>🏠 Home</div>
          <div onClick={() => setActiveTab("search")} style={{ cursor: "pointer", color: activeTab === "search" ? "#a78bfa" : "#9ca3af", fontWeight: activeTab === "search" ? "bold" : "normal" }}>🔍 Search</div>
          <div onClick={() => setActiveTab("library")} style={{ cursor: "pointer", color: activeTab === "library" ? "#a78bfa" : "#9ca3af", fontWeight: activeTab === "library" ? "bold" : "normal" }}>📚 Your Library ({libraryTracks.length})</div>
        </div>

        <hr style={{ borderColor: "#1f1a2e", marginBottom: "1.5rem" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#9ca3af", fontWeight: "600" }}>MY PLAYLISTS ({playlists.length})</span>
          <button onClick={handleCreatePlaylist} style={{ background: "#7c3aed", border: "none", color: "#fff", borderRadius: "50%", width: "24px", height: "24px", cursor: "pointer", fontWeight: "bold" }}>+</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {playlists.map((p, i) => (
            <div key={i} onClick={() => setActiveTab(`playlist-${p}`)} style={{ color: activeTab === `playlist-${p}` ? "#a78bfa" : "#e5e7eb", fontSize: "0.85rem", padding: "0.25rem 0.5rem", cursor: "pointer", fontWeight: activeTab === `playlist-${p}` ? "bold" : "normal", backgroundColor: activeTab === `playlist-${p}` ? "rgba(167,139,250,0.1)" : "transparent", borderRadius: "4px" }}>
              • {p} ({playlistContents[p]?.length || 0})
            </div>
          ))}
        </div>
      </div>

      {/* 2. AREA UTAMA / DASHBOARD */}
      <div style={{ flexGrow: 1, padding: "2rem", display: "flex", flexDirection: "column", paddingBottom: "100px" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#120c24", padding: "1rem 1.5rem", borderRadius: "8px", marginBottom: "2rem" }}>
          <div>
            <span style={{ marginRight: "1.5rem", color: "#9ca3af" }}>User: <strong style={{ color: "#fff" }}>{userStatus?.email}</strong></span>
            <span style={{ marginRight: "1.5rem" }}>Tier: <span style={{ backgroundColor: "#7c3aed", padding: "0.25rem 0.6rem", borderRadius: "4px", fontSize: "0.8rem", fontWeight: "bold" }}>{userStatus?.tier?.toUpperCase()}</span></span>
            <span>Status: <span style={{ color: userStatus?.status === "active" ? "#10b981" : "#ef4444" }}>{userStatus?.status?.toUpperCase()}</span></span>

            {userStatus?.tier && userStatus?.tier !== "Starter" && (
              <span style={{ marginLeft: "1.5rem", color: "#9ca3af" }}>Time Remaining: <strong style={{ color: "#fff" }}>{getRemainingDays()}</strong></span>
            )}
          </div>

          <div style={{ display: "flex", gap: "1rem" }}>
            <button onClick={() => navigate("/subscription")} style={{ backgroundColor: "#10b981", border: "none", color: "#fff", padding: "0.5rem 1rem", borderRadius: "20px", fontWeight: "bold", cursor: "pointer" }}>
              🚀 Change / Upgrade Plan
            </button>

            <button
              onClick={() => {
                const userEmail = userStatus?.email || "user@soundstream.com";
                localStorage.removeItem("active_subscription");
                localStorage.removeItem("subscription_status");
                localStorage.removeItem(`subscription_expired_${userEmail}`);

                // REVISI LOGIKA: Saat Reset Demo, hapus juga library & playlist khusus akun ini
                localStorage.removeItem(`library_${userEmail}`);
                localStorage.removeItem(`playlist_contents_${userEmail}`);

                const userObj = JSON.parse(localStorage.getItem("user") || "{}");
                localStorage.setItem("user", JSON.stringify({ ...userObj, tier: "Starter" }));
                window.location.reload();
              }}
              style={{ background: "none", border: "1px solid #ef4444", color: "#ef4444", padding: "0.5rem 1rem", borderRadius: "20px", cursor: "pointer" }}
            >
              Reset Demo
            </button>
          </div>
        </div>

        {accessError && (
          <div style={{ backgroundColor: "#fee2e2", color: "#b91c1c", padding: "1rem", borderRadius: "6px", marginBottom: "1.5rem", fontWeight: "600" }}>
            🛑 {accessError}
          </div>
        )}

        {/* PANEL HOME */}
        {activeTab === "home" && (
          <div>
            <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Trending Charts & Curated Tracks</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1.5rem" }}>
              {trackCatalog.map((track) => (
                <div key={track.id} onClick={() => handlePlayTrack(track)} style={{ backgroundColor: "#110b21", borderRadius: "8px", padding: "1.25rem", cursor: "pointer", border: activeTrack?.id === track.id ? "2px solid #a78bfa" : "1px solid #1f1a2e", transition: "transform 0.2s", position: "relative" }} onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.03)"} onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}>
                  <div style={{ width: "100%", height: "140px", borderRadius: "6px", marginBottom: "1rem", overflow: "hidden" }}>
                    <img src={track.img} alt={track.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.title}</h4>
                  <p style={{ margin: "0 0 1rem 0", color: "#9ca3af", fontSize: "0.85rem" }}>{track.artist}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "4px", backgroundColor: "#2e1c5b", color: "#c084fc", textAlign: "center" }}>{track.requiredTier} Only</span>
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      <button onClick={(e) => handleAddToPlaylistAction(e, track)} style={{ flex: 1, backgroundColor: "transparent", border: "1px solid #7c3aed", color: "#a78bfa", borderRadius: "4px", padding: "0.2rem 0.4rem", fontSize: "0.75rem", cursor: "pointer" }}>➕ Playlist</button>
                      <button onClick={(e) => handleAddToLibraryAction(e, track)} style={{ flex: 1, backgroundColor: "transparent", border: "1px solid #10b981", color: "#34d399", borderRadius: "4px", padding: "0.2rem 0.4rem", fontSize: "0.75rem", cursor: "pointer" }}>➕ Library</button>
                    </div>
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
            <input type="text" placeholder="Search by song name or artist..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: "100%", maxWidth: "400px", padding: "0.75rem 1rem", borderRadius: "8px", backgroundColor: "#110b21", border: "1px solid #1f1a2e", color: "#fff", marginBottom: "2rem" }} />
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
            </div>
          </div>
        )}

        {/* PANEL LIBRARY */}
        {activeTab === "library" && (
          <div>
            <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>📚 Your Music Library</h3>
            {libraryTracks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem 0" }}>
                <span style={{ fontSize: "3rem" }}>📚</span>
                <p style={{ fontSize: "1.1rem", marginTop: "1rem", color: "#9ca3af" }}>Library Anda masih kosong. Tambahkan lagu dari halaman Home!</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1.5rem" }}>
                {libraryTracks.map((track) => (
                  <div key={track.id} onClick={() => handlePlayTrack(track)} style={{ backgroundColor: "#110b21", borderRadius: "8px", padding: "1.25rem", cursor: "pointer", border: activeTrack?.id === track.id ? "2px solid #a78bfa" : "1px solid #1f1a2e" }}>
                    <div style={{ width: "100%", height: "140px", borderRadius: "6px", marginBottom: "1rem", overflow: "hidden" }}>
                      <img src={track.img} alt={track.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem" }}>{track.title}</h4>
                    <p style={{ margin: "0 0 1rem 0", color: "#9ca3af", fontSize: "0.85rem" }}>{track.artist}</p>
                    <button onClick={(e) => handleAddToPlaylistAction(e, track)} style={{ width: "100%", backgroundColor: "transparent", border: "1px solid #7c3aed", color: "#a78bfa", borderRadius: "4px", padding: "0.3rem", fontSize: "0.8rem", cursor: "pointer" }}>➕ Playlist</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PANEL PLAYLIST DETAIL DYNAMIC */}
        {activeTab.startsWith("playlist-") && (() => {
          const currentPlaylistName = activeTab.replace("playlist-", "");
          const tracksInPlaylist = playlistContents[currentPlaylistName] || [];
          return (
            <div>
              <h3 style={{ fontSize: "1.5rem", marginBottom: "0.5rem", color: "#a78bfa" }}>📂 Playlist: {currentPlaylistName}</h3>
              <p style={{ color: "#9ca3af", fontSize: "0.9rem", marginBottom: "2rem" }}>Total Lagu: {tracksInPlaylist.length}</p>

              {tracksInPlaylist.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 0", backgroundColor: "#110b21", borderRadius: "8px" }}>
                  <span style={{ fontSize: "2.5rem" }}>📭</span>
                  <p style={{ fontSize: "1rem", marginTop: "1rem", color: "#9ca3af" }}>Belum ada lagu di playlist ini. Masukkan lagu dari halaman Home!</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1.5rem" }}>
                  {tracksInPlaylist.map((track) => (
                    <div key={track.id} onClick={() => handlePlayTrack(track)} style={{ backgroundColor: "#110b21", borderRadius: "8px", padding: "1.25rem", cursor: "pointer", border: activeTrack?.id === track.id ? "2px solid #a78bfa" : "1px solid #1f1a2e" }}>
                      <div style={{ width: "100%", height: "140px", borderRadius: "6px", marginBottom: "1rem", overflow: "hidden" }}>
                        <img src={track.img} alt={track.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                      <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem" }}>{track.title}</h4>
                      <p style={{ margin: "0 0 1rem 0", color: "#9ca3af", fontSize: "0.85rem" }}>{track.artist}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

      </div>

      {/* MUSIC PLAYER BAR */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "90px", backgroundColor: "#0b0718", borderTop: "1px solid #1f1a2e", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2rem", zIndex: 100 }}>
        <div style={{ width: "30%", display: "flex", alignItems: "center", gap: "1rem" }}>
          {activeTrack && (
            <>
              <img src={activeTrack.img} alt="" style={{ width: "45px", height: "45px", borderRadius: "4px", objectFit: "cover" }} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: "bold", color: "#fff", fontSize: "0.95rem" }}>{activeTrack.title}</span>
                <span style={{ fontSize: "0.75rem", color: "#a78bfa" }}>{activeTrack.artist} • {activeTrack.quality}</span>
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem", width: "40%" }}>
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
            <span style={{ cursor: "pointer", fontSize: "1.2rem" }}>⏮️</span>
            <span onClick={handleTogglePlay} style={{ cursor: "pointer", fontSize: "1.8rem", color: "#a78bfa" }}>{isPlaying ? "⏸️" : "▶️"}</span>
            <span onClick={handleSkip} style={{ cursor: "pointer", fontSize: "1.2rem" }}>⏭️</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{formatTimeStr(currentTime)}</span>
            <input type="range" min="0" max={duration || 100} value={currentTime} onChange={handleScrubbing} style={{ flexGrow: 1, accentColor: "#7c3aed", height: "4px" }} />
            <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{formatTimeStr(duration)}</span>
          </div>
        </div>

        <div style={{ width: "30%", textAlign: "right", fontSize: "0.85rem", color: "#9ca3af" }}>
          <div>Simulated Skips Done: <strong style={{ color: "#fff" }}>{skipCount}</strong></div>
        </div>
      </div>

    </div>
  );
}

export default Content;