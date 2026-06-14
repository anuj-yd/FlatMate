import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import axios from 'axios';

const CsvImportPreviewModal = ({ isOpen, onClose, groupId, onUploadSuccess }) => {
  const fileInputRef = useRef(null);
  
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (selectedFile) => {
    if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
      setError('Please upload a valid CSV file (.csv only)');
      setFile(null);
      return;
    }
    setFile(selectedFile);
    setError(null);
    setPreviewData(null);
    setUploadProgress(0);
    uploadFile(selectedFile);
  };

  const uploadFile = async (selectedFile) => {
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:3000/api/imports/upload', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });
      
      setTimeout(() => {
        setPreviewData(response.data);
        setUploading(false);
      }, 500);

    } catch (err) {
      console.error('Upload Error:', err);
      setError(err.response?.data?.error || 'Failed to process CSV file.');
      setUploading(false);
      setFile(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const resetModal = () => {
    setPreviewData(null);
    setFile(null);
    setError(null);
    setUploadProgress(0);
    setIsImporting(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const importToDatabase = async () => {
    if (!file || !groupId) return;
    
    setIsImporting(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:3000/api/groups/${groupId}/expenses/csv`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (onUploadSuccess) onUploadSuccess();
      handleClose();
    } catch (err) {
      console.error('DB Import Error:', err);
      if (err.response?.data?.details && Array.isArray(err.response.data.details)) {
        setError(`Import Errors:\n${err.response.data.details.join('\n')}`);
      } else {
        setError(err.response?.data?.error || 'Failed to import CSV to database.');
      }
      setIsImporting(false);
    }
  };

  const renderTable = () => {
    if (!previewData || !previewData.previewRows || previewData.previewRows.length === 0) return null;
    
    const rows = previewData.previewRows;
    const columns = Object.keys(rows[0]);

    return (
      <div className="table-container doodle-card">
        <h3>Preview (First {rows.length} rows)</h3>
        <div className="table-wrapper">
          <table className="preview-table">
            <thead>
              <tr>
                <th>#</th>
                {columns.map(col => <th key={col}>{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  {columns.map(col => <td key={`${idx}-${col}`}>{row[col]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <ModalOverlay>
      <div className="modal-content">
        <button className="close-btn" onClick={handleClose}>✖</button>
        
        <h1 className="page-title">CSV Upload Infrastructure</h1>
        <p className="page-subtitle">Test and preview your CSV uploads safely. No data will be saved to your database.</p>

        {error && <div className="error-alert">{error}</div>}

        {!previewData && !uploading && (
          <div 
            className={`drop-zone ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileChange}
            />
            <div className="drop-icon">
              <svg width="40" height="48" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 0H4C1.79 0 0.02 1.79 0.02 4L0 44C0 46.21 1.78 48 3.99 48H36C38.21 48 40 46.21 40 44V18L22 0ZM32 36H8V32H32V36ZM32 28H8V24H32V28ZM18 20V3L37 22H20C18.9 22 18 21.1 18 20Z" fill="#E2D9F3"/>
              </svg>
            </div>
            <h3>Drop CSV here</h3>
            <p>or click to browse</p>
            <span className="file-hint">Accepts .csv files only</span>
          </div>
        )}

        {uploading && (
          <div className="upload-progress-card doodle-card">
            <h3>Uploading...</h3>
            <p className="file-name">{file?.name}</p>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
            </div>
            <div className="progress-text">{uploadProgress}% Complete</div>
          </div>
        )}

        {previewData && (
          <div className="success-container">
            <div className="status-card doodle-card">
              <h3>✅ Import Status</h3>
              <div className="status-grid">
                <div className="status-item">
                  <span className="label">File Name</span>
                  <span className="value">{previewData.fileName}</span>
                </div>
                <div className="status-item">
                  <span className="label">Total File Size</span>
                  <span className="value">{formatFileSize(previewData.fileSize)}</span>
                </div>
                <div className="status-item">
                  <span className="label">Upload Time</span>
                  <span className="value">{new Date(previewData.uploadedAt).toLocaleString()}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '15px' }}>
                <button className="doodle-btn-small reset-btn" onClick={resetModal} disabled={isImporting} style={{ flex: 1, background: '#f8f9fa', color: '#555', border: '1px solid #ddd' }}>
                  Cancel / Upload Another
                </button>
                <button className="doodle-btn-small import-btn" onClick={importToDatabase} disabled={isImporting} style={{ flex: 1, background: '#2ecc71', color: 'white', border: 'none' }}>
                  {isImporting ? 'Importing...' : 'Confirm & Import to Group'}
                </button>
              </div>
            </div>

            {renderTable()}
          </div>
        )}
      </div>
    </ModalOverlay>
  );
};

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(247, 247, 247, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;

  .modal-content {
    background: #fff;
    width: 900px;
    max-width: 95vw;
    max-height: 90vh;
    overflow-y: auto;
    padding: 40px;
    border-radius: 16px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    position: relative;
  }

  .close-btn {
    position: absolute;
    top: 20px;
    right: 20px;
    background: transparent;
    border: none;
    font-size: 24px;
    color: #888;
    cursor: pointer;
    transition: color 0.2s;
    
    &:hover {
      color: #333;
    }
  }

  .page-title {
    font-size: 32px;
    color: #111;
    margin-bottom: 8px;
    font-weight: 500;
  }

  .page-subtitle {
    font-size: 16px;
    color: #666;
    margin-bottom: 40px;
  }

  .doodle-card {
    background-color: #fff;
    padding: 25px;
    border-radius: 12px;
    border: 1px solid #eee;
    margin-bottom: 30px;
  }

  .drop-zone {
    background-color: #fdfdf5;
    border: 0;
    border-radius: 16px;
    padding: 80px 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    
    &:hover, &.dragging {
      background-color: #f5f5ea;
    }

    .drop-icon {
      margin-bottom: 20px;
    }

    h3 {
      font-size: 24px;
      color: #111;
      margin: 0 0 10px 0;
      font-weight: 400;
    }

    p {
      color: #666;
      font-size: 16px;
      margin: 0 0 20px 0;
    }

    .file-hint {
      display: inline-block;
      background: #e9e9e9;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 13px;
      color: #555;
    }
  }

  .upload-progress-card {
    text-align: center;

    h3 {
      margin-top: 0;
      color: #111;
    }

    .file-name {
      font-weight: bold;
      color: #555;
      margin-bottom: 20px;
    }

    .progress-bar-container {
      width: 100%;
      height: 8px;
      background-color: #eee;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 10px;
    }

    .progress-bar {
      height: 100%;
      background-color: #E2D9F3;
      transition: width 0.3s ease;
    }

    .progress-text {
      font-weight: 500;
      color: #888;
    }
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-bottom: 20px;
    margin-top: 20px;

    .status-item {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #ddd;
      
      .label {
        display: block;
        font-size: 12px;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 5px;
      }
      
      .value {
        font-size: 16px;
        font-weight: bold;
        color: #111;
      }
    }
  }

  .reset-btn {
    background: #ff7b54;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
  }

  .table-container {
    h3 {
      margin-top: 0;
      color: #111;
    }
    
    .table-wrapper {
      overflow-x: auto;
    }

    .preview-table {
      width: 100%;
      border-collapse: collapse;
      
      th, td {
        padding: 12px 15px;
        text-align: left;
        border-bottom: 1px solid #eee;
      }

      th {
        background-color: #f8f9fa;
        font-weight: bold;
        color: #555;
        white-space: nowrap;
      }

      tr:hover {
        background-color: #fcfcfc;
      }
    }
  }

  .error-alert {
    background-color: #ffeaea;
    color: #e74c3c;
    padding: 15px;
    border-radius: 8px;
    border: 1px solid #e74c3c;
    margin-bottom: 20px;
    font-weight: 500;
    white-space: pre-wrap;
  }
`;

export default CsvImportPreviewModal;
