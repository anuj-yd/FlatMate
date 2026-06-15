import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';

const Home = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState(['']); // Start with one empty email field
  
  const [editingGroup, setEditingGroup] = useState(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [deletingGroup, setDeletingGroup] = useState(null);
  
  const [addingMemberToGroup, setAddingMemberToGroup] = useState(null);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [stats, setStats] = useState({ totalExpenses: 0, pendingSettlements: 0 });

  const groupsSectionRef = React.useRef(null);

  useEffect(() => {
    fetchUserData();
    fetchGroups();
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await axios.get('http://localhost:3000/api/dashboard/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats', error);
    }
  };

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await axios.get('http://localhost:3000/api/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data.user);
    } catch (error) {
      console.error('Failed to fetch user data', error);
    }
  };

  const fetchGroups = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return navigate('/auth');
      
      const response = await axios.get('http://localhost:3000/api/groups', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroups(response.data);
    } catch (error) {
      console.error('Failed to fetch groups', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        navigate('/auth');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/auth');
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    
    const membersToInvite = newGroupMembers.filter(email => email.trim() !== '');

    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:3000/api/groups', 
        { name: newGroupName, membersToInvite }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewGroupName('');
      setNewGroupMembers(['']);
      setIsCreatingGroup(false);
      fetchGroups();
      fetchStats();
    } catch (error) {
      console.error('Failed to create group', error);
      alert('Failed to create group');
    }
  };

  const handleEditGroup = async (e) => {
    e.preventDefault();
    if (!editGroupName.trim() || !editingGroup) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:3000/api/groups/${editingGroup.id}`, { name: editGroupName }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditingGroup(null);
      setEditGroupName('');
      fetchGroups();
    } catch (error) {
      console.error('Failed to update group', error);
      alert('Failed to update group. Only the creator can edit.');
    }
  };

  const handleDeleteGroup = async () => {
    if (!deletingGroup) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:3000/api/groups/${deletingGroup.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeletingGroup(null);
      fetchGroups();
      fetchStats();
    } catch (error) {
      console.error('Failed to delete group', error);
      alert('Failed to delete group. Only the creator can delete.');
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberEmail.trim() || !addingMemberToGroup) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:3000/api/groups/${addingMemberToGroup.id}/members`, 
        { email: newMemberEmail }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAddingMemberToGroup(null);
      setNewMemberEmail('');
      alert('Member added successfully!');
      fetchGroups();
      fetchStats();
    } catch (error) {
      console.error('Failed to add member', error);
      alert(error.response?.data?.error || 'Failed to add member. Make sure you are the creator.');
    }
  };

  const totalExpenses = stats.totalExpenses;
  const pendingSettlements = stats.pendingSettlements;

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
          <h1>Welcome back, {user?.name?.split(' ')[0] || 'Roomie'}! 👋</h1>
          <p>Here's what's happening in your flats.</p>
          <button className="doodle-btn-main" onClick={() => setIsCreatingGroup(true)}>+ Create New Group</button>
        </header>

        {isCreatingGroup && (
          <div className="modal-overlay">
            <div className="doodle-modal">
              <h2>Create a Group 🏠</h2>
              <form onSubmit={handleCreateGroup}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: 'var(--ink)' }}>Group Name</label>
                  <input 
                    type="text" 
                    className="doodle-input" 
                    placeholder="E.g., Goa Trip, Flat 402" 
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    required 
                    autoFocus
                  />
                </div>

                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: 'var(--ink)' }}>Group Members (Emails)</label>
                  <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>Tip: Add your friends by their registered email addresses.</p>
                  
                  {newGroupMembers.map((email, index) => (
                    <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      <input 
                        type="email" 
                        className="doodle-input" 
                        placeholder="Email address (optional)" 
                        value={email}
                        onChange={(e) => {
                          const newMembers = [...newGroupMembers];
                          newMembers[index] = e.target.value;
                          setNewGroupMembers(newMembers);
                        }}
                      />
                      {newGroupMembers.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => {
                            const newMembers = newGroupMembers.filter((_, i) => i !== index);
                            setNewGroupMembers(newMembers);
                          }}
                          style={{ background: 'transparent', border: 'none', color: 'var(--bg-red)', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button 
                    type="button" 
                    onClick={() => setNewGroupMembers([...newGroupMembers, ''])}
                    style={{ background: 'transparent', border: 'none', color: '#008b8b', cursor: 'pointer', fontWeight: 'bold', padding: '0', fontSize: '15px' }}
                  >
                    + Add a person
                  </button>
                </div>

                <div className="modal-actions">
                  <button type="submit" className="doodle-btn-small confirm">Create</button>
                  <button type="button" className="doodle-btn-small cancel" onClick={() => setIsCreatingGroup(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {editingGroup && (
          <div className="modal-overlay">
            <div className="doodle-modal">
              <h2>Edit Group ✏️</h2>
              <form onSubmit={handleEditGroup}>
                <input 
                  type="text" 
                  className="doodle-input" 
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  required 
                  autoFocus
                />
                <div className="modal-actions">
                  <button type="submit" className="doodle-btn-small confirm">Save</button>
                  <button type="button" className="doodle-btn-small cancel" onClick={() => setEditingGroup(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {deletingGroup && (
          <div className="modal-overlay">
            <div className="doodle-modal delete-modal">
              <h2>Delete Group 🗑️</h2>
              <p>Are you sure you want to delete <strong>{deletingGroup.name}</strong>? This action cannot be undone.</p>
              <div className="modal-actions">
                <button type="button" className="doodle-btn-small confirm danger" onClick={handleDeleteGroup}>Yes, Delete</button>
                <button type="button" className="doodle-btn-small cancel" onClick={() => setDeletingGroup(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {addingMemberToGroup && (
          <div className="modal-overlay">
            <div className="doodle-modal">
              <h2>Add Flatmate ➕</h2>
              <p style={{ marginBottom: '15px', color: '#555' }}>Enter your flatmate's registered email address.</p>
              <form onSubmit={handleAddMember}>
                <input 
                  type="email" 
                  className="doodle-input" 
                  placeholder="E.g., roomie@example.com" 
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  required 
                  autoFocus
                />
                <div className="modal-actions">
                  <button type="submit" className="doodle-btn-small confirm">Add</button>
                  <button type="button" className="doodle-btn-small cancel" onClick={() => { setAddingMemberToGroup(null); setNewMemberEmail(''); }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="cards-grid">
          <div className="doodle-card card-yellow" onClick={() => groupsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}>
            <div className="card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
            <div className="card-info">
              <h3>Total Groups</h3>
              <p className="card-value">{groups.length}</p>
            </div>
          </div>

          <div className="doodle-card card-green">
            <div className="card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
            </div>
            <div className="card-info">
              <h3>Total Expenses</h3>
              <p className="card-value">₹ {totalExpenses}</p>
            </div>
          </div>

          <div className="doodle-card card-red">
            <div className="card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </div>
            <div className="card-info">
              <h3>Pending Settlements</h3>
              <p className="card-value">₹ {pendingSettlements}</p>
            </div>
          </div>
        </div>

        <div className="section-title" ref={groupsSectionRef}>
          <h2>Your Groups 🏠</h2>
        </div>
        
        {groups.length === 0 ? (
          <div className="empty-state">
            <p>You haven't created any groups yet! Click above to create one.</p>
          </div>
        ) : (
          <div className="groups-list">
            {groups.map((g) => (
              <div key={g.id} className="doodle-group-card">
                <div className="card-header">
                  <h3>{g.name}</h3>
                  <div className="card-actions">
                    <button className="action-btn add-member" onClick={() => setAddingMemberToGroup(g)} title="Add Member">➕</button>
                    <button className="action-btn edit" onClick={() => { setEditingGroup(g); setEditGroupName(g.name); }} title="Edit">✏️</button>
                    <button className="action-btn delete" onClick={() => setDeletingGroup(g)} title="Delete">🗑️</button>
                  </div>
                </div>
                <p>Created on {new Date(g.createdAt).toLocaleDateString()}</p>
                <p className="members-count">{g.members?.length || 1} Member(s)</p>
                <button className="doodle-btn-small" onClick={() => navigate(`/group/${g.id}`)}>Open Group</button>
              </div>
            ))}
          </div>
        )}
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
      margin-bottom: 30px;
    }
  }

  .doodle-btn-main {
    background-color: var(--bg-green);
    border: 3px solid var(--ink);
    padding: 12px 24px;
    font-size: 18px;
    font-weight: bold;
    font-family: inherit;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 4px 4px 0px var(--ink);
    transition: all 0.2s ease;
  }
  .doodle-btn-main:hover {
    transform: translate(-3px, -3px);
    box-shadow: 7px 7px 0px var(--ink);
  }
  .doodle-btn-main:active {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0px var(--ink);
  }

  .modal-overlay {
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    backdrop-filter: blur(3px);
  }

  .doodle-modal {
    background: #fff;
    border: 4px solid var(--ink);
    border-radius: 20px;
    padding: 30px;
    width: 90%;
    max-width: 400px;
    box-shadow: 10px 10px 0px var(--ink);
    
    h2 {
      margin-top: 0;
      font-size: 28px;
      color: var(--ink);
      text-shadow: 1px 1px 0px var(--bg-yellow);
      margin-bottom: 20px;
    }
  }

  .doodle-input {
    width: 100%;
    padding: 15px;
    font-size: 16px;
    font-family: inherit;
    border: 3px solid var(--ink);
    border-radius: 12px;
    box-sizing: border-box;
    margin-bottom: 20px;
    outline: none;
    transition: box-shadow 0.2s ease;
  }
  .doodle-input:focus {
    box-shadow: inset 4px 4px 0px rgba(0,0,0,0.1);
  }

  .modal-actions {
    display: flex;
    gap: 15px;
    justify-content: flex-end;
    
    .confirm { background-color: var(--bg-green); }
    .cancel { background-color: #f0f0f0; }
    .danger { background-color: var(--bg-red); color: white; border-color: var(--ink); }
  }

  .delete-modal p {
    font-size: 18px;
    color: #333;
    line-height: 1.5;
    margin-bottom: 25px;
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

  .section-title {
    margin-top: 50px;
    h2 {
      font-size: 32px;
      color: var(--ink);
      text-shadow: 2px 2px 0px var(--bg-yellow);
      margin-bottom: 20px;
    }
  }

  .empty-state {
    text-align: center;
    padding: 40px;
    border: 3px dashed var(--ink);
    border-radius: 20px;
    background: #fff9e6;
    p {
      font-size: 18px;
      color: #555;
      font-weight: 600;
    }
  }

  .groups-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 20px;
    margin-top: 20px;
  }

  .doodle-group-card {
    background: #fff;
    border: 3px solid var(--ink);
    border-radius: 16px;
    padding: 20px;
    box-shadow: 5px 5px 0px var(--ink);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    display: flex;
    flex-direction: column;
    align-items: flex-start;

    &:hover {
      transform: translateY(-3px) rotate(1deg);
      box-shadow: 8px 8px 0px var(--ink);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      width: 100%;
      margin-bottom: 10px;
    }

    h3 {
      margin: 0;
      font-size: 22px;
      color: var(--ink);
      flex: 1;
    }

    .card-actions {
      display: flex;
      gap: 5px;
    }

    .action-btn {
      background: none;
      border: 2px solid transparent;
      font-size: 16px;
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      transition: all 0.2s ease;
      
      &:hover {
        border-color: var(--ink);
        background: #f0f0f0;
      }
    }

    p {
      margin: 0 0 5px 0;
      color: #666;
      font-size: 14px;
    }
    
    .members-count {
      margin-bottom: 20px;
      font-weight: 600;
      color: var(--ink);
    }
    
    button.doodle-btn-small {
      margin-top: auto;
      width: 100%;
    }
  }
`;

export default Home;
