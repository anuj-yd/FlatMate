import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const RecentActivity = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivity();
  }, []);

  const fetchActivity = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(import.meta.env.VITE_API_URL + '/api/activity', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActivities(response.data);
    } catch (error) {
      console.error('Failed to fetch activity feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    return date.toLocaleString('default', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getIcon = (type) => {
    switch(type) {
      case 'expense':
        return '🍽️'; // Using a generic expense icon (like the fork/knife in screenshot)
      case 'settlement':
        return '💸';
      case 'group':
        return '👥';
      default:
        return '📝';
    }
  };

  return (
    <Container>
      <div className="layout-wrapper">
        
        {/* Left Column: Navigation */}
        <div className="left-sidebar">
          <div className="nav-links">
            <button className="nav-item" onClick={() => navigate('/')}>🏠 Dashboard</button>
            <button className="nav-item active">📊 Recent activity</button>
            <button className="nav-item" onClick={() => navigate('/')}>🧾 All expenses</button>
          </div>
        </div>

        {/* Center Column: Feed */}
        <div className="center-column">
          <div className="feed-header">
            Recent activity
          </div>

          <div className="feed-list">
            {loading ? (
              <div style={{ padding: '20px' }}>Loading...</div>
            ) : activities.length === 0 ? (
              <div style={{ padding: '20px', color: '#666' }}>No recent activity to show.</div>
            ) : (
              activities.map(activity => (
                <div key={activity.id} className="feed-item">
                  <div className="icon-wrapper">
                    {getIcon(activity.type)}
                  </div>
                  <div className="content-wrapper">
                    <div className="title" dangerouslySetInnerHTML={{ __html: formatTitle(activity.title) }} />
                    {activity.impactText && (
                      <div className={`impact ${activity.impactType}`}>
                        {activity.impactText}
                      </div>
                    )}
                    <div className="time">
                      {getRelativeTime(activity.date)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Container>
  );
};

// Helper to make quoted text bold like in the screenshot
const formatTitle = (title) => {
  return title
    .replace(/"([^"]+)"/g, '<strong>"$1"</strong>')
    .replace(/You/g, '<strong>You</strong>');
};

const Container = styled.div`
  width: 100vw;
  min-height: 100vh;
  background-color: #f7f7f7;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;

  .layout-wrapper {
    display: flex;
    max-width: 1000px;
    margin: 0 auto;
    min-height: 100vh;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
  }

  .left-sidebar {
    width: 250px;
    background: white;
    border-right: 1px solid #ddd;
    padding: 20px;
  }

  .nav-links {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .nav-item {
    background: none;
    border: none;
    text-align: left;
    padding: 10px;
    font-size: 16px;
    cursor: pointer;
    border-radius: 4px;
    color: #666;
    display: flex;
    align-items: center;
    gap: 10px;

    &:hover {
      background: #f0f0f0;
    }

    &.active {
      color: #5f9ea0;
      font-weight: bold;
      background: #e8f8f5;
      border-left: 4px solid #5f9ea0;
    }
  }

  .center-column {
    flex: 1;
    background: white;
    display: flex;
    flex-direction: column;
  }

  .feed-header {
    background-color: #f3f3f3;
    padding: 15px 20px;
    font-size: 24px;
    font-weight: bold;
    color: #333;
    border-bottom: 1px solid #ddd;
  }

  .feed-list {
    flex: 1;
    overflow-y: auto;
  }

  .feed-item {
    display: flex;
    padding: 20px;
    border-bottom: 1px solid #eee;
    align-items: flex-start;
    gap: 15px;

    &:hover {
      background-color: #fcfcfc;
    }
  }

  .icon-wrapper {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background-color: #d1f2eb;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    flex-shrink: 0;
  }

  .content-wrapper {
    flex: 1;

    .title {
      font-size: 16px;
      color: #333;
      margin-bottom: 4px;

      strong {
        font-weight: 600;
        color: #111;
      }
    }

    .impact {
      font-size: 14px;
      margin-bottom: 4px;

      &.positive {
        color: #5bc5a7; /* Teal-ish green matching screenshot */
      }
      &.negative {
        color: #ff6b6b;
      }
      &.neutral {
        color: #888;
      }
    }

    .time {
      font-size: 13px;
      color: #999;
    }
  }
`;

export default RecentActivity;

