import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import axios from 'axios';

const InteractiveCSVWizard = ({ isOpen, onClose, groupId, sessionId, onUploadSuccess }) => {
  const fileInputRef = useRef(null);
  
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [wizardData, setWizardData] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  
  // States for resolutions
  const [resolvedIssues, setResolvedIssues] = useState({});
  const [tier2Currency, setTier2Currency] = useState('INR');
  const [tier2State, setTier2State] = useState('default'); // 'default', 'editing', 'dismissed'
  const [showAutoFixes, setShowAutoFixes] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [guestConvertModal, setGuestConvertModal] = useState({ isOpen: false, issueId: null, unknownNames: [] });

  // Bulk Mappings
  const [nameMappings, setNameMappings] = useState({});
  const [exchangeRate, setExchangeRate] = useState('83.0');

  const resetState = () => {
    setWizardData(null);
    setError(null);
    setResolvedIssues({});
    setNameMappings({});
    setExchangeRate('83.0');
    setTier2Currency('INR');
    setTier2State('default');
    setShowAutoFixes(false);
    setShowResolved(false);
    setIsImporting(false);
  };

  const processSessionData = async () => {
    setUploading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/groups/${groupId}/imports/${sessionId}/process`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setWizardData(response.data);
      setUploading(false);
    } catch (err) {
      console.error('Process Error:', err);
      setError(err.response?.data?.error || 'Failed to process CSV file.');
      setUploading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && sessionId) {
      resetState();
      processSessionData();
    }
  }, [isOpen, sessionId]);

  if (!isOpen) return null;

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleFileSelection(e.dataTransfer.files[0]);
  };
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) handleFileSelection(e.target.files[0]);
  };

  const handleFileSelection = (selectedFile) => {
    if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
      setError('Please upload a valid CSV file (.csv only)');
      return;
    }
    setFile(selectedFile);
    resetState();
  };

  const handleClose = () => {
    resetState();
    setFile(null);
    onClose();
  };

  const handleResolve = (issueId, action, customData = null) => {
    setResolvedIssues(prev => {
      const updates = { ...prev, [issueId]: { action, customData } };

      // Bulk resolve ambiguous dates if one is resolved
      if (action === 'SET_DATE') {
        const isDDMM = customData.split('-')[0].length === 2 && parseInt(customData.split('-')[0]) > 12 === false; 
        wizardData.issues.forEach(i => {
          if (i.id !== issueId && i.type === 'AMBIGUOUS_DATE' && !prev[i.id]) {
            updates[i.id] = { action: 'SET_DATE', customData: isDDMM ? i.interp1 : i.interp2 };
          }
        });
      }

      // Bulk resolve guest assignments
      if (action === 'ASSIGN_GUEST_SHARE') {
        const { guests, assignedTo } = customData;
        wizardData.issues.forEach(i => {
          if (i.id !== issueId && i.type === 'GUEST_IN_SPLIT' && !prev[i.id]) {
            const isSameGuests = JSON.stringify(i.unknownNames) === JSON.stringify(guests);
            if (isSameGuests) {
              updates[i.id] = { action: 'ASSIGN_GUEST_SHARE', customData };
            }
          }
        });
      }

      // Bulk resolve convert to member
      if (action === 'CONVERT_GUEST_TO_MEMBER') {
        const guestNames = customData.map(g => g.name);
        wizardData.issues.forEach(i => {
          if (i.id !== issueId && i.type === 'GUEST_IN_SPLIT' && !prev[i.id]) {
            const isSameGuests = JSON.stringify(i.unknownNames) === JSON.stringify(guestNames);
            if (isSameGuests) {
              updates[i.id] = { action: 'CONVERT_GUEST_TO_MEMBER', customData };
            }
          }
        });
      }

      return updates;
    });
  };



  const importToDatabase = async () => {
    if (!wizardData || !groupId) return;
    
    // Check if Tier 4 are resolved
    const unresolved = wizardData.issues.filter(i => i.tier === 4 && !resolvedIssues[i.id]);
    if (unresolved.length > 0) {
      setError(`Please resolve all ${unresolved.length} flagged issues before importing.`);
      return;
    }

    setIsImporting(true);
    setError(null);
    
    // Apply Tier 2 currency overrides
    let validRowsMutable = wizardData.validRows.map(r => {
      // Apply tier 2 changes
      if (!r.currency || r.currency === '') {
        return { ...r, currency: tier2Currency };
      }
      return r;
    });

    const finalExpenses = [];
    const finalSettlements = [];
    const rowsToDiscard = new Set();

    const guestsToConvert = new Map();

    // Apply resolutions
    wizardData.issues.forEach(issue => {
      if (issue.tier < 3) return;
      const resolution = resolvedIssues[issue.id];
      if (!resolution) return;

      if (resolution.action === 'CONVERT_GUEST_TO_MEMBER') {
         resolution.customData.forEach(g => guestsToConvert.set(g.name, g.email));
         finalExpenses.push(issue.rowData);
         return;
      }

      let row = { ...issue.rowData };

      if (issue.type === 'UNKNOWN_MEMBER_NAME') {
        row.paid_by = nameMappings[row.paid_by] || row.paid_by;
      }
      if (issue.type === 'FOREIGN_CURRENCY') {
        row.amount = parseFloat(row.amount) * parseFloat(exchangeRate);
        row.currency = 'INR';
      }

      switch (resolution.action) {
        case 'APPROVE':
        case 'KEEP_AS_EXPENSE':
        case 'CONFIRM_REFUND':
          finalExpenses.push(row);
          break;
        case 'KEEP_THIS':
          finalExpenses.push(row);
          rowsToDiscard.add(issue.pairId);
          break;
        case 'SET_PAYER':
          row.paid_by = resolution.customData;
          finalExpenses.push(row);
          break;
        case 'SET_DATE':
          row.date = resolution.customData;
          finalExpenses.push(row);
          break;
        case 'FIX_AMOUNT':
          row.amount = parseFloat(resolution.customData);
          finalExpenses.push(row);
          break;
        case 'FIX_PERCENTAGE':
          row.split_details = resolution.customData;
          finalExpenses.push(row);
          break;
        case 'CONVERT_SETTLEMENT':
          finalSettlements.push(row);
          break;
        case 'KEEP_PAIR': {
          // pairRowData is naturally handled by validRows or its own issue resolution
          finalExpenses.push(row);
          break;
        }
        case 'KEEP_PAIR_ONLY': {
          // pairRowData is kept, but this row is skipped
          break;
        }
        case 'SKIP_BOTH': {
          // Skip this row and ensure pair is discarded
          rowsToDiscard.add(issue.pairId);
          break;
        }
        case 'REMOVE_FROM_SPLIT': {
          // Remove the offending member from split_with
          const memberToRemove = resolution.customData;
          const currentSplit = (row.split_with || '').split(';').map(s => s.trim()).filter(s => s && s !== memberToRemove);
          row.split_with = currentSplit.join(';');
          finalExpenses.push(row);
          break;
        }
        case 'ASSIGN_GUEST_SHARE': {
          const { guests, assignedTo } = resolution.customData;
          const participants = (row.split_with || '').split(';').map(s => s.trim()).filter(s => s);
          const newSplitWith = participants.filter(p => !guests.includes(p));
          
          if (!newSplitWith.includes(assignedTo)) {
            newSplitWith.push(assignedTo);
          }
          row.split_with = newSplitWith.join(';');

          if (row.split_details) {
            const parts = row.split_details.split(';');
            let guestSum = 0;
            const newDetails = [];
            let assigneeAmount = 0;

            for (const part of parts) {
              const matchName = part.match(/([A-Za-z\s]+)/);
              const matchVal = part.match(/(\d+(\.\d+)?)/);
              if (matchName && matchVal) {
                const name = matchName[1].trim();
                const val = parseFloat(matchVal[1]);
                if (guests.includes(name)) {
                  guestSum += val;
                } else if (name === assignedTo) {
                  assigneeAmount += val;
                } else {
                  newDetails.push(`${name}: ${val}`);
                }
              }
            }
            newDetails.push(`${assignedTo}: ${assigneeAmount + guestSum}`);
            row.split_details = newDetails.join(';');
          } else {
            const numOriginal = participants.length;
            const shareAmount = parseFloat(row.amount) / numOriginal;
            let assigneeShares = 1; // if assignee was in original split
            if (!participants.includes(assignedTo)) assigneeShares = 0; // if assigned to someone not originally in split
            assigneeShares += guests.length; // plus the guests' shares

            const newDetails = [];
            for (const p of newSplitWith) {
              if (p === assignedTo) {
                 newDetails.push(`${p}: ${shareAmount * assigneeShares}`);
              } else {
                 newDetails.push(`${p}: ${shareAmount}`);
              }
            }
            row.split_type = 'EXACT';
            row.split_details = newDetails.join(';');
          }

          finalExpenses.push(row);
          break;
        }
        // DELETE / SKIP: do nothing
      }
    });

    const filteredValidRows = validRowsMutable.filter(r => !rowsToDiscard.has(r.rowId));
    const filteredFinalExpenses = finalExpenses.filter(r => !rowsToDiscard.has(r.rowId));
    const combinedExpenses = [...filteredValidRows, ...filteredFinalExpenses];
    
    const deleteExpenseIds = Array.from(rowsToDiscard)
      .filter(id => typeof id === 'string' && id.startsWith('db_'))
      .map(id => parseInt(id.replace('db_', '')));

    try {
      const token = localStorage.getItem('token');
      
      await axios.post(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/groups/${groupId}/expenses/bulk`, {
        expenses: combinedExpenses,
        settlements: finalSettlements,
        deleteExpenseIds
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (onUploadSuccess) onUploadSuccess();
      handleClose();
    } catch (err) {
      console.error('DB Import Error:', err);
      setError(err.response?.data?.error || 'Failed to import CSV to database.');
      setIsImporting(false);
    }
  };

  const convertedGuestNames = new Set();
  Object.values(resolvedIssues).forEach(res => {
    if (res.action === 'CONVERT_GUEST_TO_MEMBER' && Array.isArray(res.customData)) {
       res.customData.forEach(name => convertedGuestNames.add(name));
    }
  });

  const convertedMembers = Array.from(convertedGuestNames).map((name, idx) => ({
    id: `converted_${idx}`,
    name: name
  }));

  const groupMembers = [...(wizardData?.groupMembersList || []), ...convertedMembers];

  const renderIssueCard = (issue) => {
    const isResolved = !!resolvedIssues[issue.id];
    const resolution = resolvedIssues[issue.id];
    const r = issue.rowData;

    if (isResolved) {
      if (!showResolved) return null;
      const actionLabels = {
        'APPROVE': 'Approved as-is', 'KEEP_AS_EXPENSE': 'Kept as Expense',
        'CONVERT_SETTLEMENT': 'Reclassified as Settlement', 'DELETE': 'Skipped / Deleted',
        'SET_PAYER': `Payer set to "${resolution.customData}"`,
        'SET_DATE': `Date set to ${resolution.customData}`,
        'FIX_AMOUNT': `Amount corrected to ₹${resolution.customData}`,
        'FIX_PERCENTAGE': 'Percentages corrected',
        'CONFIRM_REFUND': 'Confirmed as Refund',
        'KEEP_THIS': 'Kept this row only', 'KEEP_PAIR': 'Kept both rows',
        'REMOVE_FROM_SPLIT': `Removed "${resolution.customData}" from split`,
        'ASSIGN_GUEST_SHARE': resolution.customData?.assignedTo ? `Assigned guest's share to ${resolution.customData.assignedTo}` : 'Assigned guest share',
        'CONVERT_GUEST_TO_MEMBER': 'Converted guest to member & kept in split',
      };
      return (
        <div key={issue.id} className="issue-card resolved">
          <div className="resolved-header">
            <span className="resolved-check">✅</span>
            <strong>Row {issue.rowId}</strong>
            <span className="resolved-tag">{issue.type.replace(/_/g,' ')}</span>
          </div>
          <div className="resolved-status">
            {actionLabels[resolution.action] || resolution.action}
            <button className="btn-undo" onClick={() => handleResolve(issue.id, null)}>Undo</button>
          </div>
        </div>
      );
    }

    const typeColors = {
      MISSING_PAYER: '#e74c3c', SETTLEMENT_AS_EXPENSE: '#9b59b6', DEPOSIT_AS_EXPENSE: '#8e44ad',
      MEMBER_AFTER_LEAVE: '#e67e22', GUEST_IN_SPLIT: '#d35400',
      EXACT_DUPLICATE: '#c0392b', CONFLICTING_DUPLICATE: '#922b21',
      PERCENTAGE_NOT_100: '#f39c12', ZERO_AMOUNT: '#7f8c8d', NEGATIVE_AMOUNT: '#27ae60',
      AMBIGUOUS_DATE: '#2980b9',
    };
    const badgeColor = typeColors[issue.type] || '#555';

    const renderActions = () => {
      switch (issue.type) {

        case 'MISSING_PAYER':
          return (
            <div className="action-group">
              <p className="action-hint">Who paid for this expense?</p>
              <div className="payer-grid">
                {groupMembers.map(m => (
                  <button key={m.id} className="member-chip" onClick={() => handleResolve(issue.id, 'SET_PAYER', m.name)}>
                    {m.name}
                  </button>
                ))}
              </div>
              <button className="btn-delete" onClick={() => handleResolve(issue.id, 'DELETE')}>Skip this expense</button>
            </div>
          );

        case 'SETTLEMENT_AS_EXPENSE':
        case 'DEPOSIT_AS_EXPENSE':
          return (
            <div className="action-group">
              <p className="action-hint">{issue.type === 'DEPOSIT_AS_EXPENSE' ? 'This looks like a deposit, not a shared expense.' : 'This looks like a direct payment/settlement.'}</p>
              <div className="btn-row">
                <button className="btn-convert" onClick={() => handleResolve(issue.id, 'CONVERT_SETTLEMENT')}>Reclassify as Settlement</button>
                <button className="btn-approve" onClick={() => handleResolve(issue.id, 'KEEP_AS_EXPENSE')}>Keep as Expense</button>
                <button className="btn-delete" onClick={() => handleResolve(issue.id, 'DELETE')}>Skip Row</button>
              </div>
            </div>
          );

        case 'MEMBER_AFTER_LEAVE': {
          const offender = issue.memberName || 'that member';
          return (
            <div className="action-group">
              <p className="action-hint">
                <strong>{offender}</strong> was not a group member on this expense date.
              </p>
              <div className="btn-row">
                <button
                  className="btn-remove-member"
                  onClick={() => handleResolve(issue.id, 'REMOVE_FROM_SPLIT', offender)}
                >
                  ✂️ Remove {offender} from this split
                </button>
                <button className="btn-approve" onClick={() => handleResolve(issue.id, 'APPROVE')}>
                  Keep anyway
                </button>
                <button className="btn-delete" onClick={() => handleResolve(issue.id, 'DELETE')}>
                  Skip expense
                </button>
              </div>
            </div>
          );
        }

        case 'GUEST_IN_SPLIT': {
          const names = issue.unknownNames ? issue.unknownNames.join(', ') : 'Guest(s) / Unknown person(s)';
          return (
            <div className="action-group">
              <p className="action-hint">
                <strong>{names}</strong> is a Guest (or unknown). Guests cannot have direct financial balances in the system.
              </p>
              
              <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginBottom: '10px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 'bold', color: '#444' }}>Option 1: Assign guest's share to someone</p>
                <div className="input-row">
                  <select 
                    className="fix-input" 
                    onChange={(e) => {
                      if(e.target.value) {
                        handleResolve(issue.id, 'ASSIGN_GUEST_SHARE', { guests: issue.unknownNames, assignedTo: e.target.value });
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>-- Select member --</option>
                    {groupMembers.map(m => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginBottom: '10px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 'bold', color: '#444' }}>Option 2: Divide guest's share equally among rest</p>
                <button className="btn-approve" onClick={() => handleResolve(issue.id, 'APPROVE')}>
                  ✂️ Remove Guest & Divide share
                </button>
              </div>

              <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginBottom: '10px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 'bold', color: '#444' }}>Option 3: Convert guest to Member</p>
                <button className="btn-solid-green" onClick={() => setGuestConvertModal({ isOpen: true, issueId: issue.id, unknownNames: issue.unknownNames })}>
                  Make Member
                </button>
              </div>

              <button className="btn-delete" onClick={() => handleResolve(issue.id, 'DELETE')}>
                Skip this expense entirely
              </button>
            </div>
          );
        }

        case 'EXACT_DUPLICATE':
          return (
            <div className="action-group">
              <p className="action-hint">This row is an exact duplicate of {issue.isDbConflict ? 'an existing expense' : `Row ${issue.pairId}`}. Could be a double-entry.</p>
              <div className="dup-compare">
                <div className="dup-row"><strong>This row:</strong> {r.description} | ₹{r.amount} | Paid by {r.paid_by}</div>
                {issue.pairRowData && <div className="dup-row pair"><strong>{issue.isDbConflict ? 'Existing' : `Row ${issue.pairId}`}:</strong> {issue.pairRowData.description} | ₹{issue.pairRowData.amount} | Paid by {issue.pairRowData.paid_by}</div>}
              </div>
              <div className="btn-row">
                <button className="btn-approve" onClick={() => handleResolve(issue.id, 'KEEP_THIS')}>Keep One (This row)</button>
                <button className="btn-secondary" onClick={() => handleResolve(issue.id, 'KEEP_PAIR')}>Keep both</button>
                <button className="btn-delete" onClick={() => handleResolve(issue.id, 'SKIP_BOTH')}>Skip both</button>
              </div>
            </div>
          );

        case 'CONFLICTING_DUPLICATE':
          return (
            <div className="action-group">
              <p className="action-hint">Similar event, different amount or payer. Which is correct?</p>
              <div className="dup-compare">
                <div className="dup-row"><strong>This row:</strong> {r.description} | ₹{r.amount} | Paid by {r.paid_by} | {r.date}</div>
                {issue.pairRowData && <div className="dup-row pair"><strong>{issue.isDbConflict ? 'Existing' : `Row ${issue.pairId}`}:</strong> {issue.pairRowData.description} | ₹{issue.pairRowData.amount} | Paid by {issue.pairRowData.paid_by}</div>}
              </div>
              <div className="btn-row">
                <button className="btn-approve" onClick={() => handleResolve(issue.id, 'KEEP_THIS')}>Select This Row</button>
                <button className="btn-approve" onClick={() => handleResolve(issue.id, 'KEEP_PAIR_ONLY')}>Select {issue.isDbConflict ? 'Existing' : `Row ${issue.pairId}`}</button>
                <button className="btn-secondary" onClick={() => handleResolve(issue.id, 'KEEP_PAIR')}>Keep both</button>
                <button className="btn-delete" onClick={() => handleResolve(issue.id, 'SKIP_BOTH')}>Skip both</button>
              </div>
            </div>
          );

        case 'PERCENTAGE_NOT_100': {
          const currentPct = r.split_details || '';
          return (
            <div className="action-group">
              <p className="action-hint">Current: <code>{currentPct}</code> — percentages don't add up to 100%.</p>
              <div className="input-row">
                <input
                  type="text"
                  placeholder="e.g. Aisha 30; Rohan 40; Priya 30"
                  defaultValue={currentPct}
                  onBlur={(e) => e.target.value && handleResolve(issue.id, 'FIX_PERCENTAGE', e.target.value)}
                  className="fix-input"
                />
                <button className="btn-delete" onClick={() => handleResolve(issue.id, 'DELETE')}>Skip Row</button>
              </div>
            </div>
          );
        }

        case 'ZERO_AMOUNT':
          return (
            <div className="action-group">
              <p className="action-hint">Amount is ₹0. Enter the correct amount or skip.</p>
              <div className="input-row">
                <input
                  type="number"
                  placeholder="Enter correct amount"
                  onBlur={(e) => e.target.value && handleResolve(issue.id, 'FIX_AMOUNT', e.target.value)}
                  className="fix-input"
                />
                <button className="btn-delete" onClick={() => handleResolve(issue.id, 'DELETE')}>Skip Row</button>
              </div>
            </div>
          );

        case 'NEGATIVE_AMOUNT':
          return (
            <div className="action-group">
              <p className="action-hint">Amount is negative (₹{r.amount}). Could be a refund or data error.</p>
              <div className="btn-row">
                <button className="btn-approve" onClick={() => handleResolve(issue.id, 'CONFIRM_REFUND')}>Confirm — it's a refund</button>
                <button className="btn-delete" onClick={() => handleResolve(issue.id, 'DELETE')}>Skip Row</button>
              </div>
            </div>
          );

        case 'AMBIGUOUS_DATE':
          return (
            <div className="action-group">
              <p className="action-hint">Date <code>{r.date}</code> is ambiguous. Pick the correct interpretation:</p>
              <div className="btn-row">
                <button className="btn-date" onClick={() => handleResolve(issue.id, 'SET_DATE', issue.interp1)}>
                  📅 {issue.interp1} (DD-MM, standard)
                </button>
                <button className="btn-date" onClick={() => handleResolve(issue.id, 'SET_DATE', issue.interp2)}>
                  📅 {issue.interp2} (MM-DD interpretation)
                </button>
                <button className="btn-delete" onClick={() => handleResolve(issue.id, 'DELETE')}>Skip Row</button>
              </div>
            </div>
          );

        default:
          return (
            <div className="btn-row">
              <button className="btn-approve" onClick={() => handleResolve(issue.id, 'APPROVE')}>Approve</button>
              <button className="btn-delete" onClick={() => handleResolve(issue.id, 'DELETE')}>Skip Row</button>
            </div>
          );
      }
    };

    return (
      <div key={issue.id} className="issue-card">
        <div className="issue-header">
          <span className="issue-badge" style={{ background: badgeColor }}>{issue.type.replace(/_/g,' ')}</span>
          <strong>Row {issue.rowId}</strong>
        </div>
        <p className="issue-msg">{issue.message}</p>
        <div className="issue-data">
          <span>📝 {r.description}</span>
          <span>💰 ₹{r.amount} {r.currency}</span>
          <span>👤 {r.paid_by || '—'}</span>
          <span>📅 {r.date}</span>
          {r.notes && <span>🗒 {r.notes}</span>}
        </div>
        {renderActions()}
      </div>
    );
  };

  return (
    <ModalOverlay>
      <div className="modal-content">
        <button className="close-btn" onClick={handleClose}>✖</button>
        
        <h1 className="page-title">CSV Anomaly Engine (4-Tier)</h1>
        <p className="page-subtitle">Automatically detecting inconsistent formats, duplicates, and timeline errors exactly as specified.</p>

        {error && <div className="error-alert">{error}</div>}

        {!wizardData && !uploading && (
          <div className={`drop-zone ${isDragging ? 'dragging' : ''}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
            <input type="file" accept=".csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
            <h3>Drop expenses_export.csv here</h3>
            <p>Scanning for 21 anomalies across 42 rows...</p>
          </div>
        )}

        {!wizardData && uploading && (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <div className="spinner"></div>
            <p>Processing CSV Anomalies...</p>
          </div>
        )}

        {wizardData && (
          <div className="wizard-layout">
            <div className="status-grid">
              <div className="status-item">
                <span className="label">Total Rows</span>
                <span className="value">{wizardData.totalRows}</span>
              </div>
              <div className="status-item">
                <span className="label">Auto-Fixed (Tier 1)</span>
                <span className="value" style={{color: '#3498db'}}>{wizardData.autoFixes.length}</span>
              </div>
              <div className="status-item">
                <span className="label">Issues to Resolve</span>
                <span className="value" style={{color: '#e74c3c'}}>{wizardData.issues.filter(i => i.tier >= 3 && !resolvedIssues[i.id]).length}</span>
              </div>
            </div>

            <div className="right-panel">
              {wizardData.autoFixes.length > 0 && (
                <div className="section-block">
                  <div className="section-header">
                    <span>✅ Summary Log — Tier 1 Auto-Fixed ({wizardData.autoFixes.length})</span>
                    <button onClick={() => setShowAutoFixes(!showAutoFixes)} className="toggle-btn">
                      {showAutoFixes ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {showAutoFixes && (
                    <div className="autofix-list">
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: '#f0fdf4', textAlign: 'left' }}>
                            <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Row</th>
                            <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Anomaly</th>
                            <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Description</th>
                            <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Fixed Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {wizardData.autoFixes.map((af, i) => (
                            <tr key={i}>
                              <td style={{ padding: '8px', borderBottom: '1px solid #ddd', fontWeight: 'bold' }}>R{af.rowNumber}</td>
                              <td style={{ padding: '8px', borderBottom: '1px solid #ddd', color: '#e67e22', fontFamily: 'monospace', fontSize: '12px' }}>{af.anomalyType}</td>
                              <td style={{ padding: '8px', borderBottom: '1px solid #ddd', color: '#555' }}>{af.description}</td>
                              <td style={{ padding: '8px', borderBottom: '1px solid #ddd', color: '#2ecc71', fontWeight: 'bold', fontFamily: 'monospace' }}>{af.suggestedFix}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {wizardData.issues.filter(i => i.tier === 2).length > 0 && tier2State !== 'dismissed' && (
                <div className="dark-banner">
                  <div className="dark-banner-left">
                    <span style={{color: '#f39c12', fontSize: '16px'}}>⚠️</span>
                    <span>
                      <strong>{wizardData.issues.filter(i => i.tier === 2).length} row{wizardData.issues.filter(i => i.tier === 2).length > 1 ? 's' : ''}</strong> had missing currency — defaulted to <strong>{tier2Currency}</strong>.
                    </span>
                  </div>
                  <div className="dark-banner-actions">
                    {tier2State === 'default' ? (
                      <button className="btn-solid-orange" onClick={() => setTier2State('editing')}>Undo</button>
                    ) : (
                      <>
                        <select 
                          className="dark-select" 
                          value={tier2Currency} 
                          onChange={(e) => setTier2Currency(e.target.value)}
                        >
                          <option value="INR">INR</option>
                          <option value="USD">USD</option>
                          <option value="EUR">EUR</option>
                          <option value="GBP">GBP</option>
                          <option value="AUD">AUD</option>
                          <option value="CAD">CAD</option>
                        </select>
                        <button className="btn-solid-green" onClick={() => setTier2State('default')}>Save</button>
                      </>
                    )}
                    <button className="btn-close-dark" onClick={() => setTier2State('dismissed')}>✕</button>
                  </div>
                </div>
              )}

              {wizardData.issues.filter(i => i.tier === 3).length > 0 && (
                <div className="bulk-section">
                  <h3>Tier 3: Bulk Review Required</h3>
                  <div className="bulk-card">
                    <label>USD to INR Exchange Rate: </label>
                    <input type="number" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} />
                  </div>
                </div>
              )}

              {wizardData.issues.filter(i => i.tier === 4).length > 0 && (
                <div className="issues-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Tier 4: Individual Review Required</h3>
                    <label style={{ fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input 
                        type="checkbox" 
                        checked={showResolved} 
                        onChange={(e) => setShowResolved(e.target.checked)} 
                        style={{ cursor: 'pointer' }}
                      />
                      Show resolved issues
                    </label>
                  </div>
                  <div className="issues-list">
                    {wizardData.issues.filter(i => i.tier === 4).map(renderIssueCard)}
                  </div>
                </div>
              )}

              <div className="wizard-actions">
                <button className="btn-reset" onClick={resetState} disabled={isImporting}>Cancel</button>
                <button
                  className="btn-import"
                  onClick={importToDatabase}
                  disabled={isImporting || wizardData.issues.filter(i => i.tier === 4 && !resolvedIssues[i.id]).length > 0}
                >
                  {isImporting ? 'Processing...' : `Import ${wizardData.validRows.length} rows`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Guest Convert Modal */}
      {guestConvertModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 10000, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="modal-content" style={{ width: '400px', background: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>Add Guest as Member</h3>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
              Enter email addresses for the guests you want to convert to members. They will receive an invitation email.
            </p>
            {guestConvertModal.unknownNames.map((name, i) => (
              <div key={name} style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{name}'s Email:</label>
                <input 
                  type="email" 
                  id={`modal-guest-email-${i}`} 
                  className="auth-input" 
                  style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}
                  placeholder={`${name}@example.com`} 
                />
              </div>
            ))}
            <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn-secondary" style={{ padding: '8px 16px', border: 'none', background: '#eee', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setGuestConvertModal({ isOpen: false, issueId: null, unknownNames: [] })}>
                Cancel
              </button>
              <button id="add-member-btn" className="btn-primary" style={{ padding: '8px 16px', border: 'none', background: '#00b894', color: 'white', borderRadius: '6px', cursor: 'pointer' }} onClick={async (e) => {
                const btn = e.currentTarget;
                if (btn.disabled) return;
                
                const guestData = guestConvertModal.unknownNames.map((name, i) => {
                  const emailInput = document.getElementById(`modal-guest-email-${i}`);
                  return { name, email: emailInput?.value?.trim() || '' };
                });
                if (guestData.some(g => !g.email)) {
                  alert("Please enter an email address for all guests to invite them.");
                  return;
                }

                btn.disabled = true;
                const originalText = btn.innerText;
                btn.innerText = 'Inviting...';

                try {
                  const token = localStorage.getItem('token');
                  await axios.post(`${import.meta.env.VITE_API_URL || "http://localhost:3000"}/api/groups/${groupId}/guests/convert`, {
                    guests: guestData
                  }, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  
                  handleResolve(guestConvertModal.issueId, 'CONVERT_GUEST_TO_MEMBER', guestData);
                  setGuestConvertModal({ isOpen: false, issueId: null, unknownNames: [] });
                } catch (err) {
                  console.error('Failed to convert guest:', err);
                  alert('Failed to invite guest: ' + (err.response?.data?.error || err.message));
                  btn.disabled = false;
                  btn.innerText = originalText;
                }
              }}>
                Add Member
              </button>
            </div>
          </div>
        </div>
      )}

    </ModalOverlay>
  );
};

const ModalOverlay = styled.div`
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background-color: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; z-index: 1000;
  .modal-content { background: #fff; width: 950px; max-width: 95vw; max-height: 90vh; overflow-y: auto; padding: 40px; border-radius: 16px; position: relative; }
  .close-btn { position: absolute; top: 20px; right: 20px; border: none; background: transparent; font-size: 24px; cursor: pointer; }
  .page-title { margin-bottom: 5px; }
  .page-subtitle { color: #666; margin-bottom: 20px; }
  .error-alert { background: #ffeaea; color: red; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-weight: bold; }
  
  /* Dark Banner UI for Tier 2 */
  .dark-banner {
    background: #1a1a24;
    color: #e2e8f0;
    padding: 12px 20px;
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
    border-left: 4px solid #f59e0b;
    font-size: 14px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  .dark-banner-left { display: flex; align-items: center; gap: 12px; }
  .dark-banner-actions { display: flex; align-items: center; gap: 10px; }
  .btn-solid-orange {
    background: #f59e0b; color: white; border: none; padding: 6px 16px;
    border-radius: 6px; font-weight: 600; cursor: pointer; transition: 0.2s;
  }
  .btn-solid-orange:hover { background: #d97706; }
  .btn-solid-green {
    background: #10b981; color: white; border: none; padding: 6px 16px;
    border-radius: 6px; font-weight: 600; cursor: pointer; transition: 0.2s;
  }
  .btn-solid-green:hover { background: #059669; }
  .btn-close-dark {
    background: transparent; color: #64748b; border: 1px solid #334155;
    border-radius: 6px; padding: 5px 10px; cursor: pointer; display: flex; align-items: center;
  }
  .btn-close-dark:hover { color: #f8fafc; border-color: #64748b; }
  .dark-select {
    background: #334155; color: white; border: 1px solid #475569;
    padding: 6px 12px; border-radius: 6px; outline: none; font-weight: 500; cursor: pointer;
  }
  .dark-select:focus { border-color: #3b82f6; }

  .drop-zone { background: #fdfdf5; padding: 80px; text-align: center; border: 2px dashed #ddd; border-radius: 16px; cursor: pointer; }
  .status-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px; }
  .status-item { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #eee; }
  .status-item .label { display: block; font-size: 12px; color: #888; text-transform: uppercase; }
  .status-item .value { font-size: 24px; font-weight: bold; margin-top: 5px;}
  
  .autofix-section { margin-bottom: 25px; }
  .toggle-btn { background: #eef2f5; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; color: #34495e; font-weight: bold; }
  .autofix-log { background: #f8f9fa; padding: 15px 30px; border-radius: 8px; margin-top: 10px; font-family: monospace; font-size: 13px; color: #555; }
  
  .bulk-section { background: #e3f2fd; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
  .bulk-card { background: white; padding: 15px; border-radius: 8px; display: flex; align-items: center; gap: 15px; }
  .bulk-card input { padding: 8px; border: 1px solid #ccc; border-radius: 4px; width: 100px; }

  /* Issue cards */
  .issues-section { margin-bottom: 20px; }
  .issues-section h3 { font-size: 15px; color: #c0392b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
  .issue-card {
    background: #fff; border: 1px solid #e8e0f0; padding: 20px 22px;
    margin-bottom: 14px; border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    transition: box-shadow 0.2s;
  }
  .issue-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.09); }
  .issue-card.resolved {
    background: #f6fef8; border-color: #a8e6bf; opacity: 0.9;
  }
  .issue-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .issue-badge {
    display: inline-block; padding: 3px 10px; border-radius: 20px;
    font-size: 11px; font-weight: 700; color: white; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .issue-msg { font-size: 14px; margin: 6px 0 10px; color: #444; font-weight: 500; line-height: 1.4; }
  .issue-data {
    display: flex; flex-wrap: wrap; gap: 10px; background: #f8f8fc;
    padding: 10px 14px; border-radius: 8px; font-size: 13px; color: #555;
    margin-bottom: 14px; font-family: monospace;
  }
  .issue-data span { white-space: nowrap; }

  /* Resolved state */
  .resolved-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .resolved-check { font-size: 16px; }
  .resolved-tag { font-size: 11px; background: #e8f5e9; color: #2e7d32; padding: 2px 8px; border-radius: 10px; }
  .resolved-status { display: flex; align-items: center; gap: 10px; color: #27ae60; font-weight: 600; font-size: 14px; }
  .btn-undo { background: transparent; border: 1px solid #bbb; border-radius: 5px; padding: 3px 10px; cursor: pointer; font-size: 12px; color: #666; }
  .btn-undo:hover { background: #f5f5f5; }

  /* Action groups */
  .action-group { margin-top: 4px; }
  .action-hint { font-size: 13px; color: #666; margin: 0 0 10px; font-style: italic; }
  .action-hint code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
  .btn-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 6px; }

  /* Buttons */
  .btn-approve { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; padding: 8px 14px; border-radius: 7px; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.15s; }
  .btn-approve:hover { background: #c8e6c9; }
  .btn-delete { background: #fdecea; color: #c62828; border: 1px solid #ef9a9a; padding: 8px 14px; border-radius: 7px; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.15s; }
  .btn-delete:hover { background: #ffcdd2; }
  .btn-convert { background: #e3f2fd; color: #1565c0; border: 1px solid #90caf9; padding: 8px 14px; border-radius: 7px; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.15s; }
  .btn-convert:hover { background: #bbdefb; }
  .btn-secondary { background: #f3e5f5; color: #6a1b9a; border: 1px solid #ce93d8; padding: 8px 14px; border-radius: 7px; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.15s; }
  .btn-secondary:hover { background: #e1bee7; }
  .btn-date { background: #e1f5fe; color: #01579b; border: 1px solid #81d4fa; padding: 9px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.15s; }
  .btn-date:hover { background: #b3e5fc; }
  .btn-remove-member { background: #fff3e0; color: #e65100; border: 1px solid #ffcc80; padding: 8px 14px; border-radius: 7px; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.15s; }
  .btn-remove-member:hover { background: #ffe0b2; }

  /* Payer picker */
  .payer-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
  .member-chip {
    background: #f0f4ff; color: #3949ab; border: 1px solid #9fa8da;
    padding: 7px 16px; border-radius: 20px; cursor: pointer; font-weight: 600; font-size: 13px;
    transition: all 0.15s;
  }
  .member-chip:hover { background: #3949ab; color: white; transform: translateY(-1px); }

  /* Duplicate comparison */
  .dup-compare { background: #fafafa; border: 1px solid #eee; border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
  .dup-row { padding: 10px 14px; font-size: 13px; color: #444; }
  .dup-row.pair { background: #fff8e1; border-top: 1px solid #ffe082; }

  /* Fix inputs */
  .input-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .fix-input { padding: 9px 12px; border: 1px solid #ccc; border-radius: 7px; font-size: 13px; flex: 1; min-width: 200px; }
  .fix-input:focus { border-color: #7c4dff; outline: none; box-shadow: 0 0 0 2px rgba(124,77,255,0.15); }

  /* Section block (Tier 1 log) */
  .section-block { background: #f8fffe; border: 1px solid #b2dfdb; border-radius: 10px; padding: 16px; margin-bottom: 20px; }
  .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-weight: 600; color: #00695c; }
  .autofix-list { margin-top: 8px; }

  .wizard-actions { margin-top: 30px; display: flex; gap: 16px; }
  .wizard-actions button { padding: 14px; font-size: 15px; border: none; border-radius: 10px; cursor: pointer; flex: 1; font-weight: 700; transition: all 0.2s; }
  .btn-reset { background: #f1f1f1; color: #555; }
  .btn-reset:hover { background: #e0e0e0; }
  .btn-import { background: linear-gradient(135deg, #00b894, #00cec9); color: white; }
  .btn-import:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,184,148,0.4); }
  .btn-import:disabled { background: #b2dfdb; cursor: not-allowed; transform: none; box-shadow: none; }
`;

export default InteractiveCSVWizard;

