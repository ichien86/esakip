import mongoose from 'mongoose';

const RenaksiSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  employeeId: { type: String, required: true },
  bidang: { type: String, default: '' }, // Identifies which bidang submitted this (useful for cross-cutting split mode)
  tahun: { type: Number, required: true, default: 2026 },
  indicatorId: { type: String, required: true },
  bulan: { type: Number, required: true },
  targetBulanan: { type: Number, default: 0 },
  realisasiBulanan: { type: Number, default: null },
  capaianBulanan: { type: Number, default: null }, // Persentase capaian bulanan (realisasi / target * 100), tanpa batas atas
  tanggalRealisasi: { type: String, default: null }, // ISO String or null
  buktiDukung: { type: String, default: '' },
  kendala: { type: String, default: '' },
  solusi: { type: String, default: '' },
  faktorPendorong: { type: String, default: '' },
  inovasi: { type: String, default: '' },
  status: { type: String, default: 'Draft' }, // Draft, Diajukan, Ditolak Admin, ACC_Admin, Disetujui
  catatanAdmin: { type: String, default: '' },
  isCrossCuttingSelected: { type: Boolean, default: true },

  // Rekomendasi Atasan & Tindak Lanjut
  rekomendasiAtasan: { type: String, default: '' },
  statusRekomendasi: { type: String, enum: ['Kosong', 'Menunggu Tindak Lanjut', 'Selesai'], default: 'Kosong' },
  tindakLanjutRekomendasi: { type: String, default: '' },
  buktiDukungTindakLanjut: { type: String, default: '' },
  
  // Realization calculation variables (Legacy: Tunggal & Persentase)
  variabelJumlahVal: { type: Number, default: null },
  variabelPembilangVal: { type: Number, default: null },
  variabelPenyebutVal: { type: Number, default: null },

  // ===== POLA SNAPSHOT (disalin dari Indikator saat pertama kali diisi) =====
  // Metode yang aktif saat bulan ini diisi (beku setelah simpan pertama)
  snapshotMetode: { type: String, default: null }, // Tunggal, Persentase, Rata-rata, Penjumlahan, Pembobotan
  // Konfigurasi variabel (beku setelah simpan pertama)
  snapshotVariables: [
    {
      name: { type: String },
      weight: { type: Number, default: 1 }
    }
  ],
  // Nilai input riil dari pegawai untuk variabel dinamis
  variablesRealization: [
    {
      name: { type: String },
      value: { type: Number, default: null },
      isConstant: { type: Boolean, default: false },
      buktiDukung: { type: String, default: '' }
    }
  ]
}, { timestamps: true });

export default mongoose.models.Renaksi || mongoose.model('Renaksi', RenaksiSchema);
