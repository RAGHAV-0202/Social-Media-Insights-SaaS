import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/social_insights';

async function run() {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  const profile = await db.collection('profiles').findOne({ platform: 'linkedin', handle: 'nyassin' });
  if (profile) {
    console.log('LinkedIn Profile:', profile.handle);
    const posts = await db.collection('posts').find({ profile_id: profile.id }).sort({ fetched_at: -1 }).limit(5).toArray();
    console.log('\n=== Latest LinkedIn Posts in DB ===');
    for (const post of posts) {
      console.log({
        external_id: post.external_id,
        posted_at: post.posted_at,
        fetched_at: post.fetched_at,
        likes: post.likes,
        caption: post.caption?.slice(0, 80),
        url: post.url,
      });
    }
  } else {
    console.log('LinkedIn Profile not found.');
  }

  await mongoose.disconnect();
}

run().catch(console.error);
