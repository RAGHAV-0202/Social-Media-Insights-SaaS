import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/social_insights';

async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
  const db = mongoose.connection.db;

  const w = await db.collection('workspaces').findOne({ _id: new mongoose.Types.ObjectId('6a0caa3b13054a0e61aecc63') });
  console.log('Workspace:', JSON.stringify(w, null, 2));

  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
