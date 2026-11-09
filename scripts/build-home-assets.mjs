// Copies the handful of skins the home page film uses out of the catalog and into public/home, so
// the film needs neither the 2.5 MB catalog nor kirka.io to be up. Re-run if the line-up changes.
import fs from 'fs';
import path from 'path';

const OUT = 'public/home';
const CHARACTERS = ['Gore', 'Slasher', 'Skeletain', 'Doombringer', 'Onryo', 'Thriller', 'Pumpreaper', 'Kingdracula'];
const WEAPONS = [
  ['SCAR', 'Apollo'],
  ['LAR', 'Bloodbath'],
  ['M60', 'Born'],
  ['AR-9', 'Astral'],
  ['Tomahawk', 'Alucard'],
  ['Shark', 'Hellbent'],
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const catalog = JSON.parse(fs.readFileSync('public/data/items.json', 'utf8'));
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

async function save(item, file) {
  const url = item.textureUrl || '';
  const dataAt = url.indexOf('data:image');
  let bytes;
  if (dataAt !== -1) {
    bytes = Buffer.from(url.slice(url.indexOf(',', dataAt) + 1), 'base64');
  } else {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${item.name}: ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
  }
  // Kirka serves its index page for a missing file, so check that this really is an image.
  const isPng = bytes.subarray(1, 4).toString() === 'PNG';
  const isWebp = bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (!isPng && !isWebp) throw new Error(`${item.name}: ${url.slice(0, 80)} is not an image`);
  const named = `${file}.${isPng ? 'png' : 'webp'}`;
  fs.writeFileSync(path.join(OUT, named), bytes);
  console.log(named, Math.round(bytes.length / 1024), 'KB');
}

for (const name of CHARACTERS) {
  const item = catalog.find((i) => i.type === 'BODY_SKIN' && i.name === name);
  if (!item) throw new Error(`no character ${name}`);
  await save(item, `c-${slug(name)}`);
}
for (const [weapon, name] of WEAPONS) {
  const item = catalog.find((i) => i.parent?.name === weapon && i.name === name);
  if (!item) throw new Error(`no ${weapon} skin ${name}`);
  await save(item, `w-${slug(weapon)}`);
}
