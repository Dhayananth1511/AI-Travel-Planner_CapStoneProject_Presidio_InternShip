const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const mongoose = require('mongoose');

const uri = "mongodb+srv://dhayananth1511_db_user:BFy4h1aXj4ZlGX2p@cluster0.wq8jew.mongodb.net/?appName=Cluster0";

async function run() {
  await mongoose.connect(uri);
  console.log("Connected to MongoDB!");
  
  const UserSchema = new mongoose.Schema({
    email: String,
    role: String
  }, { collection: 'users' });
  
  const User = mongoose.model('User', UserSchema);
  
  const targetUser = await User.findOne({ email: 'tester_logout_web_test_1@example.com' });
  if (targetUser) {
    targetUser.role = 'admin';
    await targetUser.save();
    console.log(`\nSuccessfully promoted ${targetUser.email} to Admin!`);
  } else {
    console.log("\nTarget user not found.");
  }

  await mongoose.disconnect();
  console.log("Disconnected.");
}

run().catch(console.error);
