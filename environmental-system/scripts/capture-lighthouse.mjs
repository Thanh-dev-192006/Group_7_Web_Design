import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
const {launch} = await import(pathToFileURL(path.join(os.tmpdir(),'group7-lighthouse/node_modules/chrome-launcher/dist/index.js')));
const directory=fileURLToPath(new URL('../docs/lighthouse/',import.meta.url));
const figures=fileURLToPath(new URL('../docs/figures/',import.meta.url));
fs.mkdirSync(figures,{recursive:true});
const browser=await launch({chromePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',chromeFlags:['--headless=new','--allow-file-access-from-files']});
let ws;
try {
 const tabs=await (await fetch(`http://localhost:${browser.port}/json`)).json();
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
 let id=0;const pending=new Map();
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 for(const mode of ['mobile','desktop']){
  await send('Page.navigate',{url:pathToFileURL(path.join(directory,`lighthouse-${mode}.html`)).href});
  for(let n=0;n<100;n++){
   const r=await send('Runtime.evaluate',{expression:'document.querySelectorAll(".lh-gauge__percentage").length',returnByValue:true});
   if(r.result.value>=4)break;
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  await new Promise(resolve=>setTimeout(resolve,500));
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width:1440,height:1000,scale:1}});
  fs.writeFileSync(path.join(figures,`lighthouse-${mode}.png`),Buffer.from(shot.data,'base64'));
  console.log('Saved lighthouse-'+mode+'.png');
 }
} finally {ws?.close();await browser.kill();}
