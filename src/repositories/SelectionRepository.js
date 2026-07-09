import dbConnect from '@/lib/db';
import Selection from '@/models/Selection';

class SelectionRepository {
  /**
   * Mendapatkan satu selection berdasarkan filter.
   */
  async findOne(filter) {
    await dbConnect();
    return Selection.findOne(filter);
  }

  /**
   * Menyimpan dokumen Selection (instance mongoose).
   */
  async saveDocument(document) {
    return document.save();
  }
}

const selectionRepository = new SelectionRepository();
export default selectionRepository;
