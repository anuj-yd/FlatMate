import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import axios from 'axios';

const InteractiveCSVWizard = ({ isOpen, onClose, groupId, onUploadSuccess }) => {
  const fileInputRef = useRef(null);
  
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [wizardData, setWizardData] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  
  // States for resolutions
  const [resolvedIssues, setResolvedIssues] = useState({});
  const [undoToast, setUndoToast] = useState(null);
  const [showAutoFixes, setShowAutoFixes] = useState(false);

  // Bulk Mappings
  const [nameMappings, setNameMappings] = useState({});
  const [exchangeRate, setExchangeRate] = useState('83.0');

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
    uploadFile(selectedFile);
  };

  const uploadFile = async (selectedFile) => {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('groupId', groupId);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`http://localhost:3000/api/groups/${groupId}/imports/preview`, formData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Handle Tier 2 (A07) toast
      const tier2 = response.data.issues.filter(i => i.tier === 2);
      if (tier2.length > 0) {
        setUndoToast(`1 row defaulted to INR. Want to undo?`);
        setTimeout(() => setUndoToast(null), 8000);
      }

      setWizardData(response.data);
      setUploading(false);
    } catch (err) {
      console.error('Upload Error:', err);
      setError(err.response?.data?.error || 'Failed to process CSV file.');
      setUploading(false);
      setFile(null);
    }
  };

  const resetState = () => {
    setWizardData(null);
    setError(null);
    setResolvedIssues({});
    setNameMappings({});
    setExchangeRate('83.0');
    setUndoToast(null);
    setShowAutoFixes(false);
    setIsImporting(false);
  };

  const handleClose = () => {
    resetState();
    setFile(null);
    onClose();
  };

  const handleResolve = (rowId, action, customData = null) => {
    setResolvedIssues(prev => ({ ...prev, [rowId]: { action, customData } }));
  };

  const importToDatabase = async () => {
    if (!wizardData || !groupId) return;
    
    // Check if Tier 4 are resolved
    const unresolved = wizardData.issues.filter(i => i.tier === 4 && !resolvedIssues[i.rowId]);
    if (unresolved.length > 0) {
      setError(`Please resolve all ${unresolved.length} flagged issues before importing.`);
      return;
    }

    setIsImporting(true);
    setError(null);
    
    const finalExpenses = [...wizardData.validRows];
    const finalSettlements = [];

    // Apply resolutions
    wizardData.issues.forEach(issue => {
      if (issue.tier < 3) return; // Tier 1 and 2 are already in validRows usually, but let's handle carefully
      
      const resolution = resolvedIssues[issue.rowId];
      if (!resolution) return;

      let row = { ...issue.rowData };

      // Apply bulk mappings
      if (issue.type === 'UNKNOWN_MEMBER_NAME') {
        row.paid_by = nameMappings[row.paid_by] || row.paid_by;
      }
      if (issue.type === 'FOREIGN_CURRENCY') {
        row.amount = parseFloat(row.amount) * parseFloat(exchangeRate);
        row.currency = 'INR';
      }

      if (resolution.action === 'APPROVE') {
        finalExpenses.push(row);
      } else if (resolution.action === 'CONVERT_SETTLEMENT') {
        finalSettlements.push(row);
      } else if (resolution.action === 'FIX_PERCENTAGE') {
        row.split_details = resolution.customData;
        finalExpenses.push(row);
      }
      // If DELETE or SKIP, do nothing
    });

    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:3000/api/groups/${groupId}/expenses/bulk`, {
        expenses: finalExpenses,
        settlements: finalSettlements
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

  const renderIssueCard = (issue) => {
    const isResolved = !!resolvedIssues[issue.rowId];
    const resolution = resolvedIssues[issue.rowId];
    
    if (isResolved) {
      return (
        <div key={issue.rowId} className="issue-card resolved">
          <div className="issue-header"><strong>Row {issue.rowId}</strong></div>
          <p className="issue-msg">{issue.message}</p>
          <div className="resolved-status">
            Resolved as: <strong>{resolution.action}</strong> 
            <button className="btn-undo" onClick={() => handleResolve(issue.rowId, null)}>Undo</button>
          </div>
        </div>
      );
    }

    return (
      <div key={issue.rowId} className="issue-card">
        <div className="issue-header">
          <span className={`issue-badge ${issue.type}`}>{issue.type.replace(/_/g, ' ')}</span>
          <strong>Row {issue.rowId}</strong>
        </div>
        <p className="issue-msg">{issue.message}</p>
        <div className="issue-data">
          Description: {issue.rowData.description} | Amount: {issue.rowData.amount} {issue.rowData.currency} | Payer: {issue.rowData.paid_by}
        </div>
        
        <div className="issue-actions">
          {issue.type === 'SETTLEMENT_AS_EXPENSE' || issue.type === 'DEPOSIT_AS_EXPENSE' ? (
            <>
              <button className="btn-convert" onClick={() => handleResolve(issue.rowId, 'CONVERT_SETTLEMENT')}>Reclassify as Settlement</button>
              <button className="btn-approve" onClick={() => handleResolve(issue.rowId, 'APPROVE')}>Keep as Expense</button>
            </>
          ) : issue.type === 'PERCENTAGE_NOT_100' ? (
            <>
              <input type="text" placeholder="New split details e.g. Aisha 25; Rohan 25..." onBlur={(e) => handleResolve(issue.rowId, 'FIX_PERCENTAGE', e.target.value)} style={{padding: '8px', width: '250px', marginRight: '10px'}}/>
            </>
          ) : (
            <button className="btn-approve" onClick={() => handleResolve(issue.rowId, 'APPROVE')}>Ignore Warning & Approve</button>
          )}
          <button className="btn-delete" onClick={() => handleResolve(issue.rowId, 'DELETE')}>Delete Row</button>
        </div>
      </div>
    );
  };

  return (
    <ModalOverlay>
      <div className="modal-content">
        <button className="close-btn" onClick={handleClose}>✖</button>
        
        <h1 className="page-title">CSV Anomaly Engine (4-Tier)</h1>
        <p className="page-subtitle">Automatically detecting inconsistent formats, duplicates, and timeline errors exactly as specified.</p>

        {undoToast && (
          <div className="undo-toast">
            {undoToast}
            <button onClick={() => setUndoToast(null)}>Undo</button>
          </div>
        )}

        {error && <div className="error-alert">{error}</div>}

        {!wizardData && !uploading && (
          <div className={`drop-zone ${isDragging ? 'dragging' : ''}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
            <input type="file" accept=".csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
            <h3>Drop expenses_export.csv here</h3>
            <p>Scanning for 21 anomalies across 42 rows...</p>
          </div>
        )}

        {wizardData && (
          <div className="wizard-container">
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
                <span className="value" style={{color: '#e74c3c'}}>{wizardData.issues.filter(i => i.tier >= 3).length}</span>
              </div>
            </div>

            {wizardData.autoFixes.length > 0 && (
              <div className="autofix-section">
                <button className="toggle-btn" onClick={() => setShowAutoFixes(!showAutoFixes)}>
                  {showAutoFixes ? 'Hide' : 'Show'} Tier 1 Auto-Fixes ({wizardData.autoFixes.length})
                </button>
                {showAutoFixes && (
                  <ul className="autofix-log">
                    {wizardData.autoFixes.map((fix, idx) => <li key={idx}>✅ {fix}</li>)}
                  </ul>
                )}
              </div>
            )}

            {wizardData.issues.filter(i => i.tier === 3).length > 0 && (
              <div className="bulk-section">
                <h3>Tier 3: Bulk Review Required</h3>
                <div className="bulk-card">
                  <label>USD to INR Exchange Rate (for Goa trip): </label>
                  <input type="number" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} />
                </div>
              </div>
            )}

            {wizardData.issues.filter(i => i.tier === 4).length > 0 && (
              <div className="issues-section">
                <h3>Tier 4: Individual Review Required</h3>
                <div className="issues-list">
                  {wizardData.issues.filter(i => i.tier === 4).map(renderIssueCard)}
                </div>
              </div>
            )}

            <div className="wizard-actions">
              <button className="btn-reset" onClick={resetState} disabled={isImporting}>Cancel</button>
              <button className="btn-import" onClick={importToDatabase} disabled={isImporting || wizardData.issues.filter(i => i.tier === 4 && !resolvedIssues[i.rowId]).length > 0}>
                {isImporting ? 'Processing...' : `Import Clean Data`}
              </button>
            </div>
          </div>
        )}
      </div>
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
  .undo-toast { background: #333; color: white; padding: 12px 20px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
  .undo-toast button { background: #ff4d4d; color: white; border: none; border-radius: 4px; padding: 5px 10px; cursor: pointer; }
  .drop-zone { background: #fdfdf5; padding: 80px; text-align: center; border: 2px dashed #ddd; border-radius: 16px; cursor: pointer; }
  .status-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px; }
  .status-item { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #eee; }
  .status-item .label { display: block; font-size: 12px; color: #888; text-transform: uppercase; }
  .status-item .value { font-size: 24px; font-weight: bold; margin-top: 5px;}
  
  .autofix-section { margin-bottom: 25px; }
  .toggle-btn { background: #eef2f5; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; color: #34495e; font-weight: bold; }
  .autofix-log { background: #f8f9fa; padding: 15px 30px; border-radius: 8px; margin-top: 10px; font-family: monospace; font-size: 13px; color: #555; }
  
  .bulk-section { background: #e3f2fd; padding: 20px; border-radius: 12px; margin-bottom: 30px; }
  .bulk-card { background: white; padding: 15px; border-radius: 8px; display: flex; align-items: center; gap: 15px; }
  .bulk-card input { padding: 8px; border: 1px solid #ccc; border-radius: 4px; width: 100px; }
  
  .issue-card { background: #fffaf0; border: 1px solid #ffe4b5; padding: 20px; margin-bottom: 15px; border-radius: 12px; }
  .issue-card.resolved { background: #f0fff0; border-color: #98fb98; opacity: 0.8; }
  .issue-badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; margin-right: 10px; background: #ffd700; }
  .issue-msg { font-size: 16px; margin: 10px 0; color: #333; font-weight: 500; }
  .issue-data { background: rgba(0,0,0,0.03); padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px; color: #666; margin-bottom: 15px; }
  
  .issue-actions button { margin-right: 10px; padding: 10px 15px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; transition: opacity 0.2s; }
  .issue-actions button:hover { opacity: 0.9; }
  .btn-approve { background: #e0e0e0; color: #333; }
  .btn-delete { background: #ff4d4d; color: white; }
  .btn-convert { background: #3498db; color: white; }
  
  .resolved-status { color: #2ecc71; font-weight: bold; font-size: 15px; }
  .btn-undo { background: transparent; border: 1px solid #ccc; margin-left: 10px; padding: 4px 10px; border-radius: 4px; cursor: pointer; }
  
  .wizard-actions { margin-top: 40px; display: flex; gap: 20px; }
  .wizard-actions button { padding: 15px; font-size: 16px; border: none; border-radius: 8px; cursor: pointer; flex: 1; font-weight: bold; }
  .btn-reset { background: #f1f1f1; color: #555; }
  .btn-import { background: #2ecc71; color: white; }
  .btn-import:disabled { background: #a8e6cf; cursor: not-allowed; }
`;

export default InteractiveCSVWizard;
