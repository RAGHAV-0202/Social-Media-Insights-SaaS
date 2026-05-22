import dotenv from 'dotenv';
dotenv.config();

const token = process.env.APIFY_API_KEY || '';

async function run() {
  const safeActor = 'scraper_one/x-profile-posts-scraper'.replace('/', '~');
  const url = `https://api.apify.com/v2/acts/${safeActor}/run-sync-get-dataset-items?token=${token}&timeout=60`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profileUrls: ['https://twitter.com/Nike'],
      resultsLimit: 1
    }),
  });
  if (!res.ok) {
    console.error('Failed:', res.status, await res.text());
    return;
  }
  const items = await res.json();
  console.log('Complete item keys:', Object.keys(items[0] || {}));
  console.log('Complete item:', JSON.stringify(items[0], null, 2));
}

run().catch(console.error);
