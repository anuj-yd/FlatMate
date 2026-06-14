import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import axios from 'axios';

const ExpenseFormModal = ({ isOpen, onClose, groupId, onSuccess, expenseToEdit = null, currentMembers }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [payerId, setPayerId] = useState('');
  const [splitType, setSplitType] = useState('EQUAL');
  const [notes, setNotes] = useState('');
  
  const [participantShares, setParticipantShares] = useState({});
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Initialize or reset form
  useEffect(() => {
    if (isOpen) {
      if (expenseToEdit) {
        setDescription(expenseToEdit.description);
        setAmount(expenseToEdit.amount);
        setCurrency(expenseToEdit.currency);
        setExpenseDate(new Date(expenseToEdit.expenseDate).toISOString().split('T')[0]);
        setPayerId(expenseToEdit.payerId);
        setSplitType(expenseToEdit.splitType);
        setNotes(expenseToEdit.notes || '');

        const shares = {};
        expenseToEdit.participants.forEach(p => {
          shares[p.userId] = { selected: true, shareValue: p.shareValue || '' };
        });
        setParticipantShares(shares);
      } else {
        setDescription('');
        setAmount('');
        setCurrency('INR');
        setExpenseDate(new Date().toISOString().split('T')[0]);
        setPayerId(currentMembers[0]?.userId || '');
        setSplitType('EQUAL');
        setNotes('');
        
        const shares = {};
        currentMembers.forEach(m => {
          shares[m.userId] = { selected: true, shareValue: '' };
        });
        setParticipantShares(shares);
      }
      setErrorMsg('');
    }
  }, [isOpen, expenseToEdit, currentMembers]);

  if (!isOpen) return null;

  const handleShareChange = (userId, field, value) => {
    setParticipantShares(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value
      }
    }));
  };

  const calculateSum = () => {
    let sum = 0;
    Object.values(participantShares).forEach(p => {
      if (p.selected && p.shareValue) {
        sum += parseFloat(p.shareValue);
      }
    });
    return sum;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    const selectedParticipants = Object.keys(participantShares)
      .filter(id => participantShares[id].selected)
      .map(id => ({
        userId: parseInt(id),
        shareValue: splitType === 'EQUAL' ? null : parseFloat(participantShares[id].shareValue)
      }));

    if (selectedParticipants.length === 0) {
      setErrorMsg('Please select at least one participant.');
      return;
    }

    if (splitType === 'EXACT') {
      const sum = calculateSum();
      if (Math.abs(sum - parseFloat(amount)) > 0.01) {
        setErrorMsg(`Sum of exact splits (${sum}) must equal the total amount (${amount}).`);
        return;
      }
    } else if (splitType === 'PERCENTAGE') {
      const sum = calculateSum();
      if (Math.abs(sum - 100) > 0.01) {
        setErrorMsg(`Sum of percentages (${sum}%) must equal 100%.`);
        return;
      }
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        description,
        amount: parseFloat(amount),
        currency,
        expenseDate,
        payerId: parseInt(payerId),
        splitType,
        notes,
        participants: selectedParticipants
      };

      if (expenseToEdit) {
        await axios.put(`http://localhost:3000/api/expenses/${expenseToEdit.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`http://localhost:3000/api/groups/${groupId}/expenses`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      onSuccess();
    } catch (error) {
      console.error(error);
      setErrorMsg(error.response?.data?.error || 'Failed to save expense.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <ModalContainer>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div className="doodle-title">{expenseToEdit ? 'Edit Expense' : 'Add Expense'}</div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--ink)', fontSize: '24px', cursor: 'pointer', fontWeight: 'bold' }}>✖</button>
        </div>
        
        {errorMsg && <div className="error-alert">{errorMsg}</div>}
        
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', justifyContent: 'center', marginBottom: '30px', padding: '0 20px' }}>
            <div style={{ width: '80px', height: '80px', border: '3px solid var(--ink)', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '40px', background: '#f5f5f5', boxShadow: '4px 4px 0 var(--ink)' }}>
              🧾
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              <input 
                type="text" 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                required 
                placeholder="Enter a description" 
                style={{ fontSize: '24px', border: 'none', borderBottom: '2px dashed #ccc', padding: '5px', outline: 'none', fontFamily: 'inherit', width: '100%' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', fontSize: '40px', borderBottom: '2px dashed #ccc' }}>
                <select className="inline-select" value={currency} onChange={e => setCurrency(e.target.value)} style={{ fontSize: '24px', marginRight: '10px' }}>
                  <option value="INR">₹ INR</option>
                  <option value="USD">$ USD</option>
                  <option value="EUR">€ EUR</option>
                </select>
                <input 
                  type="number" 
                  step="0.01" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  required 
                  placeholder="0.00" 
                  style={{ fontSize: '40px', border: 'none', outline: 'none', width: '100%', fontFamily: 'inherit', color: 'var(--ink)' }}
                />
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{ fontSize: '18px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
              <span>Paid by</span> <select className="inline-select" value={payerId} onChange={e => setPayerId(e.target.value)} required>
                <option value="" disabled>Select</option>
                {currentMembers.map(m => (
                  <option key={m.userId} value={m.userId}>{m.user.name}</option>
                ))}
              </select> <span>and split</span> <select className="inline-select" value={splitType} onChange={e => setSplitType(e.target.value)}>
                <option value="EQUAL">equally</option>
                <option value="EXACT">exact amounts</option>
                <option value="PERCENTAGE">by percentages</option>
              </select>.
            </div>
            
            {splitType === 'EQUAL' && amount && (
              <div style={{ fontSize: '16px', color: '#666', marginTop: '10px', fontWeight: 'bold' }}>
                ({currency}{(amount / Object.values(participantShares).filter(p => p.selected).length || 1).toFixed(2)}/person)
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginBottom: '30px' }}>
             <input type="date" className="doodle-input secondary-input" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} required />
             <input type="text" className="doodle-input secondary-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes (optional)" />
          </div>

          <div className="participants-section">
            <label>Split Among Participants</label>
            <div className="participants-list">
              {currentMembers.map(m => {
                const pData = participantShares[m.userId] || { selected: false, shareValue: '' };
                return (
                  <div key={m.userId} className={`participant-row ${pData.selected ? 'selected' : ''}`}>
                    <label className="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={pData.selected} 
                        onChange={(e) => handleShareChange(m.userId, 'selected', e.target.checked)} 
                      />
                      {m.user.name}
                    </label>
                    
                    {pData.selected && splitType !== 'EQUAL' && (
                      <div className="share-input-wrapper">
                        <input 
                          type="number" 
                          step="0.01" 
                          className="doodle-input share-input" 
                          placeholder={splitType === 'EXACT' ? 'Amount' : '%'}
                          value={pData.shareValue}
                          onChange={(e) => handleShareChange(m.userId, 'shareValue', e.target.value)}
                          required
                        />
                        <span className="unit-label">{splitType === 'EXACT' ? currency : '%'}</span>
                      </div>
                    )}
                    {pData.selected && splitType === 'EQUAL' && amount && (
                      <div className="share-input-wrapper" style={{ fontWeight: 'bold', fontSize: '18px', color: 'var(--ink)' }}>
                        {currency} {(amount / Object.values(participantShares).filter(p => p.selected).length || 1).toFixed(2)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {splitType !== 'EQUAL' && (
              <div className="split-summary">
                Sum: <strong>{calculateSum().toFixed(2)}</strong> {splitType === 'PERCENTAGE' ? '%' : currency}
              </div>
            )}
          </div>

          <div className="modal-actions" style={{ borderTop: '2px dashed #ccc', paddingTop: '20px', marginTop: '20px' }}>
            <button type="button" className="doodle-btn-small cancel" onClick={onClose} disabled={loading} style={{ background: 'white' }}>Cancel</button>
            <button type="submit" className="doodle-btn-small confirm" disabled={loading} style={{ background: '#5f9ea0', color: 'white' }}>
              {loading ? 'Saving...' : 'Save'}
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
  width: 550px;
  max-width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
  font-family: inherit;

  .doodle-title {
    font-size: 32px;
    font-weight: 900;
    color: var(--ink);
    margin: 5px 0 20px 0;
    text-transform: uppercase;
    letter-spacing: 1px;
    transform: rotate(-1deg);
    text-shadow: 1px 1px 0px rgba(0, 0, 0, 0.1);
  }

  /* Hide scrollbar */
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;

  .error-alert {
    background: var(--bg-red);
    color: var(--ink);
    padding: 10px 15px;
    border: 2px solid var(--ink);
    border-radius: 8px;
    margin-bottom: 20px;
    font-weight: bold;
  }

  .form-row {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
  }

  .flex-1 { flex: 1; }
  .flex-2 { flex: 2; }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;

    label {
      font-weight: bold;
      color: var(--ink);
      font-size: 16px;
    }
  }

  .doodle-input {
    padding: 12px 15px;
    border: 3px solid var(--ink);
    border-radius: 10px;
    font-size: 16px;
    font-family: inherit;
    box-shadow: inset 3px 3px 0 rgba(0,0,0,0.05);
  }

  .inline-select {
    display: inline-block;
    width: auto;
    padding: 5px 10px;
    font-size: 16px;
    font-weight: bold;
    color: #5f9ea0;
    background: #e0ffff;
    border: 3px dashed #5f9ea0;
    border-radius: 20px;
    box-shadow: none;
    margin: 0 5px;
    cursor: pointer;
    font-family: inherit;
    appearance: none;
  }

  .secondary-input {
    width: 200px;
    text-align: center;
    border-color: #ccc;
    background: #fcfcfc;
    box-shadow: none;
  }

  .participants-section {
    background: #f9f9f9;
    border: 3px solid var(--ink);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 25px;

    > label {
      font-weight: bold;
      font-size: 18px;
      display: block;
      margin-bottom: 15px;
      border-bottom: 2px solid var(--ink);
      padding-bottom: 5px;
    }
  }

  .participants-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .participant-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 15px;
    border: 2px solid #ccc;
    border-radius: 8px;
    background: white;

    &.selected {
      border-color: var(--ink);
      background: var(--bg-yellow);
    }
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    
    input[type="checkbox"] {
      width: 20px;
      height: 20px;
      accent-color: var(--ink);
    }
  }

  .share-input-wrapper {
    display: flex;
    align-items: center;
    gap: 10px;

    .share-input {
      width: 100px;
      padding: 8px;
      margin: 0;
    }

    .unit-label {
      font-weight: bold;
      font-size: 16px;
    }
  }

  .split-summary {
    margin-top: 15px;
    text-align: right;
    font-size: 16px;
  }
`;

export default ExpenseFormModal;
