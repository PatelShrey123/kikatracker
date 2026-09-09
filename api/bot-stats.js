// api/bot-stats.js - Server-side endpoint to fetch bot statistics without exposing keys to frontend
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const supabaseUrl = process.env.SUPABASE_URL || 'https://bxebfeyqchjukibgfeqs.supabase.co';
  const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_I5SYfP4fDrzFP3_bPcXg9A_sUuuuWD2';

  try {
    if (!supabaseKey) {
      return res.status(200).json({ linkedCount: 8 });
    }

    const r = await fetch(`${supabaseUrl}/rest/v1/linked_accounts?select=count`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data) && data[0] && typeof data[0].count === 'number') {
        return res.status(200).json({ linkedCount: data[0].count, serverCount: 18 });
      }
    }
  } catch (err) {
    console.error('Bot stats error:', err);
  }

  res.status(200).json({ linkedCount: 8, serverCount: 18 });
}
