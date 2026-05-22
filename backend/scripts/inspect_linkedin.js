import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/social_insights';

async function run() {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  const profile = await db.collection('profiles').findOne({ platform: 'linkedin', handle: 'nyassin' });
  if (profile) {
    console.log('LinkedIn Profile found:', profile.handle);
    const snap = await db.collection('profilesnapshots').findOne({ profile_id: profile.id }, { sort: { captured_at: -1 } });
    if (snap && Array.isArray(snap.raw) && snap.raw.length > 0) {
      const first = snap.raw[0];
      console.log('First post author:', JSON.stringify(first.author, null, 2));
      console.log('First post company:', JSON.stringify(first.company, null, 2));
      console.log('First post top-level keys:', Object.keys(first));
    } else {
      console.log('No snapshot raw posts found.');
    }
  } else {
    console.log('LinkedIn Profile not found.');
  }

  await mongoose.disconnect();
}

run().catch(console.error);
