import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/social_insights';

async function run() {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  const profiles = await db.collection('profiles').find({ handle: { $in: ['nasdaily', 'NasDaily', 'nyassin'] } }).toArray();

  // YouTube: Check multiple posts' raw date field
  const ytProfile = profiles.find(p => p.platform === 'youtube');
  if (ytProfile) {
    const ytPosts = await db.collection('posts').find({ profile_id: ytProfile.id }).limit(5).toArray();
    console.log('=== YouTube Posts (date fields) ===');
    for (const p of ytPosts) {
      console.log({
        external_id: p.external_id,
        stored_posted_at: p.posted_at,
        raw_date: p.raw?.date,
        raw_uploadDate: p.raw?.uploadDate,
        raw_publishedAt: p.raw?.publishedAt,
        raw_viewCount: p.raw?.viewCount,
        raw_likes: p.raw?.likes,
        raw_commentsCount: p.raw?.commentsCount,
      });
    }
  }

  // Twitter: Check what the full snapshot raw looks like
  const twProfile = profiles.find(p => p.platform === 'twitter');
  if (twProfile) {
    const twSnap = await db.collection('profilesnapshots').findOne({ profile_id: twProfile.id }, { sort: { captured_at: -1 } });
    console.log('\n=== Twitter Full Snapshot Raw ===');
    console.log(JSON.stringify(twSnap?.raw, null, 2)?.slice(0, 2000));
  }
  
  // LinkedIn: check the full first item from raw snapshot
  const liProfile = profiles.find(p => p.platform === 'linkedin');
  if (liProfile) {
    const liSnap = await db.collection('profilesnapshots').findOne({ profile_id: liProfile.id }, { sort: { captured_at: -1 } });
    const rawArr = liSnap?.raw;
    if (Array.isArray(rawArr) && rawArr.length > 0) {
      console.log('\n=== LinkedIn Full First Post Item ===');
      const item = { ...rawArr[0] };
      // Truncate long text fields
      if (item.text) item.text = item.text.slice(0, 100);
      console.log(JSON.stringify(item, null, 2));
    }
  }

  // Facebook: check the full snapshot raw
  const fbProfile = profiles.find(p => p.platform === 'facebook' && p.handle === 'nasdaily');
  if (fbProfile) {
    const fbSnap = await db.collection('profilesnapshots').findOne({ profile_id: fbProfile.id }, { sort: { captured_at: -1 } });
    console.log('\n=== Facebook Full Snapshot Raw ===');
    console.log(JSON.stringify(fbSnap?.raw, null, 2));
  }

  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
