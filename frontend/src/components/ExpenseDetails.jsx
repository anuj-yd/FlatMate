import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import axios from 'axios';
import ExpenseFormModal from './ExpenseFormModal';

const ExpenseDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchExpense = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:3000/api/expenses/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExpense(res.data);
    } catch (error) {
      console.error('Error fetching expense details:', error);
      alert('Failed to load expense or access denied.');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpense();
  }, [id]);

  const handleDelete = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:3000/api/expenses/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Expense deleted.');
      navigate(`/group/${expense.groupId}`);
    } catch (error) {
      console.error('Failed to delete expense', error);
      alert(error.response?.data?.error || 'Failed to delete expense.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;
  if (!expense) return null;

  const currentUserId = parseInt(localStorage.getItem('userId')) || 0; // Might need to fetch user profile if id is not in local storage
  const isCreatorOrPayer = true; // Temporary bypass for UI display, backend will validate
  
  // Calculate specific shares for display
  let splitDisplay = [];
  if (expense.splitType === 'EQUAL') {
    const perPerson = (expense.amount / expense.participants.length).toFixed(2);
    splitDisplay = expense.participants.map(p => ({ name: p.user.name, text: `${perPerson} ${expense.currency}` }));
  } else if (expense.splitType === 'PERCENTAGE') {
    splitDisplay = expense.participants.map(p => ({ 
      name: p.user.name, 
      text: `${p.shareValue}% (${((expense.amount * p.shareValue) / 100).toFixed(2)} ${expense.currency})` 
    }));
  } else if (expense.splitType === 'EXACT') {
    splitDisplay = expense.participants.map(p => ({ name: p.user.name, text: `${p.shareValue} ${expense.currency}` }));
  }

  return (
    <Container>
      <div className="content-wrapper">
        <header className="header">
          <button className="back-btn" onClick={() => navigate(`/group/${expense.groupId}`)}>← Back to Group</button>
          <h1>Expense Details 🧾</h1>
          <div className="actions">
            <button className="doodle-btn-small edit" onClick={() => setIsEditModalOpen(true)}>✏️ Edit</button>
            <button className="doodle-btn-small delete" onClick={() => setDeleting(true)}>🗑️ Delete</button>
          </div>
        </header>

        <div className="expense-card">
          <div className="expense-header">
            <h2>{expense.description}</h2>
            <div className="amount-badge">
              {expense.amount} {expense.currency}
            </div>
          </div>
          
          <div className="meta-info">
            <p><strong>Paid By:</strong> {expense.payer.name}</p>
            <p><strong>Date:</strong> {new Date(expense.expenseDate).toLocaleDateString()}</p>
            <p><strong>Split Type:</strong> {expense.splitType}</p>
            <p><strong>Added By:</strong> {expense.creator.name} on {new Date(expense.createdAt).toLocaleDateString()}</p>
          </div>

          {expense.notes && (
            <div className="notes-section">
              <strong>Notes:</strong>
              <p>{expense.notes}</p>
            </div>
          )}

          <div className="participants-breakdown">
            <h3>Participants & Shares</h3>
            <div className="shares-list">
              {splitDisplay.map((s, idx) => (
                <div key={idx} className="share-row">
                  <span className="name">{s.name}</span>
                  <span className="value">{s.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {deleting && (
        <div className="modal-overlay">
          <div className="doodle-modal">
            <h2>Delete Expense? 🗑️</h2>
            <p>Are you sure you want to delete this expense? This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="doodle-btn-small cancel" onClick={() => setDeleting(false)}>Cancel</button>
              <button className="doodle-btn-small delete" onClick={handleDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <ExpenseFormModal 
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          groupId={expense.groupId}
          currentMembers={expense.group.members.filter(m => !m.leftAt)} // Need to pass current active members
          expenseToEdit={expense}
          onSuccess={() => {
            setIsEditModalOpen(false);
            fetchExpense();
          }}
        />
      )}
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

  .content-wrapper {
    padding: 40px;
    max-width: 900px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 50px;
    padding-bottom: 20px;
    border-bottom: 4px solid var(--ink);
    
    h1 { margin: 0; flex: 1; color: var(--ink); font-size: 38px; text-transform: uppercase; letter-spacing: 2px;}
  }

  .actions {
    display: flex;
    gap: 15px;
  }

  .back-btn, .doodle-btn-small {
    background: var(--bg-yellow);
    border: 3px solid var(--ink);
    padding: 10px 20px;
    border-radius: 12px;
    font-weight: bold;
    font-size: 16px;
    cursor: pointer;
    box-shadow: 6px 6px 0 var(--ink);
    transition: all 0.2s;
    font-family: inherit;
    color: var(--ink);
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 8px 8px 0 var(--ink);
    }
    &:active { transform: translate(4px, 4px); box-shadow: 0 0 0 var(--ink); }
  }

  .doodle-btn-small.delete { background: var(--bg-red); }
  .doodle-btn-small.edit { background: var(--bg-green); }

  .expense-card {
    background: white;
    padding: 40px;
    border-radius: 20px;
    border: 4px solid var(--ink);
    box-shadow: 12px 12px 0 var(--ink);
  }

  .expense-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    border-bottom: 3px dashed #ccc;
    padding-bottom: 20px;

    h2 { margin: 0; font-size: 32px; color: var(--ink); }
    
    .amount-badge {
      background: var(--bg-yellow);
      padding: 10px 20px;
      border-radius: 12px;
      border: 3px solid var(--ink);
      font-size: 28px;
      font-weight: bold;
    }
  }

  .meta-info {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 30px;
    
    p {
      margin: 0;
      font-size: 18px;
      strong { color: var(--ink); }
    }
  }

  .notes-section {
    background: #fdfbf7;
    padding: 20px;
    border: 3px solid var(--ink);
    border-radius: 12px;
    margin-bottom: 30px;
    
    strong { font-size: 18px; display: block; margin-bottom: 10px; }
    p { margin: 0; font-size: 16px; }
  }

  .participants-breakdown {
    h3 {
      font-size: 24px;
      margin-bottom: 20px;
      color: var(--ink);
    }
  }

  .shares-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .share-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f9f9f9;
    padding: 15px 20px;
    border: 2px solid var(--ink);
    border-radius: 12px;
    
    .name { font-size: 18px; font-weight: bold; }
    .value { font-size: 18px; background: var(--bg-green); padding: 5px 10px; border-radius: 6px; border: 2px solid var(--ink); font-weight: bold; }
  }

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

    h2 { margin-top: 0; }
  }

  .modal-actions {
    display: flex;
    gap: 15px;
    justify-content: flex-end;
    margin-top: 20px;
  }
`;

export default ExpenseDetails;
