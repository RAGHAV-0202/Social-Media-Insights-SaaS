#!/usr/bin/env node
const ACTORS = {
  facebook:  "apify/facebook-pages-scraper",
  instagram: "apify/instagram-profile-scraper",
  tiktok:    "clockworks/tiktok-scraper",
  youtube:   "streamers/youtube-channel-scraper",
  twitter:   "apidojo/twitter-user-scraper",
  linkedin: [
    'vulnv/linkedin-profile-scraper',
    'dev_fusion/Linkedin-Profile-Scraper',
    'apimaestro/linkedin-profile-posts',
    'apify/linkedin-profile-scraper'
  ],
};

const token = process.env.APIFY_API_KEY || '';
if (!token) {
  console.error('Please set APIFY_API_KEY in the environment');
  process.exit(2);
}

function buildInputFor(actorKey, profileUrl, handle) {
  switch(actorKey) {
    case 'facebook': return { startUrls: [{ url: profileUrl }], urls: [profileUrl], resultsLimit: 5 };
    case 'instagram': return { usernames: [handle], startUrls: [{ url: profileUrl }], resultsLimit: 5 };
    case 'tiktok': return { profiles: [handle], startUrls: [{ url: profileUrl }], resultsPerPage: 5 };
    case 'youtube': return { startUrls: [{ url: profileUrl }], urls: [profileUrl], maxResults: 5 };
    case 'twitter': return { twitterHandles: [handle], startUrls: [profileUrl], urls: [profileUrl], maxItems: 5 };
    case 'linkedin': return { urls: [profileUrl], startUrls: [{ url: profileUrl }], limit: 10 };
    default: return { urls: [profileUrl] };
  }
}

async function runOne(actor, input) {
  const safeActor = actor.replace('/', '~');
  const url = `https://api.apify.com/v2/acts/${safeActor}/run-sync-get-dataset-items?token=${token}&timeout=30`;
  try {
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input)
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, body: text };
    }
    try {
      const data = JSON.parse(text);
      return { ok: true, data };
    } catch (e) {
      return { ok: true, data: text };
    }
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function runAll() {
  const samples = [
    { key: 'instagram', url: 'https://www.instagram.com/nike/', handle: 'nike' },
    { key: 'tiktok', url: 'https://www.tiktok.com/@nike', handle: 'nike' },
    { key: 'youtube', url: 'https://www.youtube.com/@nike/videos', handle: 'nike' },
    { key: 'facebook', url: 'https://www.facebook.com/nike', handle: 'nike' },
    { key: 'twitter', url: 'https://twitter.com/Nike', handle: 'Nike' },
    { key: 'linkedin', url: 'https://www.linkedin.com/company/nike', handle: 'nike' },
  ];

  for (const s of samples) {
    const actor = ACTORS[s.key];
    const candidates = Array.isArray(actor) ? actor : [actor];
    console.log('\n===', s.key.toUpperCase(), 'candidates:', candidates.join(', '));
    let success = false;
    for (const c of candidates) {
      const input = buildInputFor(s.key, s.url, s.handle);
      process.stdout.write(`- Trying ${c} ... `);
      const res = await runOne(c, input);
      if (!res.ok) {
        console.log(`FAILED (status=${res.status || 'err'})`);
        if (res.body) console.log('  body:', String(res.body).slice(0,300));
        if (res.error) console.log('  error:', res.error);
        continue;
      }
      try {
        const items = res.data;
        if (Array.isArray(items) && items.length) {
          console.log(`OK - returned ${items.length} items; sample keys:`, Object.keys(items[0]).slice(0,20));
        } else if (typeof items === 'object') {
          console.log('OK - returned object; keys:', Object.keys(items).slice(0,20));
        } else {
          console.log('OK - response:', String(items).slice(0,200));
        }
        success = true;
        break;
      } catch (e) {
        console.log('OK - but failed to parse response preview', e);
        success = true;
        break;
      }
    }
    if (!success) console.log(`=> ${s.key} all candidates failed.`);
  }
}

runAll().catch(e => { console.error('Test runner error:', e); process.exit(1); });
