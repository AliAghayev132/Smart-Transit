/** Test: MongoDBService əvəzi — bağlantı yoxdur, model qatı yaddaşdadır */
class MongoDBService {
  constructor() {
    this.isConnected = true;
  }
  async connect() {}
  async disconnect() {}
  getConnectionStatus() {
    return { isConnected: true };
  }
}
const mongoDBService = new MongoDBService();
export { MongoDBService, mongoDBService };
