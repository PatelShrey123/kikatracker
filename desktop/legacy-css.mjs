// The desktop app runs on Electron 11 (Chrome 87): on macOS that's the last kind of Electron that can
// actually show an uncapped frame rate, which is why Kirka's own client is on Electron 10. Tailwind's CSS
// is written for Chrome 111+, so after the build this rewrites it into something Chrome 87 understands:
//   :where()  -> :is() -> plain selectors   (Chrome 88)
//   @layer    -> ordinary rules, in the same priority order   (Chrome 99)
//   color-mix(), oklch(), nesting and the rest -> older equivalents, by Lightning CSS
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import cascadeLayers from '@csstools/postcss-cascade-layers';
import isPseudoClass from '@csstools/postcss-is-pseudo-class';
import { transform } from 'lightningcss';

const here = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(here, 'app', 'assets');
const CHROME_87 = 87 << 16;

/** :where() only differs from :is() in specificity, and the layer step below re-orders by specificity anyway. */
const whereToIs = {
  postcssPlugin: 'where-to-is',
  Rule(rule) {
    if (rule.selector.includes(':where(')) rule.selector = rule.selector.replace(/:where\(/g, ':is(');
  },
};

const count = (css, s) => css.split(s).length - 1;

for (const file of fs.readdirSync(assets).filter((f) => f.endsWith('.css'))) {
  const full = path.join(assets, file);
  const input = fs.readFileSync(full, 'utf8');
  // colours and syntax first, so the selector and layer steps see plain CSS
  const lowered = transform({ filename: file, code: Buffer.from(input), minify: false, targets: { chrome: CHROME_87 } }).code.toString();
  const result = await postcss([whereToIs, isPseudoClass({ preserve: false }), cascadeLayers()]).process(lowered, { from: full });
  const output = transform({ filename: file, code: Buffer.from(result.css), minify: true, targets: { chrome: CHROME_87 } }).code.toString();
  fs.writeFileSync(full, output);
  const left = [':where(', ':is(', '@layer', 'color-mix(', 'oklch('].map((s) => `${s} ${count(output, s)}`).join(', ');
  console.log(`${file}: ${(input.length / 1024).toFixed(0)} KB -> ${(output.length / 1024).toFixed(0)} KB; left: ${left}`);
}
