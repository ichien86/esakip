'use client';

import React from 'react';

const PrintLayout = React.forwardRef(({ data }, ref) => {
  if (!data) return null;

  const { tahun, status, pihakPertama, pihakKedua, items } = data;

  const formatDate = () => {
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const d = new Date();
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const isBupati = pihakKedua.jabatan?.toLowerCase().includes('bupati');

  return (
    <div ref={ref} className="perjakin-print-container" style={{ padding: '20px', fontFamily: '"Times New Roman", Times, serif', color: '#000', background: '#fff' }}>
      
      {/* Print Specific Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 20mm;
          }
          body * {
            visibility: hidden;
          }
          .perjakin-print-container, .perjakin-print-container * {
            visibility: visible;
          }
          .perjakin-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
          }
          table { page-break-inside:auto }
          tr    { page-break-inside:avoid; page-break-after:auto }
          thead { display:table-header-group }
          tfoot { display:table-footer-group }
        }
        
        .perjakin-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
          margin-bottom: 30px;
        }
        .perjakin-table th, .perjakin-table td {
          border: 1px solid #000;
          padding: 8px;
          text-align: left;
          vertical-align: top;
        }
        .perjakin-table th {
          text-align: center;
          font-weight: bold;
        }
        
        .perjakin-signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 50px;
          page-break-inside: avoid;
        }
        .signature-box {
          width: 45%;
          text-align: center;
        }
        .signature-space {
          height: 100px;
        }
        
        .watermark-draft {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 100px;
          color: rgba(239, 68, 68, 0.15);
          white-space: nowrap;
          z-index: -1;
          pointer-events: none;
          font-weight: bold;
          font-family: sans-serif;
        }
      `}</style>

      {status !== 'Disetujui' && (
        <div className="watermark-draft">
          DRAFT / BELUM DISETUJUI
        </div>
      )}

      {/* Header Document */}
      <div style={{ textAlign: 'center', marginBottom: '30px', fontWeight: 'bold' }}>
        <div style={{ fontSize: '14pt' }}>PERJANJIAN KINERJA TAHUN {tahun}</div>
      </div>

      <div style={{ textAlign: 'justify', marginBottom: '20px', lineHeight: '1.5' }}>
        Dalam rangka mewujudkan manajemen pemerintahan yang efektif, transparan dan akuntabel serta berorientasi pada hasil, kami yang bertanda tangan di bawah ini:
      </div>

      {/* Pihak Pertama */}
      <table style={{ width: '100%', marginBottom: '20px', lineHeight: '1.5', border: 'none' }}>
        <tbody>
          <tr>
            <td style={{ width: '30%', padding: '2px 0' }}>Nama</td>
            <td style={{ width: '2%', padding: '2px 0' }}>:</td>
            <td style={{ width: '68%', padding: '2px 0', fontWeight: 'bold' }}>{pihakPertama.nama}</td>
          </tr>
          <tr>
            <td style={{ padding: '2px 0' }}>NIP</td>
            <td style={{ padding: '2px 0' }}>:</td>
            <td style={{ padding: '2px 0' }}>{pihakPertama.nip}</td>
          </tr>
          <tr>
            <td style={{ padding: '2px 0' }}>Jabatan</td>
            <td style={{ padding: '2px 0' }}>:</td>
            <td style={{ padding: '2px 0' }}>{pihakPertama.jabatan}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginBottom: '20px', lineHeight: '1.5' }}>
        Selanjutnya disebut <strong>PIHAK PERTAMA</strong>.
      </div>

      {/* Pihak Kedua */}
      <table style={{ width: '100%', marginBottom: '20px', lineHeight: '1.5', border: 'none' }}>
        <tbody>
          <tr>
            <td style={{ width: '30%', padding: '2px 0' }}>Nama</td>
            <td style={{ width: '2%', padding: '2px 0' }}>:</td>
            <td style={{ width: '68%', padding: '2px 0', fontWeight: 'bold' }}>{pihakKedua.nama}</td>
          </tr>
          {pihakKedua.nip !== '-' && !isBupati && (
            <tr>
              <td style={{ padding: '2px 0' }}>NIP</td>
              <td style={{ padding: '2px 0' }}>:</td>
              <td style={{ padding: '2px 0' }}>{pihakKedua.nip}</td>
            </tr>
          )}
          <tr>
            <td style={{ padding: '2px 0' }}>Jabatan</td>
            <td style={{ padding: '2px 0' }}>:</td>
            <td style={{ padding: '2px 0' }}>{pihakKedua.jabatan}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginBottom: '20px', lineHeight: '1.5', textAlign: 'justify' }}>
        Selaku atasan langsung Pihak Pertama, selanjutnya disebut <strong>PIHAK KEDUA</strong>.
      </div>

      <div style={{ marginBottom: '30px', lineHeight: '1.5', textAlign: 'justify' }}>
        <p style={{ textIndent: '30px', margin: '0 0 10px 0' }}>
          Pihak Pertama berjanji akan mewujudkan target kinerja yang seharusnya sesuai lampiran perjanjian ini, 
          dalam rangka mencapai target kinerja jangka menengah seperti yang telah ditetapkan dalam dokumen perencanaan.
        </p>
        <p style={{ textIndent: '30px', margin: 0 }}>
          Keberhasilan dan kegagalan pencapaian target kinerja tersebut menjadi tanggung jawab kami. 
          Pihak Kedua akan melakukan supervisi yang diperlukan serta akan melakukan evaluasi terhadap capaian kinerja 
          dari perjanjian ini dan mengambil tindakan yang diperlukan dalam rangka pemberian penghargaan dan sanksi.
        </p>
      </div>

      {/* Signatures for Page 1 */}
      <div className="perjakin-signatures">
        <div className="signature-box">
          <div style={{ marginBottom: '10px' }}>Boyolali, {formatDate()}</div>
          <div><strong>PIHAK PERTAMA</strong></div>
          <div className="signature-space"></div>
          <div style={{ textDecoration: 'underline', fontWeight: 'bold' }}>{pihakPertama.nama}</div>
          {pihakPertama.nip !== '-' && <div>NIP. {pihakPertama.nip}</div>}
        </div>
        <div className="signature-box">
          <div style={{ marginBottom: '10px' }}>&nbsp;</div>
          <div><strong>PIHAK KEDUA</strong></div>
          <div className="signature-space"></div>
          <div style={{ textDecoration: 'underline', fontWeight: 'bold' }}>{pihakKedua.nama}</div>
          {pihakKedua.nip !== '-' && !isBupati && <div>NIP. {pihakKedua.nip}</div>}
          {status !== 'Disetujui' && <div style={{ fontSize: '10px', color: '#ef4444', fontStyle: 'italic', marginTop: '5px' }}>(Belum disetujui)</div>}
        </div>
      </div>

      {/* Page Break for Lampiran */}
      <div style={{ pageBreakBefore: 'always', paddingTop: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px', fontWeight: 'bold' }}>
          <div style={{ fontSize: '12pt' }}>LAMPIRAN PERJANJIAN KINERJA TAHUN {tahun}</div>
        </div>

        {/* Tabel IKU */}
        <table className="perjakin-table">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>No</th>
              <th style={{ width: '30%' }}>Sasaran / Kegiatan</th>
              <th style={{ width: '35%' }}>Indikator Kinerja</th>
              <th style={{ width: '15%' }}>Target</th>
              <th style={{ width: '15%' }}>Anggaran (Rp)</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', fontStyle: 'italic', padding: '20px' }}>
                  Belum ada indikator kinerja yang didelegasikan/ditargetkan untuk pegawai ini pada tahun {tahun}.
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id}>
                  <td style={{ textAlign: 'center' }}>{index + 1}</td>
                  <td>{item.sasaran}</td>
                  <td>{item.indikator}</td>
                  <td style={{ textAlign: 'center' }}>{item.target} {item.satuan}</td>
                  <td style={{ textAlign: 'right' }}>{Number(item.anggaran || 0).toLocaleString('id-ID')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Lampiran Signatures */}
        <div className="perjakin-signatures">
          <div className="signature-box">
            <div style={{ marginBottom: '10px' }}>&nbsp;</div>
            <div><strong>PIHAK PERTAMA</strong></div>
            <div className="signature-space"></div>
            <div style={{ textDecoration: 'underline', fontWeight: 'bold' }}>{pihakPertama.nama}</div>
            {pihakPertama.nip !== '-' && <div>NIP. {pihakPertama.nip}</div>}
          </div>
          <div className="signature-box">
            <div style={{ marginBottom: '10px' }}>Boyolali, {formatDate()}</div>
            <div><strong>PIHAK KEDUA</strong></div>
            <div className="signature-space"></div>
            <div style={{ textDecoration: 'underline', fontWeight: 'bold' }}>{pihakKedua.nama}</div>
            {pihakKedua.nip !== '-' && !isBupati && <div>NIP. {pihakKedua.nip}</div>}
            {status !== 'Disetujui' && <div style={{ fontSize: '10px', color: '#ef4444', fontStyle: 'italic', marginTop: '5px' }}>(Belum disetujui)</div>}
          </div>
        </div>
      </div>
    </div>
  );
});

PrintLayout.displayName = 'PrintLayout';

export default PrintLayout;
