import React, { useState } from 'react';
import styled from 'styled-components';
import axios from 'axios';

const CsvUploadModal = ({ isOpen, onClose, groupId, onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError(null);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV file first.');
      return;
    }

    setUploading(true);
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
      onUploadSuccess();
      onClose();
    } catch (err) {
      console.error('CSV upload error:', err);
      if (err.response?.data?.details && Array.isArray(err.response.data.details)) {
        setError(`CSV Errors:\n${err.response.data.details.join('\n')}`);
      } else {
        setError(err.response?.data?.error || 'Failed to upload CSV. Please check the file format.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <ModalContainer>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div className="doodle-title">Import Expenses (CSV)</div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--ink)', fontSize: '24px', cursor: 'pointer', fontWeight: 'bold' }}>✖</button>
        </div>

        {error && <div className="error-alert" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>}

        <p style={{ marginBottom: '20px', color: '#555', lineHeight: '1.5' }}>
          Upload a CSV file containing expenses. The file should have columns for <strong>Date, Description, Amount, Currency, PayerEmail, SplitType</strong>, and columns for participant emails.
        </p>

        <form onSubmit={handleUpload}>
          <div style={{ marginBottom: '25px', padding: '20px', border: '2px dashed var(--ink)', borderRadius: '12px', textAlign: 'center', backgroundColor: '#fff' }}>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileChange}
              style={{ display: 'block', margin: '0 auto' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
            <button type="button" className="doodle-btn-small cancel" onClick={onClose} disabled={uploading} style={{ background: 'white' }}>Cancel</button>
            <button type="submit" className="doodle-btn-small confirm" disabled={uploading} style={{ background: '#5f9ea0', color: 'white' }}>
              {uploading ? 'Uploading...' : 'Upload & Import'}
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
    margin: 5px 0 10px 0;
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
`;

export default CsvUploadModal;
