import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
 for(const width of [320,375,390,430]){
 const page=await browser.newPage({viewport:{width,height:width===320?568:844},isMobile:true,hasTouch:true});
 page.setDefaultTimeout(8000);
 const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173/'))external.push(r.url())});
 await page.goto('http://127.0.0.1:4173/'); 
 await page.getByRole('button',{name:'TAP TO START',exact:true}).waitFor();
 assert.equal(await page.locator('.tutorial').count(),0);
 await page.getByRole('button',{name:'TAP TO START',exact:true}).tap();
 
 await page.waitForFunction(()=>document.querySelector('.rt-preroll'),null,{timeout:8000});
 await page.waitForFunction(()=>!document.querySelector('.game .modal')&&!document.querySelector('.rt-preroll'));
 assert.equal(await page.locator('.pad').count(),3);
 assert(await page.locator('.note').count()>0);
 const sizes=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}));
 assert(sizes.width<=sizes.viewport);
 await page.getByRole('button',{name:'Pause track'}).tap();
 await page.getByText('PAUSED',{exact:true}).waitFor({state:'attached'});
 await page.getByRole('button',{name:'RESUME',exact:true}).tap();
 await page.getByRole('button',{name:'Exit track',exact:true}).tap();
 await page.getByRole('button',{name:'TAP TO START',exact:true}).waitFor();
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await page.screenshot({path:`portal-${width}.png`});
 console.log(JSON.stringify({width,oneTap:true,lanes:3,externalRequests:external.length,errors}));
 await page.close();
 }
}finally{await browser.close()}
