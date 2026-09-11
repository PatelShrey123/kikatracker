// api/bot-stats.js - Server-side endpoint to fetch bot statistics without exposing keys to frontend
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const supabaseUrl = process.env.SUPABASE_URL || 'https://bxebfeyqchjukibgfeqs.supabase.co';
  const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_I5SYfP4fDrzFP3_bPcXg9A_sUuuuWD2';

  let linkedCount = 57;
  let customBgCount = 24;
  const serverCount = 19;
  const userReach = 2688;

  try {
    if (supabaseKey) {
      // Query exact count of linked accounts
      const r = await fetch(`${supabaseUrl}/rest/v1/linked_accounts?select=discord_id`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'count=exact'
        }
      });

      if (r.ok) {
        const cr = r.headers.get('content-range');
        if (cr) {
          const parts = cr.split('/');
          if (parts[1] && !isNaN(parseInt(parts[1], 10))) {
            linkedCount = parseInt(parts[1], 10);
          }
        }
      }

      // Query exact count of custom backgrounds
      const bgRes = await fetch(`${supabaseUrl}/rest/v1/user_backgrounds?select=user_id`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'count=exact'
        }
      });

      if (bgRes.ok) {
        const cr = bgRes.headers.get('content-range');
        if (cr) {
          const parts = cr.split('/');
          if (parts[1] && !isNaN(parseInt(parts[1], 10))) {
            customBgCount = parseInt(parts[1], 10);
          }
        }
      }
    }
  } catch (err) {
    console.error('Bot stats error:', err);
  }

  res.status(200).json({
    linkedCount,
    customBgCount,
    serverCount,
    userReach
  });
}

