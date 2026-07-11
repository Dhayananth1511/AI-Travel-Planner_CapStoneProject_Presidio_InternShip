import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || '';

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected!');

  const db = mongoose.connection.db!;
  const tripsCollection = db.collection('trips');

  const latestTrip = await tripsCollection.find().sort({ createdAt: -1 }).limit(1).toArray();
  
  if (latestTrip.length === 0) {
    console.log('No trips found!');
  } else {
    console.log('Latest Trip Context:', JSON.stringify(latestTrip[0], null, 2));
  }

  await mongoose.disconnect();
  console.log('Disconnected!');
}

run().catch(console.error);
