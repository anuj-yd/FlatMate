import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import SettlementFormModal from './SettlementFormModal';

const BalanceDetailsModal = ({ isOpen, onClose, groupId, userId, onSettlementAdded, currentMembers }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // For the Settle Up button in the repayment list
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [settlementData, setSettlementData] = useState(null);

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
      alert('Failed to load user profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleSettleUp = (repayment) => {
    // Determine payer and receiver based on the repayment object
    // repayment.from owes repayment.to
    setSettlementData({
      payerId: repayment.from.userId,
      receiverId: repayment.to.userId,
      amount: repayment.amount
    });
    setIsSettlementModalOpen(true);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <ModalContainer>
        <button type="button" className="close-btn" onClick={onClose}>✖</button>

        {loading ? (
          <p>Loading user profile...</p>
        ) : details ? (
          <div className="profile-content">
            
            {/* User Profile Header */}
            <div className="profile-header">
              <div className="avatar">
                {/* A geometric placeholder avatar as shown in screenshot */}
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="40" cy="40" r="40" fill="#B2EBF2"/>
                  <path d="M40 0C17.9086 0 0 17.9086 0 40C0 62.0914 17.9086 80 40 80V0Z" fill="#00838F"/>
                  <path d="M0 40C0 62.0914 17.9086 80 40 80L80 40H0Z" fill="#006064"/>
                  <path d="M80 40C80 17.9086 62.0914 0 40 0L0 40H80Z" fill="#4DD0E1"/>
                </svg>
              </div>
              <div className="user-info">
                <h1>{details.user}</h1>
                <p className="email">{details.userEmail || 'Email not available'}</p>
                <div className="header-actions">
                  <button className="btn-orange">Friend settings</button>
                  <button className="btn-light-orange">Send a balance reminder</button>
                </div>
              </div>
            </div>

            <hr className="divider" />

            {/* Suggested Repayments */}
            <div className="repayments-section">
              <h3 className="section-title">SUGGESTED REPAYMENTS FOR "{details.groupName?.toUpperCase() || 'GROUP'}"</h3>
              
              {(!details.repayments || details.repayments.length === 0) ? (
                <p className="no-debts">No suggested repayments. Everyone is settled up!</p>
              ) : (
                <ul className="repayments-list">
                  {details.repayments.map((r, idx) => (
                    <li key={idx} className="repayment-item">
                      <div className="repayment-text">
                        <span className="bullet">•</span> 
                        <strong>{r.from.name}</strong> owes <span className="amount">₹{r.amount.toFixed(2)}</span> to <strong>{r.to.name}</strong>
                      </div>
                      <button className="btn-settle" onClick={() => handleSettleUp(r)}>Settle up</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </ModalContainer>

      {/* Settle Up Form Modal for Repayment rows */}
      {isSettlementModalOpen && settlementData && (
        <SettlementFormModal 
          isOpen={isSettlementModalOpen}
          onClose={() => setIsSettlementModalOpen(false)}
          groupId={groupId}
          currentMembers={currentMembers || []}
          onSuccess={() => {
            fetchBalanceDetails();
            if (onSettlementAdded) onSettlementAdded();
            setIsSettlementModalOpen(false);
          }}
          settlementToEdit={settlementData}
        />
      )}
    </div>
  );
};

const ModalContainer = styled.div`
  background-color: #ffffff;
  padding: 30px;
  border-radius: 8px;
  width: 650px;
  max-width: 95vw;
  max-height: 85vh;
  overflow-y: auto;
  position: relative;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);

  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;

  .close-btn {
    position: absolute;
    top: 15px;
    right: 15px;
    background: transparent;
    border: none;
    color: #b3b3b3;
    font-size: 20px;
    cursor: pointer;
    font-weight: bold;
    &:hover { color: #555; }
  }

  .profile-header {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 25px;

    .avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
    }

    .user-info {
      h1 {
        margin: 0 0 5px 0;
        font-size: 24px;
        color: #333;
        font-weight: bold;
      }
      .email {
        margin: 0 0 15px 0;
        color: #999;
        font-size: 14px;
      }
    }
  }

  .header-actions {
    display: flex;
    gap: 10px;

    button {
      padding: 6px 14px;
      border: 1px solid transparent;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }

    .btn-orange {
      background-color: #ff652f;
      color: white;
      border-color: #e55b2a;
      &:hover { background-color: #e55b2a; }
    }

    .btn-light-orange {
      background-color: #ffa07a;
      color: white;
      border-color: #e5906e;
      &:hover { background-color: #e5906e; }
    }
  }

  .divider {
    border: 0;
    height: 1px;
    background: #eee;
    margin: 25px 0;
  }

  .repayments-section {
    .section-title {
      font-size: 14px;
      color: #888;
      margin-bottom: 20px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .no-debts {
      color: #999;
      font-style: italic;
    }

    .repayments-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .repayment-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      font-size: 16px;
      color: #333;

      .repayment-text {
        .bullet {
          color: #333;
          margin-right: 8px;
          font-weight: bold;
        }
        .amount {
          color: #5bc5a7;
          font-weight: 600;
        }
      }

      .btn-settle {
        background-color: #5bc5a7;
        color: white;
        border: 1px solid #52b196;
        border-radius: 4px;
        padding: 5px 15px;
        font-size: 14px;
        cursor: pointer;
        font-weight: 500;
        &:hover { background-color: #52b196; }
      }
    }
  }
`;

export default BalanceDetailsModal;
