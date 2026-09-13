import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit,devices} from 'playwright';

const target=process.env.RHYTHTAP_QA_URL||'http://127.0.0.1:4173/Rhythtap/';
const out=path.resolve(process.env.RHYTHTAP_QA_OUT||'qa-artifacts');
await fs.mkdir(out,{recursive:true});
const issues=[];const notes=[];
const add=(browser,severity,title,detail)=>issues.push({browser,severity,title,detail});
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-');
async function vis(locator,ms=2000){try{await locator.waitFor({state:'visible',timeout:ms});return true}catch{return false}}
async function snap(page,browser,name){await page.screenshot({path:path.join(out,`${browser}-${name}.png`),fullPage:false});}
async function fresh(browser,engine,{landscape=false}={}){
 const profile=devices['iPhone 14'];
 const context=await browser.newContext({...profile,viewport:landscape?{width:844,height:390}:profile.viewport,screen:landscape?{width:844,height:390}:profile.screen,locale:'en-CA',timezoneId:'America/Toronto'});
 const page=await context.newPage();
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
 await page.goto(target,{waitUntil:'domcontentloaded',timeout:45000});
 await page.evaluate(()=>{localStorage.setItem('rhythmtap-tutorial-complete-v1','1');localStorage.setItem('rhythtap-tutorial-seen','1')});
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(700);
 return{context,page,pageErrors};
}
async function requireHome(page,browser,label){
 const home=page.locator('.metal-home,.home');
 if(!(await vis(home,4000))){add(browser,'critical',`${label}: home not rendered`,(await page.locator('#root').innerText().catch(()=>'' )).slice(0,300));return false}
 const text=(await page.locator('#root').innerText()).trim();if(!text)add(browser,'critical',`${label}: home DOM is empty`,'#root has no visible text');return Boolean(text);
}
async function checkOverflow(page,browser,label){const x=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);if(x>3)add(browser,'medium',`${label}: horizontal overflow`,`${x}px beyond viewport`)}

async function runEngine(browserName,engine){
 const browser=await engine.launch({headless:true});
 try{
  // First-launch tutorial is independently reachable and paintable.
  {
   const context=await browser.newContext({...devices['iPhone 14'],locale:'en-CA',timezoneId:'America/Toronto'});const page=await context.newPage();
   await page.goto(target,{waitUntil:'domcontentloaded',timeout:45000});await page.waitForTimeout(700);
   if(!(await vis(page.locator('.tutorial-screen'),3000)))add(browserName,'high','First-launch tutorial did not render','Expected .tutorial-screen on clean storage');
   await snap(page,browserName,'01-first-launch');await context.close();
  }

  // Home portrait and separate landscape context (no viewport mutation in-place).
  {
   const{context,page,pageErrors}=await fresh(browser,engine);if(await requireHome(page,browserName,'Portrait')){await checkOverflow(page,browserName,'Portrait home');await snap(page,browserName,'02-home-portrait')}
   for(const e of pageErrors)add(browserName,'critical','Portrait page exception',e);await context.close();
  }
  {
   const{context,page,pageErrors}=await fresh(browser,engine,{landscape:true});if(await requireHome(page,browserName,'Landscape')){await checkOverflow(page,browserName,'Landscape home');await snap(page,browserName,'03-home-landscape')}
   for(const e of pageErrors)add(browserName,'critical','Landscape page exception',e);await context.close();
  }

  // Settings: real keyboard interaction with range, persistence, rapid open/back cycles.
  {
   const{context,page,pageErrors}=await fresh(browser,engine);if(await requireHome(page,browserName,'Settings')){
    const entry=page.locator('button[aria-label="Settings"]').first();if(!(await vis(entry)))add(browserName,'high','Settings button missing','Home rendered without Settings entry');else{
     await entry.click();if(!(await vis(page.locator('.settingsPage'),3000)))add(browserName,'high','Settings screen failed to render','Settings navigation did not produce .settingsPage');else{
      await snap(page,browserName,'04-settings');const speed=page.locator('.settingsPage input[type="range"]').first();
      if(await vis(speed)){await speed.focus();await speed.press('End');await page.waitForTimeout(150);const stored=await page.evaluate(()=>localStorage.getItem('ntr-speed'));if(stored!=='1.5')add(browserName,'high','Note speed failed to persist from real input',`ntr-speed=${stored}`)}
      await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(500);
      if(await requireHome(page,browserName,'Settings reload')){await page.locator('button[aria-label="Settings"]').click();if(await vis(page.locator('.settingsPage'),2500)){const value=await page.locator('.settingsPage input[type="range"]').first().inputValue();if(value!=='1.5')add(browserName,'high','Note speed reset after reload',`Expected 1.5, got ${value}`)}}
      for(let i=0;i<4;i++){const back=page.locator('.settingsPage button[aria-label="Back"]');if(await vis(back,1200))await back.click();if(!(await requireHome(page,browserName,`Settings cycle ${i+1}`)))break;const b=page.locator('button[aria-label="Settings"]');await b.click();if(!(await vis(page.locator('.settingsPage'),1800))){add(browserName,'high','Rapid Settings cycle failed',`Cycle ${i+1}`);break}}
     }
    }
   }
   for(const e of pageErrors)add(browserName,'critical','Settings page exception',e);await context.close();
  }

  // Each menu destination starts from fresh anonymous state so one feature cannot poison the next.
  // Online Battle intentionally redirects signed-out players to RhythmTap ID instead of opening a battle lobby.
  const destinations={'SOLO PLAY':'.select','MY CHARTS':'.imported-library','ACHIEVEMENTS':'.achievementsPage','PROFILE':'.account-screen','ONLINE BATTLE':'.account-screen'};
  for(const[label,selector]of Object.entries(destinations)){
   const{context,page,pageErrors}=await fresh(browser,engine);if(await requireHome(page,browserName,label)){
    const button=page.locator('button').filter({hasText:label}).first();if(!(await vis(button,1600)))notes.push(`${browserName}: ${label} unavailable in anonymous state`);else{await button.click({force:true});const ok=await vis(page.locator(selector),4000);await page.waitForTimeout(400);await snap(page,browserName,`menu-${slug(label)}`);const text=(await page.locator('#root').innerText().catch(()=>'' )).trim();if(!ok||!text)add(browserName,'high',`${label} rendered blank/wrong screen`,`Expected ${selector}; rendered=${ok}; text=${text.length}`);await checkOverflow(page,browserName,label)}}
   for(const e of pageErrors)add(browserName,'critical',`${label} page exception`,e);await context.close();
  }

  // Tour + gameplay + background/foreground + network interruption.
  {
   const{context,page,pageErrors}=await fresh(browser,engine);if(await requireHome(page,browserName,'Tour')){
    const tour=page.locator('.tour-main-cta');if(await vis(tour)){await tour.click();if(!(await vis(page.locator('.career-tour'),4000)))add(browserName,'high','Tour failed to render','Expected .career-tour');else{
     await snap(page,browserName,'05-tour');await checkOverflow(page,browserName,'Tour');const play=page.locator('button[aria-label^="Play "]:not([disabled])').first();if(await vis(play)){await play.click();await page.waitForTimeout(6500);if(!(await vis(page.locator('.game'),3000)))add(browserName,'high','Tour song failed to enter gameplay','Game did not render after preroll');else{
      await snap(page,browserName,'06-game-running');const bg=await context.newPage();await bg.setContent('<p>background</p>');await bg.bringToFront();await page.waitForTimeout(800);await page.bringToFront();await context.setOffline(true);await page.waitForTimeout(1000);await context.setOffline(false);await page.waitForTimeout(1000);if(!(await vis(page.locator('.game,.results'),2200)))add(browserName,'high','Gameplay lost state after background/network interruption','No game/results after resume');await snap(page,browserName,'07-game-resumed');await bg.close()}}
     else add(browserName,'medium','No enabled Tour song found','Could not execute gameplay interruption test')}}}
   for(const e of pageErrors)add(browserName,'critical','Tour/game page exception',e);await context.close();
  }

  // Offline shell after one online load and service-worker registration.
  {
   const{context,page,pageErrors}=await fresh(browser,engine);await page.waitForTimeout(1800);await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded',timeout:15000}).catch(()=>{});await page.waitForTimeout(700);const text=(await page.locator('#root').innerText().catch(()=>'' )).trim();if(!text)add(browserName,'high','Offline reload produced blank shell','No rendered app text while offline');await snap(page,browserName,'08-offline');await context.setOffline(false);for(const e of pageErrors.filter(e=>!e.includes('fetch')))add(browserName,'critical','Offline page exception',e);await context.close();
  }
 }finally{await browser.close()}
}

await runEngine('webkit-iphone14',webkit);await runEngine('chromium-iphone14',chromium);
const order={critical:4,high:3,medium:2,low:1};issues.sort((a,b)=>order[b.severity]-order[a.severity]);
const report={target,generatedAt:new Date().toISOString(),issues,notes};await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
const md=['# RhythmTap deterministic destructive mobile QA','',`Target: ${target}`,`Issues: ${issues.length}`,'',...issues.map((i,n)=>`${n+1}. **${i.severity.toUpperCase()} — ${i.title}** (${i.browser})\n   ${i.detail}`),...(notes.length?['','## Notes',...notes.map(n=>`- ${n}`)]:[])].join('\n');await fs.writeFile(path.join(out,'report.md'),md);console.log(md);if(issues.some(i=>i.severity==='critical'||i.severity==='high'))process.exitCode=1;
