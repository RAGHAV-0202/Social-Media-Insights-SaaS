import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { runScraperSync } from '../src/services/scraper.js';
dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/social_insights';

async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
  
  const db = mongoose.connection.db;
  
  // Find the Twitter profile in the database
  const twitterProfile = await db.collection('profiles').findOne({ platform: 'twitter' });
  if (!twitterProfile) {
    console.error('No Twitter profile found in the database!');
    await mongoose.disconnect();
    return;
  }
  
  const workspaceId = twitterProfile.workspace_id.toString();
  const profileId = twitterProfile.id;
  
  console.log(`\n======================================================`);
  console.log(`Running targeted Twitter sync only!`);
  console.log(`Workspace ID: ${workspaceId}`);
  console.log(`Profile ID: ${profileId}`);
  console.log(`Handle: ${twitterProfile.handle}`);
  console.log(`======================================================\n`);
  
  const result = await runScraperSync('manual', workspaceId, profileId);
  console.log('Targeted Sync Result:', JSON.stringify(result, null, 2));
  
  await mongoose.disconnect();
}

run().catch(e => {
  console.error('Targeted Twitter sync failed:', e);
  process.exit(1);
});
