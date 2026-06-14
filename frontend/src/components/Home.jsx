import React from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const Home = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/auth');
  };

  const dummyData = {
    totalGroups: 4,
    totalExpenses: '₹ 12,450',
    pendingSettlements: '₹ 3,200',
  };

  return (
    <StyledDashboard>
      <nav className="navbar">
        <div className="logo">
          <span>FlateMate</span> ✨
        </div>
        <button className="doodle-btn-small" onClick={handleLogout}>Logout</button>
      </nav>

      <main className="dashboard-content">
        <header className="greeting">
          <h1>Welcome back, Roomie! 👋</h1>
          <p>Here's what's happening in your flats.</p>
        </header>

        <div className="cards-grid">
          <div className="doodle-card card-yellow">
            <div className="card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
            <div className="card-info">
              <h3>Total Groups</h3>
              <p className="card-value">{dummyData.totalGroups}</p>
            </div>
          </div>

          <div className="doodle-card card-green">
            <div className="card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
            <div className="card-info">
              <h3>Total Expenses</h3>
              <p className="card-value">{dummyData.totalExpenses}</p>
            </div>
          </div>

          <div className="doodle-card card-red">
            <div className="card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <div className="card-info">
              <h3>Pending Settlements</h3>
              <p className="card-value">{dummyData.pendingSettlements}</p>
            </div>
          </div>
        </div>
      </main>
    </StyledDashboard>
  );
}

const StyledDashboard = styled.div`
  min-height: 100vh;
  width: 100vw;
  position: absolute;
  top: 0;
  left: 0;
  margin: 0;
  background-color: #ffffff;
  background-image: radial-gradient(rgba(12, 12, 12, 0.171) 2px, transparent 0);
  background-size: 30px 30px;
  background-position: -5px -5px;
  font-family: "Comic Sans MS", "Chalkboard SE", "Marker Felt", "Gochi Hand", sans-serif;
  color: #323232;
  overflow-x: hidden;

  /* Global variables */
  --ink: #323232;
  --bg-yellow: #ffe66d;
  --bg-green: #06d6a0;
  --bg-red: #ff6b6b;

  .navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 40px;
    background: #ffffff;
    border-bottom: 3px solid var(--ink);
    box-shadow: 0px 4px 0px var(--ink);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .logo {
    font-size: 28px;
    font-weight: bold;
    color: var(--bg-red);
    text-shadow: 1px 1px 0px var(--ink);
    span {
      color: var(--ink);
    }
  }

  .doodle-btn-small {
    background-color: var(--bg-yellow);
    border: 2px solid var(--ink);
    padding: 8px 16px;
    font-size: 16px;
    font-weight: 600;
    font-family: inherit;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 3px 3px 0px var(--ink);
    transition: all 0.2s ease;
  }
  .doodle-btn-small:hover {
    transform: translate(-2px, -2px);
    box-shadow: 5px 5px 0px var(--ink);
  }
  .doodle-btn-small:active {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0px var(--ink);
  }

  .dashboard-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 20px;
  }

  .greeting {
    margin-bottom: 40px;
    text-align: center;
    h1 {
      font-size: 42px;
      margin-bottom: 10px;
      color: var(--ink);
      text-shadow: 2px 2px 0px var(--bg-yellow);
    }
    p {
      font-size: 20px;
      color: #555;
      font-weight: 600;
    }
  }

  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 30px;
    padding: 20px;
  }

  .doodle-card {
    display: flex;
    align-items: center;
    padding: 30px;
    background: #fff;
    border: 3px solid var(--ink);
    border-radius: 20px;
    box-shadow: 8px 8px 0px var(--ink);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    cursor: pointer;
  }
  .doodle-card:hover {
    transform: translateY(-5px) rotate(-1deg);
    box-shadow: 12px 12px 0px var(--ink);
  }

  .card-yellow { background-color: #fff9e6; }
  .card-yellow .card-icon { background-color: var(--bg-yellow); }

  .card-green { background-color: #e6fcf5; }
  .card-green .card-icon { background-color: var(--bg-green); }

  .card-red { background-color: #ffe6e6; }
  .card-red .card-icon { background-color: var(--bg-red); }

  .card-icon {
    width: 60px;
    height: 60px;
    border: 3px solid var(--ink);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 20px;
    box-shadow: 4px 4px 0px var(--ink);
  }
  .card-icon svg {
    width: 30px;
    height: 30px;
    color: var(--ink);
  }

  .card-info h3 {
    margin: 0;
    font-size: 18px;
    color: #555;
    font-weight: 600;
  }

  .card-value {
    margin: 5px 0 0 0;
    font-size: 36px;
    font-weight: bold;
    color: var(--ink);
    letter-spacing: 1px;
  }

  @media (max-width: 768px) {
    .greeting h1 {
      font-size: 32px;
    }
    .cards-grid {
      grid-template-columns: 1fr;
    }
  }
`;

export default Home;
