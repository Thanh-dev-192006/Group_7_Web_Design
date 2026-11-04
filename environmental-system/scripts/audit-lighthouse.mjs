// Node.js 22+. Install lighthouse in %TEMP%/group7-lighthouse first.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
const modules = path.join(os.tmpdir(), 'group7-lighthouse/node_modules');
const {default: lighthouse} = await import(pathToFileURL(path.join(modules, 'lighthouse/core/index.js')));
const {launch} = await import(pathToFileURL(path.join(modules, 'chrome-launcher/dist/index.js')));
const out = fileURLToPath(new URL('../docs/lighthouse/', import.meta.url));
fs.mkdirSync(out, {recursive:true});
const url = 'https://group-7-web-design-02.onrender.com/';
const modes = process.argv[2] ? [process.argv[2]] : ['mobile', 'desktop'];
if (modes.some(mode => !['mobile','desktop'].includes(mode))) throw new Error('Use mobile or desktop');
for (const mode of modes) {
  const chrome = await launch({chromePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', chromeFlags:['--headless=new','--no-first-run']});
  try {
    const config = mode === 'desktop' ? (await import(pathToFileURL(path.join(modules,'lighthouse/core/config/desktop-config.js')))).default : undefined;
    const result = await lighthouse(url, {port:chrome.port,output:['json','html'],onlyCategories:['performance','accessibility','best-practices','seo'],logLevel:'error'}, config);
    fs.writeFileSync(path.join(out,`lighthouse-${mode}.json`),result.report[0]);
    fs.writeFileSync(path.join(out,`lighthouse-${mode}.html`),result.report[1]);
    console.log(JSON.stringify({mode,url:result.lhr.finalDisplayedUrl,date:result.lhr.fetchTime,error:result.lhr.runtimeError,scores:Object.fromEntries(Object.entries(result.lhr.categories).map(([k,v])=>[k,v.score]))}));
  } finally {await chrome.kill();}
}
