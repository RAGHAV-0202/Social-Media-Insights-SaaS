import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/social_insights';

async function run() {
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  // Latest refresh run
  const runs = await db.collection('refreshruns').find().sort({ started_at: -1 }).limit(2).toArray();
  console.log('\n=== Latest Refresh Runs ===');
  for (const r of runs) {
    console.log(JSON.stringify({ status: r.status, errors: r.errors, profiles_updated: r.profiles_updated, posts_upserted: r.posts_upserted, started_at: r.started_at, finished_at: r.finished_at }, null, 2));
  }

  // Profiles
  const profiles = await db.collection('profiles').find().toArray();
  console.log('\n=== Profiles ===');
  for (const p of profiles) {
    console.log(JSON.stringify({ id: p.id, platform: p.platform, handle: p.handle, display_name: p.display_name, avatar_url: p.avatar_url?.slice(0, 80) }));
  }

  // Snapshots per profile
  console.log('\n=== Snapshots per profile ===');
  const snapshots = await db.collection('profilesnapshots').find().sort({ captured_at: -1 }).toArray();
  const snapByProfile = {};
  for (const s of snapshots) {
    if (!snapByProfile[s.profile_id]) snapByProfile[s.profile_id] = [];
    snapByProfile[s.profile_id].push({ followers: s.followers, following: s.following, total_posts: s.total_posts, total_views: s.total_views, captured_at: s.captured_at });
  }
  for (const [pid, snaps] of Object.entries(snapByProfile)) {
    const prof = profiles.find(p => p.id === pid);
    console.log(`\n  ${prof?.platform} (@${prof?.handle}): ${snaps.length} snapshot(s)`);
    console.log('  Latest:', JSON.stringify(snaps[0]));
  }

  // Posts per profile
  console.log('\n=== Posts per profile ===');
  const posts = await db.collection('posts').find().toArray();
  const postsByProfile = {};
  for (const p of posts) {
    if (!postsByProfile[p.profile_id]) postsByProfile[p.profile_id] = [];
    postsByProfile[p.profile_id].push(p);
  }
  for (const [pid, pp] of Object.entries(postsByProfile)) {
    const prof = profiles.find(p => p.id === pid);
    const sample = pp[0];
    console.log(`\n  ${prof?.platform} (@${prof?.handle}): ${pp.length} post(s)`);
    console.log('  Sample post:', JSON.stringify({ 
      external_id: sample.external_id, 
      posted_at: sample.posted_at, 
      likes: sample.likes, comments: sample.comments, shares: sample.shares, views: sample.views,
      caption: sample.caption?.slice(0, 60),
      url: sample.url?.slice(0, 80),
      media_type: sample.media_type,
    }));
  }

  // Check platforms with 0 posts
  for (const p of profiles) {
    if (!postsByProfile[p.id] || postsByProfile[p.id].length === 0) {
      console.log(`\n  ⚠️  ${p.platform} (@${p.handle}): 0 posts stored`);
    }
  }

  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
