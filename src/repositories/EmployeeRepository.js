import dbConnect from '@/lib/db';
import Employee from '@/models/Employee';

class EmployeeRepository {
  async findAll() {
    await dbConnect();
    return Employee.find({}).sort({ id: 1 });
  }

  async findOne(filter) {
    await dbConnect();
    return Employee.findOne(filter);
  }

  async saveDocument(document) {
    return document.save();
  }
}

export default new EmployeeRepository();
