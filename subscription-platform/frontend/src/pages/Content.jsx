import { useState, useEffect } from "react";
import { getContent, getStatus, accessContent } from "../services/api";

function Content() {
  const [contentList, setContentList] = useState([]);
  const [userStatus, setUserStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // For signed URL display
  const [activeContent, setActiveContent] = useState(null);
  const [accessError, setAccessError] = useState("");
  const [accessLoading, setAccessLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch both the content list and the user's fresh status
        const [contentData, statusData] = await Promise.all([
          getContent(),
          getStatus()
        ]);
        
        setContentList(contentData);
        setUserStatus(statusData);
        
        // Update local storage user just in case
        const localUser = JSON.parse(localStorage.getItem("user") || "{}");
        localStorage.setItem("user", JSON.stringify({
          ...localUser,
          tier: statusData.tier,
          subStatus: statusData.status
        }));
      } catch (err) {
        setError("Failed to load dashboard data. Are you logged in?");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleAccess = async (content) => {
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

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Content Library</h1>
        <p>Browse our catalog. Your access depends on your current tier and subscription status.</p>
      </div>

      <div className="status-bar">
        <div className="status-item">
          <span className="status-label">Account:</span>
          <span className="status-value">{userStatus?.email}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Tier:</span>
          <span className={`tier-badge ${userStatus?.tier}`}>{userStatus?.tier}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Status:</span>
          <span className={`status-value ${userStatus?.status}`}>
            {userStatus?.status ? userStatus.status.toUpperCase() : "NONE"}
          </span>
        </div>
      </div>

      {accessError && (
        <div className="error-message" style={{ marginBottom: '2rem' }}>
          <strong>Access Denied:</strong> {accessError}
        </div>
      )}

      {activeContent && (
        <div className="signed-url-display" style={{ marginBottom: '2rem' }}>
          <h3>✅ Access Granted: {activeContent.title}</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            A temporary signed URL has been generated. It expires in 30 seconds.
          </p>
          <div className="url-text">
            {activeContent.url}
          </div>
          <p style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
            <a href={activeContent.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)' }}>
              Open Media in New Tab ↗
            </a>
          </p>
        </div>
      )}

      <div className="content-grid">
        {contentList.map((item) => (
          <div 
            key={item.contentId} 
            className="content-card"
            onClick={() => handleAccess(item)}
          >
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <span className={`tier-badge ${item.requiredTier}`}>
                {item.requiredTier}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {item.type}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Content;
