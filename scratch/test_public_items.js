import fetch from 'node-fetch';

const apiKey = '01d50491829d6991b64f116b1f34b70924889a2f99a7ea81820fe8a3323da060';

async function test() {
  try {
    const res = await fetch('https://api.kirka.io/api/inventory/items', {
      headers: {
        'ApiKey': apiKey
      }
    });
    
    if (res.ok) {
      const items = await res.json();
      console.log('Total items fetched:', items.length);
      
      // Filter for some weapon skins
      const weaponSkins = items.filter(i => i.type === 'WEAPON_SKIN');
      console.log('Sample weapon skins (first 5):', JSON.stringify(weaponSkins.slice(0, 5), null, 2));
    } else {
      console.log('Failed to fetch items:', res.status, await res.text());
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
