import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import ExpenseFormModal from './ExpenseFormModal';
import InteractiveCSVWizard from './InteractiveCSVWizard';
import MemberResolutionWizard from './MemberResolutionWizard';
import BalanceDetailsModal from './BalanceDetailsModal';
import SettlementFormModal from './SettlementFormModal';

const GroupDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [allGroups, setAllGroups] = useState([]);
  const [membersData, setMembersData] = useState({ currentMembers: [], formerMembers: [], membershipHistory: [] });
  const [loading, setLoading] = useState(true);
  
  const [removingMember, setRemovingMember] = useState(null);
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isMemberResolutionModalOpen, setIsMemberResolutionModalOpen] = useState(false);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [selectedUserForBalance, setSelectedUserForBalance] = useState(null);
  const [activeTab, setActiveTab] = useState('expenses'); // 'expenses' or 'settlements'

  const fetchGroupAndMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const groupRes = await axios.get(`http://localhost:3000/api/groups/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGroup(groupRes.data);
      
      const allGroupsRes = await axios.get(`http://localhost:3000/api/groups`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllGroups(allGroupsRes.data);

      const membersRes = await axios.get(`http://localhost:3000/api/groups/${id}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMembersData(membersRes.data);

      const expensesRes = await axios.get(`http://localhost:3000/api/groups/${id}/expenses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExpenses(expensesRes.data);

      const balancesRes = await axios.get(`http://localhost:3000/api/groups/${id}/balances`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBalances(balancesRes.data.members);

      const settlementsRes = await axios.get(`http://localhost:3000/api/groups/${id}/settlements`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettlements(settlementsRes.data);
    } catch (error) {
      console.error('Error fetching group details:', error);
      alert('Failed to load group or access denied.');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchGroupAndMembers();
  }, [id]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberEmail.trim()) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:3000/api/groups/${id}/members`, 
        { email: newMemberEmail }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAddingMember(false);
      setNewMemberEmail('');
      fetchGroupAndMembers();
    } catch (error) {
      console.error('Failed to add member', error);
      alert(error.response?.data?.error || 'Failed to add member.');
    }
  };

  const handleRemoveMember = async () => {
    if (!removingMember) return;
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`http://localhost:3000/api/groups/${id}/members/${removingMember.id}/remove`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRemovingMember(null);
      fetchGroupAndMembers();
    } catch (error) {
      console.error('Failed to remove member', error);
      alert(error.response?.data?.error || 'Failed to remove member.');
    }
  };

  const calculateBalances = () => {
    // This is now handled by the backend API.
    return [];
  };

  const getPersonalSummary = (expense) => {
    const currentUserId = parseInt(localStorage.getItem('userId')) || 0;
    const isPayer = expense.payerId === currentUserId;
    const participant = expense.participants.find(p => p.userId === currentUserId);
    
    let personalShare = 0;
    if (participant) {
      if (expense.splitType === 'EQUAL') personalShare = expense.amount / expense.participants.length;
      else if (expense.splitType === 'EXACT') personalShare = participant.shareValue;
      else if (expense.splitType === 'PERCENTAGE') personalShare = (expense.amount * participant.shareValue) / 100;
    }

    if (isPayer && personalShare > 0) {
      const lent = expense.amount - personalShare;
      return { type: 'lent', paid: expense.amount, lent: lent > 0 ? lent : 0 };
    } else if (isPayer) {
      return { type: 'lent', paid: expense.amount, lent: expense.amount };
    } else if (personalShare > 0) {
      return { type: 'borrowed', borrowed: personalShare };
    }
    return { type: 'not_involved' };
  };

  const handleDeleteSettlement = async (settlementId) => {
    if (!window.confirm('Are you sure you want to delete this settlement?')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:3000/api/settlements/${settlementId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchGroupAndMembers();
    } catch (error) {
      console.error('Failed to delete settlement', error);
      alert('Failed to delete settlement.');
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;
  if (!group) return null;

  return (
    <Container>
      <div className="layout-wrapper">
        
        {/* Left Column: Navigation & Groups */}
        <div className="left-sidebar">
          <div className="nav-links">
            <button className="nav-item" onClick={() => navigate('/')}>🏠 Dashboard</button>
            <button className="nav-item" onClick={() => navigate('/activity')}>📊 Recent activity</button>
            <button className="nav-item">🧾 All expenses</button>
          </div>

          <div className="sidebar-section">
            <div className="section-header">
              <span>GROUPS</span>
              <button onClick={() => navigate('/')} className="add-link">+ add</button>
            </div>
            <div className="group-list">
              {allGroups.map(g => (
                <button key={g.id} className={`group-item ${g.id === parseInt(id) ? 'active' : ''}`} onClick={() => navigate(`/group/${g.id}`)}>
                  🏷️ {g.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Middle Column: Expenses */}
        <div className="main-content">
          <div className="main-header">
            <div className="group-info">
              <div className="group-icon">✈️</div>
              <div>
                <h1 style={{ margin: 0, color: 'var(--ink)' }}>{group.name}</h1>
                <span style={{ color: '#666', fontWeight: 'bold' }}>{membersData.currentMembers.length} people</span>
              </div>
            </div>
            <div className="header-actions">
              <button className="doodle-btn-small" style={{ background: '#ff7b54', color: 'white' }} onClick={() => setIsExpenseModalOpen(true)}>Add an expense</button>
              <button className="doodle-btn-small" style={{ background: '#5f9ea0', color: 'white' }} onClick={() => setIsMemberResolutionModalOpen(true)}>Import CSV</button>
              <button className="doodle-btn-small" style={{ background: '#2ecc71', color: 'white' }} onClick={() => setIsSettlementModalOpen(true)}>Settle up</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: '2px solid var(--ink)' }}>
            <button 
              onClick={() => setActiveTab('expenses')}
              style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: 'bold', padding: '10px 0', borderBottom: activeTab === 'expenses' ? '4px solid var(--ink)' : 'none', color: activeTab === 'expenses' ? 'var(--ink)' : '#888', cursor: 'pointer' }}
            >
              Expenses
            </button>
            <button 
              onClick={() => setActiveTab('settlements')}
              style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: 'bold', padding: '10px 0', borderBottom: activeTab === 'settlements' ? '4px solid var(--ink)' : 'none', color: activeTab === 'settlements' ? 'var(--ink)' : '#888', cursor: 'pointer' }}
            >
              Settlements
            </button>
          </div>

          {activeTab === 'expenses' ? (
            expenses.length === 0 ? (
            <div className="empty-state">
              <h2 style={{ fontSize: '32px', color: 'var(--ink)', marginBottom: '20px', border: 'none' }}>You have not added any expenses yet</h2>
              <p style={{ fontSize: '20px', color: '#666' }}>To add a new expense, click the orange "Add an expense" button.</p>
            </div>
          ) : (
            <div className="expenses-container">
              <div className="month-header">
                THIS MONTH
              </div>
              <div className="expenses-list">
                {expenses.map(e => {
                  const summary = getPersonalSummary(e);
                  const expDate = new Date(e.expenseDate);
                  const monthName = expDate.toLocaleString('default', { month: 'short' }).toUpperCase();
                  const day = expDate.getDate();

                  return (
                    <div key={e.id} className="expense-row doodle-group-card" onClick={() => navigate(`/expense/${e.id}`)}>
                      <div className="expense-date">
                        <span className="month">{monthName}</span>
                        <span className="day">{day}</span>
                      </div>
                      <div className="expense-icon">🧾</div>
                      <div className="expense-details">
                        <div className="expense-desc">{e.description}</div>
                      </div>
                      <div className="expense-summary">
                        {summary.type === 'lent' && (
                          <>
                            <div className="summary-block paid">
                              <span className="label">you paid</span>
                              <span className="value">{e.currency} {summary.paid.toFixed(2)}</span>
                            </div>
                            <div className="summary-block lent">
                              <span className="label">you lent</span>
                              <span className="value">{e.currency} {summary.lent.toFixed(2)}</span>
                            </div>
                          </>
                        )}
                        {summary.type === 'borrowed' && (
                          <>
                            <div className="summary-block payer">
                              <span className="label">{e.payer.name.split(' ')[0]} paid</span>
                              <span className="value">{e.currency} {e.amount.toFixed(2)}</span>
                            </div>
                            <div className="summary-block borrowed">
                              <span className="label">you borrowed</span>
                              <span className="value">{e.currency} {summary.borrowed.toFixed(2)}</span>
                            </div>
                          </>
                        )}
                        {summary.type === 'not_involved' && (
                          <div className="summary-block not-involved">
                            <span className="label">not involved</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )) : (
            settlements.length === 0 ? (
              <div className="empty-state">
                <h2 style={{ fontSize: '32px', color: 'var(--ink)', marginBottom: '20px', border: 'none' }}>No settlements yet</h2>
                <p style={{ fontSize: '20px', color: '#666' }}>To record a payment, click the green "Settle up" button.</p>
              </div>
            ) : (
              <div className="expenses-container">
                <div className="expenses-list">
                  {settlements.map(s => {
                    const sDate = new Date(s.settlementDate);
                    return (
                      <div key={s.id} className="expense-row doodle-group-card" style={{ borderLeft: '5px solid #2ecc71' }}>
                        <div className="expense-date">
                          <span className="month">{sDate.toLocaleString('default', { month: 'short' }).toUpperCase()}</span>
                          <span className="day">{sDate.getDate()}</span>
                        </div>
                        <div className="expense-icon" style={{ background: '#e8f8f5' }}>💸</div>
                        <div className="expense-details">
                          <div className="expense-desc">{s.payer.name} paid {s.receiver.name}</div>
                          {s.notes && <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>{s.notes}</div>}
                        </div>
                        <div className="expense-summary">
                          <div className="summary-block paid">
                            <span className="value" style={{ color: '#2ecc71' }}>₹ {s.amount.toFixed(2)}</span>
                          </div>
                        </div>
                        <div style={{ marginLeft: '10px' }}>
                          <button onClick={() => handleDeleteSettlement(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c', fontSize: '16px' }}>🗑️</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>

        {/* Right Column: Balances & Members */}
        <div className="right-sidebar">
          <div className="balances-section">
            <h3 style={{ color: '#999', fontSize: '14px', letterSpacing: '1px', borderBottom: 'none' }}>GROUP BALANCES</h3>
            <div className="balances-list">
              {balances.filter(b => Math.abs(b.netBalance) > 0.01).length === 0 && <p style={{ color: '#666', fontSize: '14px' }}>Settled up!</p>}
              {balances.map((b, idx) => {
                if (Math.abs(b.netBalance) <= 0.01) return null;
                return (
                  <div key={idx} className="balance-item doodle-hover" onClick={() => setSelectedUserForBalance(b.userId)} style={{ cursor: 'pointer', padding: '10px', border: '2px solid transparent', borderRadius: '12px', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--ink)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                    <div className="balance-avatar">{b.name[0]}</div>
                    <div className="balance-info">
                      <strong>{b.name}</strong>
                      {b.netBalance > 0 ? (
                        <span className="gets-back">Should receive {expenses[0]?.currency || '₹'} {b.netBalance.toFixed(2)}</span>
                      ) : (
                        <span className="owes">Owes {expenses[0]?.currency || '₹'} {Math.abs(b.netBalance).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="members-section" style={{ marginTop: '40px' }}>
            <div className="section-header" style={{ color: '#999', fontSize: '14px', letterSpacing: '1px', borderBottom: 'none', display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <span>MEMBERS</span>
              <button onClick={() => setAddingMember(true)} style={{ background: 'none', border: 'none', color: '#5f9ea0', cursor: 'pointer' }}>+ add</button>
            </div>
            <div className="member-list-mini">
              {membersData.currentMembers.map(m => (
                <div key={m.id} className="member-item-mini">
                  <div className="member-avatar">{m.user.name[0]}</div>
                  <span>{m.user.name}</span>
                  <button className="remove-btn-mini" onClick={() => setRemovingMember(m)}>✕</button>
                </div>
              ))}

            </div>
          </div>

          {membersData.membershipHistory && membersData.membershipHistory.length > 0 && (
            <div className="timeline-section" style={{ marginTop: '40px' }}>
              <div className="section-header" style={{ color: '#999', fontSize: '14px', letterSpacing: '1px', borderBottom: 'none', marginBottom: '15px' }}>
                <span>MEMBERSHIP TIMELINE</span>
              </div>
              <div className="timeline-list" style={{ borderLeft: '2px solid #eee', paddingLeft: '15px', marginLeft: '10px' }}>
                {membersData.membershipHistory.map((m, idx) => (
                  <div key={`${m.id}-timeline-${idx}`} className="timeline-item" style={{ fontSize: '13px', marginBottom: '15px', color: '#555', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '-22px', top: '2px', width: '10px', height: '10px', borderRadius: '50%', background: m.leftAt ? '#ff6b6b' : '#2ecc71', border: '2px solid white' }}></div>
                    <div style={{ fontWeight: 'bold', color: 'var(--ink)' }}>{m.user?.name}</div>
                    <div>Joined: {new Date(m.joinedAt).toLocaleDateString()}</div>
                    {m.leftAt && <div style={{ color: '#ff6b6b' }}>Left: {new Date(m.leftAt).toLocaleDateString()}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {addingMember && (
        <div className="modal-overlay">
          <div className="doodle-modal">
            <h2 style={{ borderBottom: 'none' }}>Add Flatmate ➕</h2>
            <p>Enter email address:</p>
            <form onSubmit={handleAddMember}>
              <input 
                type="email" 
                className="doodle-input" 
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                required autoFocus
              />
              <div className="modal-actions">
                <button type="submit" className="doodle-btn-small confirm">Add</button>
                <button type="button" className="doodle-btn-small cancel" onClick={() => setAddingMember(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <MemberResolutionWizard
        isOpen={isMemberResolutionModalOpen}
        onClose={() => setIsMemberResolutionModalOpen(false)}
        groupId={id}
        onNextStep={(sessionId) => {
          setCurrentSessionId(sessionId);
          setIsMemberResolutionModalOpen(false);
          setIsCsvModalOpen(true);
        }}
      />
      <InteractiveCSVWizard 
        isOpen={isCsvModalOpen} 
        onClose={() => { setIsCsvModalOpen(false); setCurrentSessionId(null); }} 
        groupId={id}
        sessionId={currentSessionId}
        onUploadSuccess={fetchGroupAndMembers}
      />

      {selectedUserForBalance && (
        <BalanceDetailsModal 
          isOpen={!!selectedUserForBalance} 
          onClose={() => setSelectedUserForBalance(null)} 
          groupId={id} 
          userId={selectedUserForBalance}
          currentMembers={membersData.currentMembers}
        />
      )}

      {isSettlementModalOpen && (
        <SettlementFormModal 
          isOpen={isSettlementModalOpen}
          onClose={() => setIsSettlementModalOpen(false)}
          groupId={id}
          currentMembers={membersData.currentMembers}
          onSuccess={() => {
            setIsSettlementModalOpen(false);
            fetchGroupAndMembers();
          }}
        />
      )}

      {removingMember && (
        <div className="modal-overlay">
          <div className="doodle-modal delete-modal">
            <h2 style={{ borderBottom: 'none' }}>Remove Member 🚪</h2>
            <p>Are you sure you want to remove <strong>{removingMember.user?.name || 'User'}</strong>?</p>
            <div className="modal-actions">
              <button type="button" className="doodle-btn-small confirm danger" onClick={handleRemoveMember}>Yes, Remove</button>
              <button type="button" className="doodle-btn-small cancel" onClick={() => setRemovingMember(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <ExpenseFormModal 
        isOpen={isExpenseModalOpen} 
        onClose={() => setIsExpenseModalOpen(false)} 
        groupId={id}
        currentMembers={membersData.currentMembers}
        onSuccess={() => {
          setIsExpenseModalOpen(false);
          fetchGroupAndMembers();
        }}
      />
    </Container>
  );
};

const Container = styled.div`
  min-height: 100vh;
  width: 100vw;
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;

  background-color: #ffffff;
  background-image: radial-gradient(rgba(12, 12, 12, 0.171) 2px, transparent 0);
  background-size: 30px 30px;
  background-position: -5px -5px;
  font-family: "Comic Sans MS", "Chalkboard SE", "Marker Felt", "Gochi Hand", sans-serif;
  color: #323232;
  overflow-x: hidden;
  
  --ink: #323232;
  --bg-yellow: #ffe66d;
  --bg-green: #06d6a0;
  --bg-red: #ff6b6b;

  .layout-wrapper {
    display: grid;
    grid-template-columns: 200px 1fr 250px;
    gap: 30px;
    max-width: 1200px;
    margin: 40px auto;
    padding: 0 20px;
  }

  .left-sidebar {
    display: flex;
    flex-direction: column;
    gap: 30px;

    .nav-links {
      display: flex;
      flex-direction: column;
      gap: 10px;

      .nav-item {
        background: transparent;
        border: none;
        text-align: left;
        font-size: 18px;
        color: var(--ink);
        cursor: pointer;
        font-family: inherit;
        padding: 5px 0;
        &:hover { color: #5f9ea0; }
      }
    }

    .sidebar-section {
      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #eee;
        padding: 5px 10px;
        font-size: 12px;
        color: #999;
        font-weight: bold;
        letter-spacing: 1px;
        
        .add-link { background: transparent; border: none; color: #999; cursor: pointer; }
        .add-link:hover { color: #5f9ea0; }
      }
      
      .group-list {
        display: flex;
        flex-direction: column;
        padding-top: 10px;
        
        .group-item {
          background: transparent;
          border: none;
          text-align: left;
          padding: 8px 10px;
          font-size: 16px;
          cursor: pointer;
          color: #666;
          border-left: 4px solid transparent;
          font-family: inherit;

          &.active {
            border-left-color: #5f9ea0;
            color: #5f9ea0;
            font-weight: bold;
          }
          &:hover:not(.active) { color: var(--ink); }
        }
      }
    }
  }

  .main-content {
    background: white;
    border: 3px solid var(--ink);
    border-radius: 16px;
    box-shadow: 8px 8px 0 var(--ink);
    padding: 0;
    overflow: hidden;

    .main-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 30px;
      border-bottom: 3px solid var(--ink);
      background: #eee;
      
      .group-info {
        display: flex;
        align-items: center;
        gap: 15px;

        .group-icon {
          width: 50px;
          height: 50px;
          background: #ff6b6b;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          color: white;
          border: 2px solid var(--ink);
        }
      }

      .header-actions {
        display: flex;
        gap: 15px;
      }
    }

    .empty-state {
      padding: 60px 40px;
      text-align: center;
    }

    .month-header {
      background: #f5f5f5;
      padding: 10px 30px;
      font-size: 14px;
      color: #999;
      font-weight: bold;
      border-bottom: 2px solid #ddd;
    }

    .expenses-list {
      display: flex;
      flex-direction: column;

      .expense-row {
        display: flex;
        align-items: center;
        padding: 15px 30px;
        border-bottom: 2px solid #eee;
        cursor: pointer;
        transition: background 0.2s;

        &:hover { background: #fdfbf7; }
        &:last-child { border-bottom: none; }

        .expense-date {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 50px;
          color: #999;
          
          .month { font-size: 12px; text-transform: uppercase; }
          .day { font-size: 24px; color: var(--ink); line-height: 1; }
        }

        .expense-icon {
          width: 40px;
          height: 40px;
          background: #dff0d8;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          margin: 0 15px;
          border: 2px solid #ccc;
        }

        .expense-details {
          flex: 1;
          .expense-desc { font-size: 20px; font-weight: bold; color: var(--ink); }
        }

        .expense-summary {
          display: flex;
          gap: 20px;
          text-align: right;
          width: 200px;
          justify-content: flex-end;

          .summary-block {
            display: flex;
            flex-direction: column;
            font-size: 14px;

            .label { color: #999; font-size: 12px; }
            .value { font-weight: bold; }

            &.paid .value { color: var(--ink); }
            &.lent .value { color: #5f9ea0; }
            &.borrowed .value { color: #ff6b6b; }
            &.not-involved .label { color: #ccc; margin-top: 10px; }
          }
        }
      }
    }
  }

  .right-sidebar {
    .balance-item {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 15px;

      .balance-avatar {
        width: 40px;
        height: 40px;
        background: var(--ink);
        color: white;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 18px;
        font-weight: bold;
      }

      .balance-info {
        display: flex;
        flex-direction: column;
        font-size: 14px;
        
        strong { color: var(--ink); font-size: 16px; }
        .gets-back { color: #5f9ea0; font-weight: bold; }
        .owes { color: #ff6b6b; font-weight: bold; }
      }
    }

    .member-item-mini {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
      font-size: 16px;

      .member-avatar {
        width: 30px;
        height: 30px;
        background: #eee;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        border: 2px solid var(--ink);
      }

      .remove-btn-mini {
        margin-left: auto;
        background: transparent;
        border: none;
        color: var(--bg-red);
        cursor: pointer;
        font-weight: bold;
      }
    }
  }

  .doodle-btn-small {
    background: var(--bg-yellow);
    border: 3px solid var(--ink);
    padding: 8px 16px;
    border-radius: 12px;
    font-weight: bold;
    font-size: 16px;
    cursor: pointer;
    box-shadow: 4px 4px 0 var(--ink);
    transition: all 0.2s;
    font-family: inherit;
    color: var(--ink);
    
    &:hover { transform: translateY(-2px); box-shadow: 6px 6px 0 var(--ink); }
    &:active { transform: translate(2px, 2px); box-shadow: 0 0 0 var(--ink); }
  }

  /* Modals */
  .modal-overlay {
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    backdrop-filter: blur(3px);
  }
  .doodle-modal {
    background: white;
    padding: 30px;
    border-radius: 20px;
    border: 4px solid var(--ink);
    box-shadow: 12px 12px 0px var(--ink);
    width: 400px;
    max-width: 90vw;
    font-family: inherit;
  }
  .doodle-input {
    width: 100%;
    padding: 15px;
    border: 3px solid var(--ink);
    border-radius: 10px;
    margin-bottom: 20px;
    font-size: 18px;
    font-family: inherit;
    box-sizing: border-box;
    box-shadow: inset 3px 3px 0 rgba(0,0,0,0.05);
  }
  .modal-actions {
    display: flex;
    gap: 15px;
    justify-content: flex-end;
    .confirm { background-color: var(--bg-green); }
    .cancel { background-color: white; }
    .danger { background-color: var(--bg-red); }
  }
`;

export default GroupDetails;
