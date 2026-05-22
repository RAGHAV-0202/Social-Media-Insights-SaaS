import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/social_insights';

async function run() {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  const profile = await db.collection('profiles').findOne({ platform: 'facebook', handle: 'nasdaily' });
  if (!profile) {
    console.log('nasdaily profile not found');
    await mongoose.disconnect();
    return;
  }

  // Find the latest snapshot
  const snapshot = await db.collection('profilesnapshots').findOne({ profile_id: profile.id }, { sort: { captured_at: -1 } });
  
  // Find a post
  const post = await db.collection('posts').findOne({ profile_id: profile.id });

  console.log('=== Snapshot Info ===');
  console.log('Followers in snapshot:', snapshot?.followers);
  console.log('Keys in snapshot.raw:', Object.keys(snapshot?.raw || {}));
  
  console.log('\n=== Post Raw Object Sample ===');
  if (post && post.raw) {
    console.log('Keys in post.raw:', Object.keys(post.raw));
    console.log('Likes/Followers/Fans info inside post.raw:');
    // Print fields that might contain follower/page details
    const possibleFields = [
      'pageName', 'likes', 'followers', 'pageFollowers', 'fan_count', 
      'user', 'author', 'pageInfo', 'page', 'likesCount', 'followersCount'
    ];
    const extracted = {};
    for (const f of possibleFields) {
      if (post.raw[f] !== undefined) {
        extracted[f] = post.raw[f];
      }
    }
    console.log(extracted);
    console.log('\nFull post.raw structure (first 1000 chars):');
    console.log(JSON.stringify(post.raw, null, 2).slice(0, 1500));
  } else {
    console.log('No post found');
  }

  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
