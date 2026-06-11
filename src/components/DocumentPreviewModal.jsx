import React, { useEffect, useState } from 'react';
import { getEmbedUrl } from '@/utils/linkPreview';

export default function DocumentPreviewModal({ url, onClose }) {
  const [embedUrl, setEmbedUrl] = useState('');

  useEffect(() => {
    if (url) {
      setEmbedUrl(getEmbedUrl(url));
    }
  }, [url]);

  if (!url) return null;

  return (
    <>
      <div 
        className="modal-backdrop fade show" 
        style={{ zIndex: 1040 }}
        onClick={onClose}
      ></div>
      <div 
        className="modal fade show" 
        style={{ display: 'block', zIndex: 1050 }}
        tabIndex="-1"
      >
        <div className="modal-dialog modal-xl modal-dialog-centered" style={{ maxWidth: '90vw', height: '90vh' }}>
          <div className="modal-content" style={{ height: '100%', border: 'none', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div className="modal-header" style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '15px 24px' }}>
              <h5 className="modal-title" style={{ fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-file-invoice text-primary"></i>
                Pratinjau Bukti Dukung
              </h5>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn-sim primary"
                  style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '20px' }}
                >
                  <i className="fa-solid fa-arrow-up-right-from-square mr-2"></i>
                  Buka di Tab Baru
                </a>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={onClose}
                  style={{ background: '#e2e8f0', borderRadius: '50%', padding: '8px', opacity: 1 }}
                ></button>
              </div>
            </div>
            
            <div className="modal-body" style={{ padding: 0, position: 'relative', background: '#f1f5f9' }}>
              {!embedUrl ? (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="spinner-border text-primary" role="status"></div>
                </div>
              ) : (
                <iframe
                  src={embedUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 'none' }}
                  allow="autoplay"
                  title="Document Preview"
                  loading="lazy"
                ></iframe>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
