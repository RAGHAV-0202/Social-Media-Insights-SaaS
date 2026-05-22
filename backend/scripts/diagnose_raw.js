import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/social_insights';

async function run() {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  // Get the nasdaily profiles
  const profiles = await db.collection('profiles').find({
    handle: { $in: ['nasdaily', 'nyassin', 'NasDaily'] }
  }).toArray();

  // Check YouTube raw snapshot data (to see why posted_at is null)
  const ytProfile = profiles.find(p => p.platform === 'youtube');
  if (ytProfile) {
    const ytSnap = await db.collection('profilesnapshots').findOne({ profile_id: ytProfile.id }, { sort: { captured_at: -1 } });
    console.log('\n=== YouTube Snapshot Raw Data (first item keys) ===');
    const rawData = ytSnap?.raw;
    if (rawData) {
      // Show keys of the raw object
      console.log('Raw keys:', Object.keys(rawData));
      // Show date-related fields
      const dateKeys = Object.keys(rawData).filter(k => /date|time|publish|upload|create/i.test(k));
      console.log('Date-related keys:', dateKeys);
      for (const k of dateKeys) {
        console.log(`  ${k}:`, rawData[k]);
      }
    }
    
    // Check a YouTube post's raw data
    const ytPost = await db.collection('posts').findOne({ profile_id: ytProfile.id });
    if (ytPost) {
      console.log('\n=== YouTube Post Raw Data (sample) ===');
      const raw = ytPost.raw || {};
      console.log('Keys:', Object.keys(raw).sort().join(', '));
      const dateKeys = Object.keys(raw).filter(k => /date|time|publish|upload|create/i.test(k));
      console.log('Date-related fields:');
      for (const k of dateKeys) {
        console.log(`  ${k}:`, JSON.stringify(raw[k]));
      }
      console.log('Title:', raw.title);
      console.log('Views:', raw.viewCount ?? raw.views);
      console.log('Likes:', raw.likes);
      console.log('URL:', raw.url);
    }
  }

  // Check Twitter raw snapshot data
  const twProfile = profiles.find(p => p.platform === 'twitter');
  if (twProfile) {
    const twSnap = await db.collection('profilesnapshots').findOne({ profile_id: twProfile.id }, { sort: { captured_at: -1 } });
    console.log('\n=== Twitter Snapshot Raw Data ===');
    const rawData = twSnap?.raw;
    if (rawData) {
      console.log('Raw keys:', Object.keys(rawData).sort().join(', '));
      // Show follower-related fields
      const followerKeys = Object.keys(rawData).filter(k => /follow|friend|fan/i.test(k));
      console.log('Follower-related fields:');
      for (const k of followerKeys) {
        console.log(`  ${k}:`, rawData[k]);
      }
      // Show name/profile fields
      console.log('Name fields:', rawData.name, rawData.displayName, rawData.screen_name, rawData.screenName);
    }
    
    // Check if there are any posts with twitter profile_id
    const twPosts = await db.collection('posts').find({ profile_id: twProfile.id }).toArray();
    console.log('Twitter posts stored:', twPosts.length);
  }

  // Check Facebook raw snapshot data
  const fbProfile = profiles.find(p => p.platform === 'facebook' && p.handle === 'nasdaily');
  if (fbProfile) {
    const fbSnap = await db.collection('profilesnapshots').findOne({ profile_id: fbProfile.id }, { sort: { captured_at: -1 } });
    console.log('\n=== Facebook Snapshot Raw Data ===');
    const rawData = fbSnap?.raw;
    if (rawData) {
      console.log('Raw:', JSON.stringify(rawData));
    }
  }

  // Check LinkedIn raw snapshot/post data
  const liProfile = profiles.find(p => p.platform === 'linkedin');
  if (liProfile) {
    const liSnap = await db.collection('profilesnapshots').findOne({ profile_id: liProfile.id }, { sort: { captured_at: -1 } });
    console.log('\n=== LinkedIn Snapshot Raw Data ===');
    const rawArr = liSnap?.raw;
    if (Array.isArray(rawArr) && rawArr.length > 0) {
      const sample = rawArr[0];
      console.log('First item keys:', Object.keys(sample).sort().join(', '));
      // Show follower-related fields
      const followerKeys = Object.keys(sample).filter(k => /follow|connect|fan/i.test(k));
      console.log('Follower-related fields:');
      for (const k of followerKeys) {
        console.log(`  ${k}:`, sample[k]);
      }
      // Show date fields
      const dateKeys = Object.keys(sample).filter(k => /date|time|publish|post/i.test(k));
      console.log('Date-related fields:');
      for (const k of dateKeys) {
        console.log(`  ${k}:`, JSON.stringify(sample[k])?.slice(0, 100));
      }
      // Show engagement fields
      console.log('Stats/engagement:', sample.stats ? JSON.stringify(sample.stats) : 'no stats field');
      console.log('Text:', (sample.text ?? sample.commentary ?? sample.body ?? '').slice(0, 80));
      // Show id/url fields
      console.log('ID:', sample.id ?? sample.urn);
      console.log('URL:', sample.postUrl ?? sample.url);
    }

    // Check LinkedIn post raw data
    const liPost = await db.collection('posts').findOne({ profile_id: liProfile.id });
    if (liPost) {
      console.log('\n=== LinkedIn Post Raw Data ===');
      const raw = liPost.raw || {};
      console.log('Keys:', Object.keys(raw).sort().join(', '));
      console.log('ID value:', raw.id, typeof raw.id);
      console.log('ID stringified:', JSON.stringify(raw.id)?.slice(0, 100));
      // Date fields
      const dateKeys = Object.keys(raw).filter(k => /date|time|publish|post/i.test(k));
      console.log('Date-related fields:');
      for (const k of dateKeys) {
        console.log(`  ${k}:`, JSON.stringify(raw[k])?.slice(0, 100));
      }
    }
  }

  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
