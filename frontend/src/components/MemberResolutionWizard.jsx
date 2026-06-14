import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import axios from 'axios';

const MemberResolutionWizard = ({ isOpen, onClose, groupId, onNextStep }) => {
  const fileInputRef = useRef(null);
  
  const [step, setStep] = useState(1); // 1 = Drop, 2 = Resolution
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  
  // Member Resolution State
  const [importSessionId, setImportSessionId] = useState(null);
  const [csvMembers, setCsvMembers] = useState([]);
  const [existingGroupMembers, setExistingGroupMembers] = useState([]);
  const [existingGuests, setExistingGuests] = useState([]);
  const [memberResolutions, setMemberResolutions] = useState({});
  const [resolvingMembers, setResolvingMembers] = useState(false);

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
    initImportSession(selectedFile);
  };

  const resetState = () => {
    setError(null);
    setStep(1);
    setMemberResolutions({});
    setCsvMembers([]);
  };

  const handleClose = () => {
    resetState();
    setFile(null);
    onClose();
  };

  const initImportSession = async (selectedFile) => {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`http://localhost:3000/api/groups/${groupId}/imports/init`, formData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setImportSessionId(response.data.sessionId);
      setCsvMembers(response.data.csvMembers);
      setExistingGroupMembers(response.data.existingGroupMembers);
      setExistingGuests(response.data.existingGuests);
      setMemberResolutions(response.data.autoResolutions || {});
      setStep(2);
      setUploading(false);
    } catch (err) {
      console.error('Init Error:', err);
      setError(err.response?.data?.error || 'Failed to initialize CSV session.');
      setUploading(false);
      setFile(null);
    }
  };

  const handleSetResolution = (csvName, action, value = null) => {
    setMemberResolutions(prev => ({
      ...prev,
      [csvName]: { resolutionType: action, resolvedUserId: value }
    }));
  };

  const runAnomalyReview = async () => {
    setResolvingMembers(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const resolutionsArray = Object.keys(memberResolutions).map(csvName => {
        return { csvMemberName: csvName, ...memberResolutions[csvName] };
      });
      
      await axios.post(`http://localhost:3000/api/groups/${groupId}/imports/${importSessionId}/member-resolutions`, {
        resolutions: resolutionsArray
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (onNextStep) onNextStep(importSessionId);
      else alert('Members resolved successfully! Anomaly Detection will run in the next phase.');
      handleClose();
    } catch (err) {
      console.error('Resolution Error:', err);
      setError('Failed to save resolutions.');
    } finally {
      setResolvingMembers(false);
    }
  };

  const isFullyResolved = Object.keys(memberResolutions).length === csvMembers.length;

  const membersToManuallyResolve = csvMembers.filter(name => !memberResolutions[name]?.isAutoResolved);
  const totalManual = membersToManuallyResolve.length;
  const numManualResolved = membersToManuallyResolve.filter(name => memberResolutions[name]).length;

  return (
    <ModalOverlay>
      <div className="modal-content">
        <button className="close-btn" onClick={handleClose}>✖</button>
        
        <h1 className="page-title">Tier 0: Member Resolution</h1>
        <p className="page-subtitle">Establish member context for the imported CSV before anomaly detection.</p>

        {error && <div className="error-alert">{error}</div>}

        {step === 1 && !uploading && (
          <div className={`drop-zone ${isDragging ? 'dragging' : ''}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
            <input type="file" accept=".csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
            <h3>Drop expenses_export.csv here</h3>
            <p>Scanning to extract unique member names...</p>
          </div>
        )}

        {step === 2 && (
          <div className="resolution-container">
            {totalManual > 0 && (
              <div className="progress-section">
                <h3>Progress</h3>
                <div className="progress-text">Resolved: {numManualResolved}/{totalManual}</div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(numManualResolved / totalManual) * 100}%` }}></div>
                </div>
              </div>
            )}

            <table className="resolution-table">
              <thead>
                <tr>
                  <th>CSV Name</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {csvMembers.filter(name => !memberResolutions[name]?.isAutoResolved).length === 0 && (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', padding: '40px', background: '#f9fff9' }}>
                      <h3 style={{ color: '#2ecc71', margin: '0 0 10px 0' }}>✨ All members successfully matched!</h3>
                      <p style={{ color: '#666', margin: 0 }}>No manual mapping required. You can proceed to the anomaly review.</p>
                    </td>
                  </tr>
                )}
                {csvMembers.filter(name => !memberResolutions[name]?.isAutoResolved).map(name => {
                  const res = memberResolutions[name];
                  const isMapped = !!res;
                  
                  return (
                    <tr key={name} className={isMapped ? 'resolved-row' : ''}>
                      <td className="name-col"><strong>{name}</strong></td>
                      <td className="status-col">
                        {isMapped ? (
                          <span className="status-badge success">Resolved ({res.resolutionType.replace(/_/g, ' ')})</span>
                        ) : (
                          <span className="status-badge pending">Needs Action</span>
                        )}
                      </td>
                      <td className="action-col">
                        <select 
                          className="action-select"
                          value={res?.resolutionType === 'MAP_EXISTING' ? res.resolvedUserId : ''}
                          onChange={(e) => {
                            if(e.target.value) handleSetResolution(name, 'MAP_EXISTING', parseInt(e.target.value));
                          }}
                        >
                          <option value="">-- Map to Existing Member --</option>
                          {existingGroupMembers.map(m => (
                            <option key={m.userId} value={m.userId}>{m.user.name}</option>
                          ))}
                        </select>
                        <button 
                          className={`action-btn ${res?.resolutionType === 'CREATE_NEW_MEMBER' ? 'active' : ''}`}
                          onClick={() => handleSetResolution(name, 'CREATE_NEW_MEMBER')}
                        >
                          Create Member
                        </button>
                        <button 
                          className={`action-btn guest ${res?.resolutionType === 'CREATE_GUEST' ? 'active' : ''}`}
                          onClick={() => handleSetResolution(name, 'CREATE_GUEST')}
                        >
                          Create Guest
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="wizard-actions">
              <button className="btn-reset" onClick={() => setStep(1)} disabled={resolvingMembers}>Previous: Dataset Review</button>
              <button className="btn-import" onClick={runAnomalyReview} disabled={!isFullyResolved || resolvingMembers}>
                {resolvingMembers ? 'Saving...' : 'Next: Run Anomaly Review'}
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
  .drop-zone { background: #fdfdf5; padding: 80px; text-align: center; border: 2px dashed #ddd; border-radius: 16px; cursor: pointer; }
  
  .progress-section { background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
  .progress-section h3 { margin: 0 0 10px 0; font-size: 16px; }
  .progress-text { font-weight: bold; margin-bottom: 10px; color: #34495e; }
  .progress-bar { width: 100%; height: 12px; background: #e0e0e0; border-radius: 6px; overflow: hidden; }
  .progress-fill { height: 100%; background: #2ecc71; transition: width 0.3s ease; }

  .resolution-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  .resolution-table th { text-align: left; padding: 15px; background: #f1f2f6; border-bottom: 2px solid #ddd; }
  .resolution-table td { padding: 15px; border-bottom: 1px solid #eee; vertical-align: middle; }
  .resolved-row { background-color: #f9fff9; }

  .status-badge { padding: 6px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
  .status-badge.pending { background: #ffeaa7; color: #d35400; }
  .status-badge.success { background: #a29bfe; color: white; }

  .action-col { display: flex; gap: 10px; align-items: center; }
  .action-select { padding: 8px; border-radius: 6px; border: 1px solid #ccc; font-size: 13px; }
  .action-btn { padding: 8px 15px; border: 1px solid #3498db; background: transparent; color: #3498db; border-radius: 6px; cursor: pointer; font-weight: bold; transition: all 0.2s; }
  .action-btn:hover { background: #e3f2fd; }
  .action-btn.active { background: #3498db; color: white; }
  .action-btn.guest { border-color: #e67e22; color: #e67e22; }
  .action-btn.guest:hover { background: #fdf2e9; }
  .action-btn.guest.active { background: #e67e22; color: white; }

  .wizard-actions { margin-top: 40px; display: flex; gap: 20px; }
  .wizard-actions button { padding: 15px; font-size: 16px; border: none; border-radius: 8px; cursor: pointer; flex: 1; font-weight: bold; }
  .btn-reset { background: #f1f1f1; color: #555; }
  .btn-import { background: #2ecc71; color: white; }
  .btn-import:disabled { background: #a8e6cf; cursor: not-allowed; }
`;

export default MemberResolutionWizard;
