import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { subscribe, getStatus } from "../services/api";

function Subscription() {
  const [loadingTier, setLoadingTier] = useState(null);
  const [result, setResult] = useState(null); // { success: boolean, message: string }

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const tiers = [
    {
      id: "Starter",
      name: "1. Starter (Free)",
      price: "Free",
      period: "",
      desc: "Perfect for discovering new music and trying the platform.",
      buttonText: "Start Free",
      popular: false,
      benefits: [
        "Access to the public music library.",
        "Standard audio quality (128 kbps).",
        "Create up to 3 playlists.",
        "Save tracks to Liked Songs.",
        "Browse trending charts and curated playlists.",
        "Basic listening history.",
        "Listen with occasional advertisements."
      ]
    },
    {
      id: "Plus",
      name: "2. Plus",
      price: "$4.99",
      period: "/ mo",
      desc: "Daily listeners who want an uninterrupted music experience.",
      buttonText: "Get Plus",
      popular: false,
      benefits: [
        "Everything in Starter, and:",
        "Ad-free listening.",
        "High-quality audio streaming (256 kbps).",
        "Unlimited playlist creation.",
        "Unlimited skips and track selection.",
        "Smart queue management.",
        "Full listening history and recently played.",
        "Cross-device playback (desktop + mobile + web)."
      ]
    },
    {
      id: "Premium",
      name: "3. Premium",
      price: "$8.99",
      period: "/ mo",
      desc: "Music enthusiasts who value sound quality and personalization.",
      buttonText: "Go Premium",
      popular: true,
      benefits: [
        "Everything in Plus, and:",
        "Lossless / Hi-Fi audio quality (up to 320 kbps).",
        "Offline downloads for albums and playlists.",
        "AI-powered personalized recommendations.",
        "Daily Mixes and mood-based playlists.",
        "Real-time synchronized lyrics.",
        "Early access to newly released tracks and curated collections.",
        "Unlimited device connections."
      ]
    },
    {
      id: "Studio",
      name: "4. Studio",
      price: "$14.99",
      period: "/ mo",
      desc: "Power users, playlist curators, and music communities.",
      buttonText: "Upgrade to Studio",
      popular: false,
      benefits: [
        "Everything in Premium, and:",
        "Collaborative playlists with friends.",
        "Shared listening sessions (Group Session).",
        "Playlist analytics and listening statistics.",
        "Advanced library organization (folders, tags, smart collections).",
        "Import playlists from other music services.",
        "Beta access to experimental features.",
        "Priority support and account recovery."
      ]
    }
  ];

  const handleSubscribe = async (selectedTier) => {
    setLoadingTier(selectedTier);
    setResult(null);

    if (!user || !user.userId || !user.email) {
      setResult({
        success: false,
        message: "⚠️ Sesi login tidak ditemukan / data user kosong. Silakan logout lalu login kembali sebelum memilih paket!"
      });
      setLoadingTier(null);
      return;
    }

    try {
      if (selectedTier === "Starter") {
        localStorage.setItem("active_subscription", "Starter");
        localStorage.setItem("subscription_status", "active");
        localStorage.removeItem(`subscription_expired_${user.email}`);

        // Update profile user ke Starter
        const updatedUser = { ...user, tier: "Starter", subStatus: "active" };
        localStorage.setItem("user", JSON.stringify(updatedUser));

        navigate("/content");
        window.location.reload();
        return;
      }

      let data;
      try {
        data = await subscribe(user.userId, user.email, selectedTier);
      } catch (awsError) {
        console.warn("AWS Terkunci, mengaktifkan mode bypass simulasi otomatis:", awsError);
        data = { success: true, isBackupMode: true };
      }

      if (data.success) {
        const successMsg = data.isBackupMode
          ? `🎉 [Demo Mode] Activation successful for ${selectedTier} tier!`
          : `Payment successful! Activating ${selectedTier} tier...`;

        setResult({ success: true, message: successMsg });

        // 1. Simpan status langganan utama
        localStorage.setItem("active_subscription", selectedTier);
        localStorage.setItem("subscription_status", "active");

        // 2. Set tanggal kedaluwarsa baru (+30 Hari) mengikat ke Email
        const expiredDate = new Date();
        expiredDate.setDate(expiredDate.getDate() + 30);
        localStorage.setItem(`subscription_expired_${user.email}`, expiredDate.toISOString());

        // 3. PAKSA UPDATE seluruh data objek user agar tier langsung berubah di tempat
        const updatedUser = {
          ...user,
          tier: selectedTier,
          subStatus: "active"
        };
        localStorage.setItem("user", JSON.stringify(updatedUser));

        // 4. Pindah ke dashboard dan segarkan halaman agar membaca data terbaru
        setTimeout(() => {
          navigate("/content");
          window.location.reload();
        }, 1000);

      } else {
        setResult({ success: false, message: "Payment failed (Simulated 30% failure). Please try again." });
      }
    } catch (err) {
      setResult({ success: false, message: err.message || "An error occurred." });
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div style={{ backgroundColor: "#090514", minHeight: "100vh", padding: "4rem 2rem", fontFamily: "sans-serif", color: "#f3f4f6" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", textAlign: "center" }}>

        <h2 style={{ fontSize: "2.5rem", fontWeight: "700", color: "#fff", marginBottom: "0.5rem" }}>
          Choose Your Listening Waves
        </h2>
        <p style={{ color: "#9ca3af", fontSize: "1.125rem", marginBottom: "3rem" }}>
          Unlock lossless audio, unlimited skips, and group jam sessions.
        </p>

        {result && (
          <div style={{
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "2rem",
            textAlign: "center",
            fontWeight: "600",
            backgroundColor: result.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
            color: result.success ? "#34d399" : "#f87171",
            border: result.success ? "1px solid #10b981" : "1px solid #ef4444"
          }}>
            {result.message}
          </div>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1.5rem",
          alignItems: "stretch"
        }}>
          {tiers.map((plan) => {
            const isThisTierLoading = loadingTier === plan.id;
            const isAnyTierLoading = loadingTier !== null;

            return (
              <div
                key={plan.id}
                style={{
                  backgroundColor: "#110b21",
                  borderRadius: "16px",
                  padding: "2rem",
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  border: plan.popular ? "2px solid #a78bfa" : "1px solid #1f1a2e",
                  position: "relative",
                  boxShadow: plan.popular ? "0 0 20px rgba(167, 139, 250, 0.2)" : "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                  transition: "transform 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                {plan.popular && (
                  <span style={{
                    position: "absolute",
                    top: "1rem",
                    right: "1rem",
                    backgroundColor: "#7c3aed",
                    color: "#ffffff",
                    padding: "0.25rem 0.75rem",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: "700",
                    letterSpacing: "0.5px"
                  }}>
                    RECOMMENDED
                  </span>
                )}

                <h3 style={{ fontSize: "1.35rem", fontWeight: "700", color: "#fff", marginBottom: "0.5rem" }}>
                  {plan.name}
                </h3>

                <div style={{ display: "flex", alignItems: "baseline", marginBottom: "0.25rem" }}>
                  <span style={{ fontSize: "2.25rem", fontWeight: "800", color: "#fff" }}>{plan.price}</span>
                  <span style={{ color: "#9ca3af", fontSize: "0.875rem", marginLeft: "0.25rem" }}>{plan.period}</span>
                </div>

                <p style={{ color: "#9ca3af", fontSize: "0.875rem", marginBottom: "1.5rem", minHeight: "40px", lineHeight: "1.4" }}>
                  {plan.desc}
                </p>

                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isAnyTierLoading}
                  style={{
                    width: "100%",
                    padding: "0.8rem",
                    borderRadius: "30px",
                    fontWeight: "bold",
                    cursor: isAnyTierLoading ? "not-allowed" : "pointer",
                    border: "none",
                    backgroundColor: isAnyTierLoading && !isThisTierLoading ? "#1f1933" : (plan.popular ? "#7c3aed" : "#2d2254"),
                    color: isAnyTierLoading && !isThisTierLoading ? "#6b7280" : "#ffffff",
                    marginBottom: "2rem",
                    fontSize: "0.95rem",
                    boxShadow: plan.popular && !isAnyTierLoading ? "0 4px 12px rgba(124, 58, 237, 0.3)" : "none"
                  }}
                >
                  {isThisTierLoading ? "Processing..." : plan.buttonText}
                </button>

                <div style={{ borderTop: "1px solid #1f1a2e", paddingTop: "1.5rem", flexGrow: 1 }}>
                  <p style={{ fontSize: "0.875rem", fontWeight: "600", color: "#a78bfa", marginBottom: "0.75rem" }}>
                    Includes:
                  </p>
                  <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
                    {plan.benefits.map((benefit, idx) => (
                      <li
                        key={idx}
                        style={{
                          fontSize: "0.85rem",
                          color: "#e5e7eb",
                          marginBottom: "0.6rem",
                          display: "flex",
                          alignItems: "flex-start",
                          lineHeight: "1.4"
                        }}
                      >
                        <span style={{ color: "#a78bfa", marginRight: "0.5rem", fontWeight: "bold" }}>✓</span>
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

export default Subscription;