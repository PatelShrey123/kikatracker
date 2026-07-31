import fetch from 'node-fetch';

const apiKey = '01d50491829d6991b64f116b1f34b70924889a2f99a7ea81820fe8a3323da060';

async function test() {
  try {
    // 1. Get profile of YQueFue
    const profileRes = await fetch('https://api.kirka.io/api/user/getProfile', {
      method: 'POST',
      headers: {
        'ApiKey': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: 'YQueFue', isShortId: false })
    });
    
    if (profileRes.ok) {
      const profile = await profileRes.json();
      console.log('Profile of YQueFue:', JSON.stringify(profile, null, 2));
      
      // 2. Get inventory
      const invRes = await fetch('https://api.kirka.io/api/inventory/user', {
        method: 'POST',
        headers: {
          'ApiKey': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: profile.id, isShortId: false })
      });
      
      if (invRes.ok) {
        const inv = await invRes.json();
        console.log('Inventory sample (first 3 items):', JSON.stringify(inv.slice(0, 3), null, 2));
      }
    } else {
      console.log('Failed to fetch profile:', profileRes.status, await profileRes.text());
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
