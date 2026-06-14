import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import axios from 'axios';

const BalanceDetailsModal = ({ isOpen, onClose, groupId, userId }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && groupId && userId) {
      fetchBalanceDetails();
    }
  }, [isOpen, groupId, userId]);

  const fetchBalanceDetails = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:3000/api/groups/${groupId}/balances/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDetails(res.data);
    } catch (err) {
      console.error('Failed to fetch balance details', err);
      alert('Failed to load balance breakdown.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <ModalContainer>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div className="doodle-title">{details?.user || 'User'}'s Balances</div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--ink)', fontSize: '24px', cursor: 'pointer', fontWeight: 'bold' }}>✖</button>
        </div>

        {loading ? (
          <p>Loading breakdown...</p>
        ) : details ? (
          <div>
            <div className="summary-cards">
              <div className="card paid">
                <span>Total Paid</span>
                <strong>₹ {details.totalPaid.toFixed(2)}</strong>
              </div>
              <div className="card owed">
                <span>Total Share</span>
                <strong>₹ {details.totalOwed.toFixed(2)}</strong>
              </div>
              <div className={`card net ${details.netBalance >= 0 ? 'positive' : 'negative'}`}>
                <span>Net Balance</span>
                <strong>{details.netBalance > 0 ? '+' : ''}₹ {details.netBalance.toFixed(2)}</strong>
              </div>
            </div>

            <h3 style={{ margin: '20px 0 10px', fontSize: '18px' }}>Expense Breakdown</h3>
            <div className="breakdown-list">
              {details.breakdown.length === 0 ? (
                <p style={{ color: '#666' }}>No expenses involved.</p>
              ) : (
                details.breakdown.map((b, idx) => (
                  <div key={idx} className="breakdown-item">
                    <div className="item-header">
                      <strong>{b.description}</strong>
                      <span className="date">{new Date(b.date).toLocaleDateString()}</span>
                    </div>
                    <div className="item-details">
                      <div className="detail-col">
                        <span className="label">Total Amount</span>
                        <span>₹ {b.amount.toFixed(2)}</span>
                      </div>
                      <div className="detail-col">
                        <span className="label">Paid By</span>
                        <span>{b.payer}</span>
                      </div>
                      <div className="detail-col">
                        <span className="label">Their Share</span>
                        <span>₹ {b.userShare.toFixed(2)}</span>
                      </div>
                      <div className={`detail-col impact ${b.impact >= 0 ? 'positive' : 'negative'}`}>
                        <span className="label">Impact</span>
                        <strong>{b.impact > 0 ? '+' : ''}₹ {b.impact.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
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
  width: 600px;
  max-width: 95vw;
  max-height: 85vh;
  overflow-y: auto;
  font-family: inherit;

  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;

  .doodle-title {
    font-size: 28px;
    font-weight: 900;
    color: var(--ink);
    margin: 5px 0 10px 0;
    text-transform: uppercase;
    transform: rotate(-1deg);
    text-shadow: 1px 1px 0px rgba(0, 0, 0, 0.1);
  }

  .summary-cards {
    display: flex;
    gap: 15px;
    margin-bottom: 20px;
  }

  .card {
    flex: 1;
    background: white;
    padding: 15px;
    border-radius: 12px;
    border: 2px solid var(--ink);
    box-shadow: 2px 2px 0px var(--ink);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    
    span {
      font-size: 12px;
      text-transform: uppercase;
      font-weight: bold;
      color: #666;
    }
    
    strong {
      font-size: 20px;
    }
  }

  .card.paid strong { color: #5f9ea0; }
  .card.owed strong { color: #ff6b6b; }
  .card.net.positive strong { color: #2ecc71; }
  .card.net.negative strong { color: #e74c3c; }

  .breakdown-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .breakdown-item {
    background: white;
    border: 2px solid var(--ink);
    border-radius: 12px;
    padding: 15px;
  }

  .item-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    border-bottom: 1px dashed #ccc;
    padding-bottom: 5px;
    
    strong { font-size: 16px; }
    .date { color: #888; font-size: 14px; }
  }

  .item-details {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
  }

  .detail-col {
    display: flex;
    flex-direction: column;
    gap: 3px;
    
    .label {
      font-size: 11px;
      color: #888;
      text-transform: uppercase;
    }
  }

  .impact.positive strong { color: #2ecc71; }
  .impact.negative strong { color: #e74c3c; }
`;

export default BalanceDetailsModal;
