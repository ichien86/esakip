import mongoose from 'mongoose';

const MasterProgramSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  nama: { type: String, required: true },
  urusan: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.models.MasterProgram || mongoose.model('MasterProgram', MasterProgramSchema);
