import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inspect = (file) => {
  try {
    const glbPath = path.join(__dirname, `../public/models/KirkaWeapons/${file}`);
    const buf = fs.readFileSync(glbPath);
    const jsonLen = buf.readUInt32LE(12);
    const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
    const json = JSON.parse(jsonStr);
    console.log(`${file} Images:`, json.images || 'none', 'Textures:', json.textures || 'none');
  } catch (e) {
    console.log(`Failed to read ${file}`, e.message);
  }
};

inspect('LAR.glb');
inspect('Bayonet.glb');
inspect('M60.glb');
inspect('MAC-10.glb');
inspect('Shark.glb');
inspect('VITA.glb');
inspect('Weatie.glb');
