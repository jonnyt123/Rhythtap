import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit,devices} from 'playwright';

const target=process.env.RHYTHTAP_QA_URL||'http://127.0.0.1:4173/Rhythtap/';
const out=path.resolve(process.env.RHYTHTAP_QA_OUT||'qa-artifacts');
await fs.mkdir(out,{recursive:true});
const issues=[];
const add=(browser,severity,title,detail)=>issues.push({browser,severity,title,detail});
const vis=async(locator,ms=3000)=>{try{await locator.waitFor({state:'visible',timeout:ms});return true}catch{return false}};
const snap=(page,name)=>page.screenshot({path:path.join(out,`release-blocker-${name}.png`),fullPage:false});

async function prepare(page){
 await page.goto(target,{waitUntil:'domcontentloaded',timeout:45000});
 await page.evaluate(()=>{
  localStorage.setItem('rhythmtap-tutorial-complete-v1','1');
  localStorage.setItem('rhythtap-tutorial-seen','1');
  localStorage.setItem('rhythtap-graphics','LOW');
 });
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForTimeout(500);
}

async function enterHardSolo(page){
 const solo=page.locator('button').filter({hasText:'SOLO PLAY'}).first();
 if(!(await vis(solo,4000)))throw new Error('SOLO PLAY button not available');
 await solo.click({force:true});
 if(!(await vis(page.locator('.select'),4000)))throw new Error('Track select did not render');
 const hard=page.locator('.difficulty button').filter({hasText:'HARD'}).first();
 if(!(await vis(hard)))throw new Error('HARD difficulty button not available');
 await hard.click();
 const play=page.locator('.playdock .primary').first();
 if(!(await vis(play)))throw new Error('PLAY button not available');
 await play.click();
 if(!(await vis(page.locator('.game'),4000)))throw new Error('Game screen did not render');
 const start=page.locator('button').filter({hasText:'TAP TO START'}).first();
 if(await vis(start,2500))await start.click();
 await page.waitForTimeout(6500);
 if(!(await vis(page.locator('.game'),3000)))throw new Error('Gameplay did not survive preroll');
}

async function noteY(page){
 return page.locator('.note[data-time]').first().evaluate(el=>getComputedStyle(el).getPropertyValue('--note-y')).catch(()=>null);
}

// Minimum supported iPhone-class viewport: runtime retry, pause/resume and layout safety.
{
 const browser=await webkit.launch({headless:true});
 try{
  const context=await browser.newContext({
   viewport:{width:375,height:667},screen:{width:375,height:667},deviceScaleFactor:2,
   isMobile:true,hasTouch:true,locale:'en-CA',timezoneId:'America/Toronto',
   userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
  });
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await prepare(page);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  if(overflow>3)add('webkit-iphone8','high','iPhone 8 home has horizontal overflow',`${overflow}px beyond viewport`);
  await snap(page,'iphone8-home');
  try{await enterHardSolo(page)}catch(error){add('webkit-iphone8','critical','iPhone 8 cannot start Hard gameplay',String(error));}
  if(await vis(page.locator('.game'),1500)){
   await snap(page,'iphone8-hard-running');
   const bg=await context.newPage();await bg.setContent('<p>background</p>');await bg.bringToFront();await page.waitForTimeout(900);await page.bringToFront();
   if(!(await vis(page.locator('.modal').filter({hasText:'PAUSED'}),2500)))add('webkit-iphone8','high','Safari background did not pause gameplay','Expected PAUSED modal after visibility loss');
   const resume=page.locator('button').filter({hasText:'RESUME'}).first();
   if(await vis(resume,1500)){
    const before=await noteY(page);await resume.click();await page.waitForTimeout(600);const after=await noteY(page);
    if(before&&after&&before===after)add('webkit-iphone8','high','Gameplay clock remained frozen after resume',`note position stayed at ${before}`);
   }
   await bg.close();

   // Let an untouched Hard run fail, then verify retry fully restarts movement instead of freezing/miss-looping.
   const failed=page.locator('.song-failed');
   if(!(await vis(failed,22000)))add('webkit-iphone8','high','Hard song did not reach deterministic fail state','Expected SONG FAILED after sustained misses');
   else{
    await snap(page,'iphone8-song-failed');
    const retry=page.locator('button').filter({hasText:'RETRY SONG'}).first();
    await retry.click();
    await page.waitForTimeout(6500);
    if(await vis(page.locator('.song-failed'),800))add('webkit-iphone8','critical','Retry immediately returned to failed state','Failure state leaked into retry');
    const y1=await noteY(page);await page.waitForTimeout(450);const y2=await noteY(page);
    if(!y1||!y2)add('webkit-iphone8','high','Retry produced no moving note sample','No visible note after retry preroll');
    else if(y1===y2)add('webkit-iphone8','critical','Retry gameplay is frozen',`note position stayed at ${y1}`);
    await snap(page,'iphone8-retry-running');
   }
  }
  for(const e of errors)add('webkit-iphone8','critical','iPhone 8 page exception',e);
  await context.close();
 }finally{await browser.close()}
}

// Conservative Android baseline stress gate. CPU throttling is intentionally synthetic;
// it is a regression detector, not a claim that CI emulates a specific SoC exactly.
{
 const browser=await chromium.launch({headless:true});
 try{
  const profile=devices['Pixel 5'];
  const context=await browser.newContext({...profile,locale:'en-CA',timezoneId:'America/Toronto'});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const cdp=await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await prepare(page);
  try{await enterHardSolo(page)}catch(error){add('chromium-android-throttled','critical','Throttled Android cannot start Hard gameplay',String(error));}
  if(await vis(page.locator('.game'),1500)){
   await page.waitForTimeout(6500);
   const perf=await page.evaluate(()=>{try{return JSON.parse(document.documentElement.dataset.gamePerf||'null')}catch{return null}});
   if(!perf)add('chromium-android-throttled','high','No gameplay performance telemetry produced','Expected data-game-perf sample during Hard gameplay');
   else{
    if(Number(perf.fps)<30)add('chromium-android-throttled','high','Hard gameplay falls below regression floor',`fps=${perf.fps}, p95=${perf.p95Ms}ms`);
    if(Number(perf.p95Ms)>55)add('chromium-android-throttled','high','Hard gameplay frame-time tail exceeds regression floor',`fps=${perf.fps}, p95=${perf.p95Ms}ms`);
   }
   await snap(page,'android-throttled-hard');
  }
  for(const e of errors)add('chromium-android-throttled','critical','Throttled Android page exception',e);
  await context.close();
 }finally{await browser.close()}
}

const order={critical:4,high:3,medium:2,low:1};issues.sort((a,b)=>order[b.severity]-order[a.severity]);
const report={target,generatedAt:new Date().toISOString(),issues};
await fs.writeFile(path.join(out,'release-blocker-report.json'),JSON.stringify(report,null,2));
const md=['# RhythmTap release-blocker QA','',`Target: ${target}`,`Issues: ${issues.length}`,'',...issues.map((i,n)=>`${n+1}. **${i.severity.toUpperCase()} — ${i.title}** (${i.browser})\n   ${i.detail}`)].join('\n');
await fs.writeFile(path.join(out,'release-blocker-report.md'),md);console.log(md);
if(issues.some(i=>i.severity==='critical'||i.severity==='high'))process.exitCode=1;
