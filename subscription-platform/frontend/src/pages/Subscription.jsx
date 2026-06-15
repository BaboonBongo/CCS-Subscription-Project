import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { subscribe, getStatus } from "../services/api";

function Subscription() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { success: boolean, message: string }
  
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // REVISI: Mengganti data konten benefit sesuai dengan screenshot tema streaming musik (image_90fee0.jpg)
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
      popular: true, // Most Popular / Recommended
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
    setLoading(true);
    setResult(null);

    try {
      // Menyesuaikan dengan ID baru "Starter" sebagai tier Free untuk bypass payment
      if (selectedTier === "Starter") {
        localStorage.setItem("active_subscription", "Starter");
        localStorage.setItem("subscription_status", "active");
        navigate("/content");
        return;
      }

      const data = await subscribe(user.userId, user.email, selectedTier);
      
      if (data.success) {
        setResult({ success: true, message: "Payment successful! Activating subscription..." });
        
        localStorage.setItem("active_subscription", selectedTier);
        localStorage.setItem("subscription_status", "active");

        // Sinkronisasi status user di background
        try {
          const freshStatus = await getStatus();
          localStorage.setItem("user", JSON.stringify({
            ...user,
            tier: selectedTier,
            subStatus: freshStatus.status
          }));
        } catch (e) {
          console.error("Could not refresh status", e);
        }

        setTimeout(() => {
          navigate("/content");
        }, 1000);

      } else {
        setResult({ success: false, message: "Payment failed (Simulated 30% failure). Please try again." });
      }
    } catch (err) {
      setResult({ success: false, message: err.message || "An error occurred." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#f8fafc", minHeight: "100vh", padding: "4rem 2rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", textAlign: "center" }}>
        
        <h2 style={{ fontSize: "2.5rem", fontWeight: "700", color: "#1e293b", marginBottom: "0.5rem" }}>
          Choose Your Listening Experience
        </h2>
        <p style={{ color: "#64748b", fontSize: "1.125rem", marginBottom: "3rem" }}>
          Choose the plan that fits your current needs.
        </p>

        {/* Notifikasi Status Pembayaran */}
        {result && (
          <div style={{ 
            padding: "1rem", 
            borderRadius: "0.5rem", 
            marginBottom: "2rem", 
            textAlign: "center",
            fontWeight: "500",
            backgroundColor: result.success ? "#d1fae5" : "#fee2e2",
            color: result.success ? "#065f46" : "#991b1b"
          }}>
            {result.message}
          </div>
        )}

        {/* Responsive Pricing Grid Layout 4 Kolom Putih Bersih ala image_9101c4.jpg */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", 
          gap: "1.5rem",
          alignItems: "stretch"
        }}>
          {tiers.map((plan) => (
            <div 
              key={plan.id}
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "0.75rem",
                padding: "2rem",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                border: plan.popular ? "2px solid #2563eb" : "1px solid #e2e8f0",
                position: "relative",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)"
              }}
            >
              {plan.popular && (
                <span style={{
                  position: "absolute",
                  top: "1rem",
                  right: "1rem",
                  backgroundColor: "#dbeafe",
                  color: "#2563eb",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "9999px",
                  fontSize: "0.75rem",
                  fontWeight: "600"
                }}>
                  Recommended
                </span>
              )}

              <h3 style={{ fontSize: "1.35rem", fontWeight: "700", color: "#0f172a", marginBottom: "0.5rem" }}>
                {plan.name}
              </h3>
              
              <div style={{ display: "flex", alignItems: "baseline", marginBottom: "0.25rem" }}>
                <span style={{ fontSize: "2.25rem", fontWeight: "800", color: "#0f172a" }}>{plan.price}</span>
                <span style={{ color: "#64748b", fontSize: "0.875rem", marginLeft: "0.25rem" }}>{plan.period}</span>
              </div>

              <p style={{ color: "#475569", fontSize: "0.875rem", marginBottom: "1.5rem", minHeight: "40px" }}>
                {plan.desc}
              </p>

              {/* Tombol Subscribe per Tier */}
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "0.375rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  border: "1px solid #2563eb",
                  backgroundColor: plan.popular ? "#2563eb" : "transparent",
                  color: plan.popular ? "#ffffff" : "#2563eb",
                  marginBottom: "2rem",
                  transition: "all 0.2s"
                }}
              >
                {loading ? "Processing..." : plan.buttonText}
              </button>

              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "1.5rem", flexGrow: 1 }}>
                <p style={{ fontSize: "0.875rem", fontWeight: "600", color: "#0f172a", marginBottom: "0.75rem" }}>
                  Includes:
                </p>
                <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
                  {plan.benefits.map((benefit, idx) => (
                    <li 
                      key={idx} 
                      style={{ 
                        fontSize: "0.875rem", 
                        color: "#475569", 
                        marginBottom: "0.5rem",
                        display: "flex",
                        alignItems: "flex-start"
                      }}
                    >
                      <span style={{ color: "#10b981", marginRight: "0.5rem", fontWeight: "bold" }}>✓</span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

export default Subscription;