import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import axios from 'axios';

const SettlementFormModal = ({ isOpen, onClose, groupId, currentMembers, onSuccess, settlementToEdit, prefilledData }) => {
  const [payerId, setPayerId] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [amount, setAmount] = useState('');
  const [settlementDate, setSettlementDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      if (settlementToEdit) {
        setPayerId(settlementToEdit.payerId.toString());
        setReceiverId(settlementToEdit.receiverId.toString());
        setAmount(settlementToEdit.amount.toString());
        setSettlementDate(new Date(settlementToEdit.settlementDate).toISOString().split('T')[0]);
        setNotes(settlementToEdit.notes || '');
      } else if (prefilledData) {
        setPayerId(prefilledData.payerId.toString());
        setReceiverId(prefilledData.receiverId.toString());
        setAmount(prefilledData.amount.toString());
        setSettlementDate(new Date().toISOString().split('T')[0]);
        setNotes('');
      } else {
        // Default payer to current user if available
        const currentUserId = localStorage.getItem('userId');
        if (currentUserId && currentMembers.some(m => m.userId.toString() === currentUserId)) {
          setPayerId(currentUserId);
        } else {
          setPayerId('');
        }
        setReceiverId('');
        setAmount('');
        setSettlementDate(new Date().toISOString().split('T')[0]);
        setNotes('');
      }
      setError(null);
    }
  }, [isOpen, settlementToEdit, prefilledData, currentMembers]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!payerId || !receiverId || !amount) {
      setError('Please fill in who paid, who received, and the amount.');
      return;
    }
    if (payerId === receiverId) {
      setError('Payer and receiver cannot be the same person.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      payerId: parseInt(payerId),
      receiverId: parseInt(receiverId),
      amount: parseFloat(amount),
      settlementDate: new Date(settlementDate).toISOString(),
      notes
    };

    try {
      const token = localStorage.getItem('token');
      if (settlementToEdit) {
        await axios.put(`http://localhost:3000/api/settlements/${settlementToEdit.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`http://localhost:3000/api/groups/${groupId}/settlements`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      onSuccess();
    } catch (err) {
      console.error('Error saving settlement:', err);
      setError(err.response?.data?.error || 'Failed to save settlement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <ModalContainer>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div className="doodle-title">{settlementToEdit ? 'Edit Settlement' : 'Record Payment'}</div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--ink)', fontSize: '24px', cursor: 'pointer', fontWeight: 'bold' }}>✖</button>
        </div>

        {error && <div className="error-alert">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Who Paid?</label>
            <select value={payerId} onChange={e => setPayerId(e.target.value)} required>
              <option value="">Select payer</option>
              {currentMembers.map(m => (
                <option key={`p-${m.userId}`} value={m.userId}>{m.user.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Who Received?</label>
            <select value={receiverId} onChange={e => setReceiverId(e.target.value)} required>
              <option value="">Select receiver</option>
              {currentMembers.map(m => (
                <option key={`r-${m.userId}`} value={m.userId}>{m.user.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Amount</label>
            <div className="amount-input-wrapper">
              <span className="currency">₹</span>
              <input 
                type="number" 
                step="0.01" 
                min="0.01" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                required 
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Date</label>
              <input 
                type="date" 
                value={settlementDate} 
                onChange={e => setSettlementDate(e.target.value)} 
                required 
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Notes (Optional)</label>
              <input 
                type="text" 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="e.g. Bank transfer"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '20px' }}>
            <button type="button" className="doodle-btn-small cancel" onClick={onClose} disabled={loading} style={{ background: 'white' }}>Cancel</button>
            <button type="submit" className="doodle-btn-small confirm" disabled={loading} style={{ background: '#5f9ea0', color: 'white' }}>
              {loading ? 'Saving...' : 'Save Payment'}
            </button>
          </div>
        </form>
      </ModalContainer>
    </div>
  );
};

const ModalContainer = styled.div`
  background-color: #fff9e6;
  background-image: repeating-linear-gradient(
    transparent,
    transparent 28px,
    rgba(0, 0, 0, 0.06) 28px,
    rgba(0, 0, 0, 0.06) 30px
  );
  background-position: 0 15px;
  padding: 30px 40px;
  border-radius: 8px 24px 8px 24px / 24px 8px 24px 8px;
  border: 2px solid var(--ink);
  box-shadow: 4px 4px 0px var(--ink);
  width: 500px;
  max-width: 95vw;
  font-family: inherit;

  .doodle-title {
    font-size: 28px;
    font-weight: 900;
    color: var(--ink);
    margin: 5px 0 20px 0;
    text-transform: uppercase;
    transform: rotate(-1deg);
    text-shadow: 1px 1px 0px rgba(0, 0, 0, 0.1);
  }

  .error-alert {
    background-color: #ffeaea;
    color: #e74c3c;
    padding: 10px 15px;
    border-radius: 8px;
    border: 2px solid #e74c3c;
    margin-bottom: 20px;
    font-weight: bold;
  }

  .form-group {
    margin-bottom: 20px;
    
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
      color: var(--ink);
    }
    
    input, select {
      width: 100%;
      padding: 12px;
      border: 2px solid var(--ink);
      border-radius: 8px;
      font-size: 16px;
      background: white;
      font-family: inherit;
      box-sizing: border-box;

      &:focus {
        outline: none;
        box-shadow: 2px 2px 0px var(--ink);
      }
    }
  }

  .form-row {
    display: flex;
    gap: 15px;
  }

  .amount-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;

    .currency {
      position: absolute;
      left: 15px;
      font-size: 18px;
      font-weight: bold;
      color: #666;
    }

    input {
      padding-left: 35px;
      font-size: 20px;
      font-weight: bold;
    }
  }
`;

export default SettlementFormModal;
