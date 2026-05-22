import dotenv from 'dotenv';
dotenv.config();

const token = process.env.APIFY_API_KEY || '';

async function runActor(actor, input) {
  const safeActor = actor.replace('/', '~');
  const url = `https://api.apify.com/v2/acts/${safeActor}/run-sync-get-dataset-items?token=${token}&timeout=60`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify ${actor} ${res.status}: ${text.slice(0, 500)}`);
  }
  return await res.json();
}

async function testActor(actor, input) {
  try {
    console.log(`\n--- Testing ${actor} with input: ${JSON.stringify(input)} ---`);
    const items = await runActor(actor, input);
    console.log(`Returned ${items.length} items.`);
    if (items.length > 0) {
      console.log('Sample item keys:', Object.keys(items[0]));
      console.log('Sample item:', JSON.stringify(items[0], null, 2).slice(0, 1000));
    }
  } catch (e) {
    console.error(`Testing ${actor} failed:`, e.message);
  }
}

async function test() {
  const handle = 'nasdaily';
  
  // 1. parseforge/x-com-scraper (usernames format)
  await testActor('parseforge/x-com-scraper', {
    usernames: [handle],
    maxItems: 3,
  });

  // 2. parseforge/x-com-scraper (startUrls format)
  await testActor('parseforge/x-com-scraper', {
    startUrls: [`https://twitter.com/${handle}`],
    maxItems: 3,
  });

  // 3. scraper_one/x-profile-posts-scraper
  await testActor('scraper_one/x-profile-posts-scraper', {
    profileUrls: [`https://twitter.com/${handle}`],
    resultsLimit: 3,
  });
}

test().catch(console.error);
