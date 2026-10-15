// Usage: PLAYWRIGHT_MODULE_PATH=/absolute/module node scripts/image-export.mjs input.html output.png [width height]
import fs from 'node:fs/promises';
import { exportSocialPng } from '../server/src/harness/stable-export.js';
const [input,output,w='1080',h='1350']=process.argv.slice(2);
if(!input||!output)throw new Error('Provide input HTML and output PNG paths');
const width=Number(w),height=Number(h);if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>4096||height>4096)throw new Error('Invalid PNG dimensions');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const png=await exportSocialPng(await fs.readFile(input,'utf8'),{chromium,width,height});
await fs.writeFile(output,png);console.log(`Saved PNG ${width}x${height}`);
