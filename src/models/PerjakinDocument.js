import mongoose from 'mongoose';

const PerjakinDocumentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  employeeId: { type: String, required: true },
  tahun: { type: Number, required: true },
  status: { 
    type: String, 
    enum: [
      'Draft', 
      'Menunggu Verifikasi Unit', 
      'Menunggu Verifikasi Perencana', 
      'Menunggu Persetujuan Atasan', 
      'Disetujui', 
      'Ditolak'
    ], 
    default: 'Draft' 
  },
  history: {
    type: [{
      status: String,
      actorRole: String,
      actorName: String,
      timestamp: Date,
      notes: String
    }],
    default: []
  }
}, { timestamps: true });

// Create a compound index so we can easily query by employeeId + tahun
PerjakinDocumentSchema.index({ employeeId: 1, tahun: 1 }, { unique: true });

export default mongoose.models.PerjakinDocument || mongoose.model('PerjakinDocument', PerjakinDocumentSchema);
