const mongoose = require('mongoose');

async function connectDB(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log(`[db] MongoDB qoşuldu: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

module.exports = connectDB;
