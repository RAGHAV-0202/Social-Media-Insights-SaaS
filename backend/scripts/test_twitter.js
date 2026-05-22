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

async function test() {
  const platform = 'twitter';
  const handle = 'nasdaily';
  const profileUrl = 'https://twitter.com/nasdaily';

  // Test 1: apidojo/twitter-scraper-lite with searchTerms
  try {
    console.log('\n--- Testing apidojo/twitter-scraper-lite with searchTerms: ["from:nasdaily"] ---');
    const items = await runActor('apidojo/twitter-scraper-lite', {
      searchTerms: [`from:${handle}`],
      maxItems: 3,
    });
    console.log(`Returned ${items.length} items. Sample item keys:`, items.length > 0 ? Object.keys(items[0]) : 'None');
    if (items.length > 0) {
      console.log('Sample item:', JSON.stringify(items[0], null, 2).slice(0, 600));
    }
  } catch (e) {
    console.error('Test 1 failed:', e.message);
  }

  // Test 2: apidojo/twitter-scraper-lite with twitterHandles
  try {
    console.log('\n--- Testing apidojo/twitter-scraper-lite with twitterHandles: ["nasdaily"] ---');
    const items = await runActor('apidojo/twitter-scraper-lite', {
      twitterHandles: [handle],
      maxItems: 3,
    });
    console.log(`Returned ${items.length} items. Sample item keys:`, items.length > 0 ? Object.keys(items[0]) : 'None');
    if (items.length > 0) {
      console.log('Sample item:', JSON.stringify(items[0], null, 2).slice(0, 600));
    }
  } catch (e) {
    console.error('Test 2 failed:', e.message);
  }

  // Test 3: apidojo/tweet-scraper with twitterHandles
  try {
    console.log('\n--- Testing apidojo/tweet-scraper with twitterHandles: ["nasdaily"] ---');
    const items = await runActor('apidojo/tweet-scraper', {
      twitterHandles: [handle],
      maxItems: 3,
    });
    console.log(`Returned ${items.length} items. Sample item keys:`, items.length > 0 ? Object.keys(items[0]) : 'None');
    if (items.length > 0) {
      console.log('Sample item:', JSON.stringify(items[0], null, 2).slice(0, 600));
    }
  } catch (e) {
    console.error('Test 3 failed:', e.message);
  }
}

test().catch(console.error);
