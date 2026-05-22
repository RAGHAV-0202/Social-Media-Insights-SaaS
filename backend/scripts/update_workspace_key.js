import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/social_insights';
const newKey = process.env.APIFY_API_KEY || '';

async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
  const db = mongoose.connection.db;

  const workspaces = await db.collection('workspaces').find().toArray();
  console.log('\n=== Existing Workspaces ===');
  for (const w of workspaces) {
    console.log(`Workspace Name: ${w.name}`);
    console.log(`Workspace ID: ${w._id}`);
    console.log(`Current key in DB: ${w.apify_api_key}`);
    
    // Update key if it exists
    if (w.apify_api_key) {
      await db.collection('workspaces').updateOne(
        { _id: w._id },
        { $set: { apify_api_key: newKey } }
      );
      console.log(`Updated workspace "${w.name}" key to: ${newKey}`);
    }
  }

  await mongoose.disconnect();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
