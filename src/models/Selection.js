import mongoose from 'mongoose';

const SelectionSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  tahun: { type: Number, required: true, default: 2026 },
  selectedIndicators: { type: [String], default: [] }
}, { timestamps: true });

SelectionSchema.index({ employeeId: 1, tahun: 1 }, { unique: true });

export default mongoose.models.Selection || mongoose.model('Selection', SelectionSchema);
