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

  async find(filter) {
    await dbConnect();
    return Employee.find(filter);
  }

  async saveDocument(document) {
    return document.save();
  }
}

const employeeRepository = new EmployeeRepository();
export default employeeRepository;
