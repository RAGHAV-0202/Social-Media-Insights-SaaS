import dotenv from 'dotenv';
dotenv.config();

const token = process.env.APIFY_API_KEY || '';

async function run() {
  const safeActor = 'parseforge/x-com-scraper'.replace('/', '~');
  const url = `https://api.apify.com/v2/acts/${safeActor}/run-sync-get-dataset-items?token=${token}&timeout=120`;
  
  const input = {
    profileUrls: ['https://twitter.com/nasdaily'],
    resultsLimit: 5,
    usernames: ['nasdaily'],
    maxItems: 5,
    handles: ['nasdaily'],
    twitterHandles: ['nasdaily'],
    startUrls: [{ url: 'https://twitter.com/nasdaily' }],
    urls: ['https://twitter.com/nasdaily'],
    searchTerms: ['from:nasdaily'],
    tweetsDesired: 5,
    maxTweets: 5,
    addUserInfo: true,
    includeUserInfo: true,
  };

  console.log('Testing parseforge/x-com-scraper with full input:', JSON.stringify(input, null, 2));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    console.error('Failed:', res.status, await res.text());
    return;
  }
  const items = await res.json();
  console.log('Returned items count:', items.length);
  if (items.length > 0) {
    console.log('Sample item keys:', Object.keys(items[0]));
    console.log('Sample item (truncated):', JSON.stringify(items[0], null, 2).slice(0, 1000));
  } else {
    console.log('No items returned');
  }
}

run().catch(console.error);
