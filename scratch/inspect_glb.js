import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const glbPath = path.join(__dirname, '../public/models/KirkaWeapons/SCAR.glb');
const buf = fs.readFileSync(glbPath);

const jsonLen = buf.readUInt32LE(12);
const jsonStr = buf.toString('utf8', 20, 20 + jsonLen);
const json = JSON.parse(jsonStr);

console.log('SCAR GLB Nodes/Meshes:', JSON.stringify({
  meshes: json.meshes,
  materials: json.materials,
  textures: json.textures,
  images: json.images
}, null, 2));
