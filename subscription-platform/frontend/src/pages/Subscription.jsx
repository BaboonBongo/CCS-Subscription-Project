import { useState, useEffect } from "react";
import { subscribe, getStatus } from "../services/api";

function Subscription() {
  const [tier, setTier] = useState("basic");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { success: boolean, message: string }
  const [count, setCount] = useState(null);
  
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const handleSubscribe = async () => {
    setLoading(true);
    setResult(null);
    setCount(null);

    try {
      const data = await subscribe(user.userId, user.email, tier);
      
      if (data.success) {
        setResult({ success: true, message: "Payment successful! Subscription activated." });
        
        // Start 5 second countdown
        setCount(5);
        
        // Refresh local user state so UI shows active
        try {
          const freshStatus = await getStatus();
          localStorage.setItem("user", JSON.stringify({
            ...user,
            tier: freshStatus.tier,
            subStatus: freshStatus.status
          }));
        } catch (e) {
          console.error("Could not refresh status", e);
        }

      } else {
        setResult({ success: false, message: "Payment failed (Simulated 30% failure)." });
      }
    } catch (err) {
      setResult({ success: false, message: err.message || "An error occurred." });
    } finally {
      setLoading(false);
    }
  };

  // Handle countdown timer
  useEffect(() => {
    if (count === null || count <= 0) return;

    const timer = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Subscription just expired, refresh status in background
          getStatus().then(freshStatus => {
            localStorage.setItem("user", JSON.stringify({
              ...user,
              tier: freshStatus.tier,
              subStatus: freshStatus.status
            }));
          }).catch(console.error);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [count]);

  return (
    <div className="page-container">
      <div className="subscription-container">
        <div className="subscription-card">
          <h2>Upgrade Your Plan</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
            Experience full access. Subscriptions last exactly 5 seconds for demonstration purposes.
          </p>

          <div className="form-group" style={{ textAlign: "left" }}>
            <label>Select Tier</label>
            <select value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="basic">Basic Tier</option>
              <option value="standard">Standard Tier</option>
              <option value="premium">Premium Tier</option>
            </select>
          </div>

          <button 
            className={`btn btn-full ${tier === 'premium' ? 'btn-primary' : 'btn-success'}`}
            onClick={handleSubscribe} 
            disabled={loading || (count !== null && count > 0)}
            style={{ marginTop: "1rem" }}
          >
            {loading ? "Processing..." : `Subscribe ${tier.charAt(0).toUpperCase() + tier.slice(1)}`}
          </button>

          {result && (
            <div className={`result-message ${result.success ? "success" : "failure"}`}>
              {result.message}
            </div>
          )}

          {count !== null && (
            <div style={{ marginTop: "2rem" }}>
              <div className="countdown-label">
                {count > 0 ? "Subscription Expires In" : "Subscription Expired"}
              </div>
              <div className="countdown">
                {count > 0 ? `${count}s` : "0s"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Subscription;
