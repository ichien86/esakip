import mongoose from 'mongoose';

const RealisasiScheduleSchema = new mongoose.Schema({
  tahun: { type: Number, required: true },
  bulan: { type: Number, required: true }, // 1 - 12
  isLocked: { type: Boolean, default: false },
  deadline: { type: String, default: '' } // format YYYY-MM-DD
}, { timestamps: true });

// Prevent duplicate config for same year and month
RealisasiScheduleSchema.index({ tahun: 1, bulan: 1 }, { unique: true });

export default mongoose.models.RealisasiSchedule || mongoose.model('RealisasiSchedule', RealisasiScheduleSchema);
