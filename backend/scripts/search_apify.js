async function run() {
  const url = 'https://api.apify.com/v2/store?search=twitter&limit=30';
  const res = await fetch(url);
  if (!res.ok) {
    console.error('Failed to search store:', res.status, await res.text());
    return;
  }
  const data = await res.json();
  const items = data.data?.items || [];
  console.log(`Found ${items.length} actors matching 'twitter':`);
  for (const item of items) {
    console.log(`- ${item.username}/${item.name}: ${item.title}`);
    console.log(`  pricingModel: ${item.pricingModel}, objectId: ${item.objectId}`);
    console.log(`  currentVersion: ${item.currentVersion?.version}`);
    console.log(`  stats: views=${item.stats?.views}, runs=${item.stats?.runs}`);
    console.log(`  description: ${item.description?.slice(0, 150)}...`);
    console.log('---');
  }
}

run().catch(console.error);
