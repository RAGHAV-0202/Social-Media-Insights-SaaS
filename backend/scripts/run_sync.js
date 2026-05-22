import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { runScraperSync } from '../src/services/scraper.js';
dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/social_insights';

async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
  
  // Find a profile to get workspace_id
  const db = mongoose.connection.db;
  const profile = await db.collection('profiles').findOne({ handle: { $in: ['nasdaily', 'nyassin', 'NasDaily'] } }) || await db.collection('profiles').findOne();
  if (!profile) {
    console.error('No profiles found in database!');
    await mongoose.disconnect();
    return;
  }
  
  const workspaceId = profile.workspace_id.toString();
  console.log(`Running sync for workspace: ${workspaceId}`);
  
  const result = await runScraperSync('manual', workspaceId);
  console.log('Sync result:', JSON.stringify(result, null, 2));
  
  await mongoose.disconnect();
}

run().catch(e => {
  console.error('Sync failed:', e);
  process.exit(1);
});
