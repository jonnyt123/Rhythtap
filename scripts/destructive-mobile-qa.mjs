import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit,devices} from 'playwright';

const target=process.env.RHYTHTAP_QA_URL||'http://127.0.0.1:4173/Rhythtap/';
const out=path.resolve(process.env.RHYTHTAP_QA_OUT||'qa-artifacts');
await fs.mkdir(out,{recursive:true});

const issues=[];
const notes=[];
const safeName=value=>value.replace(/[^a-z0-9_-]+/gi,'-').toLowerCase();
const addIssue=(browser,severity,title,detail)=>issues.push({browser,severity,title,detail});
async function visible(locator,timeout=1500){try{await locator.waitFor({state:'visible',timeout});return true}catch{return false}}
async function shot(page,browser,name){await page.screenshot({path:path.join(out,`${safeName(browser)}-${name}.png`),fullPage:true});}
async function overflow(page){return await page.evaluate(()=>({w:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.documentElement.scrollHeight,ch:document.documentElement.clientHeight}));}
async function assertNoHorizontalOverflow(page,browser,label){const size=await overflow(page);if(size.w>size.cw+3)addIssue(browser,'medium',`${label}: horizontal overflow`,`${size.w}px content in ${size.cw}px viewport`);}
async function back(page){const button=page.locator('button[aria-label="Back"],button[aria-label="Back to track select"],button[aria-label="Exit tutorial"]').first();if(await visible(button,800)){await button.click({force:true});await page.waitForTimeout(450);return true}return false;}
async function ensureHome(page){
 if(await visible(page.locator('.metal-home,.home'),600))return true;
 if(await visible(page.locator('.tutorial-screen'),600)){
  const exit=page.locator('button[aria-label="Exit tutorial"]');
  if(await visible(exit,600)){await exit.click({force:true});if(await visible(page.locator('.metal-home,.home'),5000))return true;}
 }
 for(let i=0;i<4;i++){if(!(await back(page)))break;if(await visible(page.locator('.metal-home,.home'),1500))return true}
 return visible(page.locator('.metal-home,.home'),500);
}
async function screenText(page){return (await page.locator('#root').innerText().catch(()=>'' )).trim()}

const menuExpectations={
 'SOLO PLAY':'.select',
 'MY CHARTS':'.imported-library',
 'ACHIEVEMENTS':'.achievementsPage',
 'PROFILE':'.account-screen',
 'ONLINE BATTLE':'.multiplayer',
};

async function runBrowser(name,engine){
 const browser=await engine.launch({headless:true});
 const profile=devices['iPhone 14'];
 const context=await browser.newContext({...profile,locale:'en-CA',timezoneId:'America/Toronto'});
 const page=await context.newPage();
 const consoleErrors=[];const pageErrors=[];const failedRequests=[];
 page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});
 page.on('pageerror',error=>pageErrors.push(String(error)));
 page.on('requestfailed',request=>{const url=request.url();if(!url.includes('supabase.co'))failedRequests.push(`${request.method()} ${url} :: ${request.failure()?.errorText||'failed'}`)});
 try{
  await page.goto(target,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(1000);
  await shot(page,name,'00-boot');
  if(!(await visible(page.locator('#root'))))addIssue(name,'critical','App did not mount','#root was not visible after navigation');
  await assertNoHorizontalOverflow(page,name,'Boot');

  if(await visible(page.locator('.tutorial-screen'),600))await shot(page,name,'01-first-launch-tutorial');
  if(!(await ensureHome(page)))addIssue(name,'critical','Home screen not reachable','Could not leave first-launch/navigation state and reach the home screen.');
  else{
   await shot(page,name,'02-home');
   await assertNoHorizontalOverflow(page,name,'Home');
   const scroll=page.locator('.metal-home-content,.home-content').first();
   if(await visible(scroll)){await scroll.evaluate(el=>{el.scrollTop=el.scrollHeight});await page.waitForTimeout(100);await scroll.evaluate(el=>{el.scrollTop=0})}
   await page.setViewportSize({width:844,height:390});await page.waitForTimeout(450);await shot(page,name,'03-landscape');await assertNoHorizontalOverflow(page,name,'Landscape home');
   await page.setViewportSize({width:390,height:844});await page.waitForTimeout(450);
  }

  if(await ensureHome(page)){
   const settingsButton=page.locator('button[aria-label="Settings"]').first();
   if(await visible(settingsButton)){
    await settingsButton.click({force:true});
    if(!(await visible(page.locator('.settingsPage'),3000)))addIssue(name,'high','Settings failed to open','Home Settings button did not reach the settings screen.');
    else{
     await shot(page,name,'04-settings');await assertNoHorizontalOverflow(page,name,'Settings');
     const ranges=page.locator('.settingsPage input[type="range"]');
     if(await ranges.count()){
      const speed=ranges.first();
      await speed.evaluate(el=>{el.value='1.5';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))});
      await page.waitForTimeout(200);
      const stored=await page.evaluate(()=>localStorage.getItem('ntr-speed'));
      if(stored!=='1.5')addIssue(name,'medium','Note speed did not persist immediately',`localStorage ntr-speed=${stored}`);
      await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(700);
      const reloaded=page.locator('.settingsPage input[type="range"]').first();
      if(await visible(reloaded,2500)){const value=await reloaded.inputValue();if(value!=='1.5')addIssue(name,'medium','Note speed reset after reload',`Expected 1.5, got ${value}`)}
      else addIssue(name,'medium','Settings route was not stable across reload','Settings screen disappeared after reload.');
     }
     await back(page);await ensureHome(page);
     for(let i=0;i<4;i++){
      const button=page.locator('button[aria-label="Settings"]').first();
      if(!(await visible(button,1200))){addIssue(name,'medium','Settings rapid-cycle lost home state',`Cycle ${i+1}: Settings button unavailable.`);break}
      await button.click({force:true});
      if(!(await visible(page.locator('.settingsPage'),1800))){addIssue(name,'high','Settings rapid-cycle navigation failed',`Cycle ${i+1}: settings screen did not render.`);break}
      await back(page);
      if(!(await visible(page.locator('.metal-home,.home'),1800))){addIssue(name,'high','Settings rapid-cycle could not return home',`Cycle ${i+1}: home did not render.`);break}
     }
    }
   } else addIssue(name,'medium','Settings entry not found','Home rendered, but the Settings icon was unavailable.');
  }

  if(await ensureHome(page)){
   const tour=page.locator('.tour-main-cta');
   if(await visible(tour)){
    await tour.click();
    if(await visible(page.locator('.career-tour'),3500)){
     await shot(page,name,'05-tour');await assertNoHorizontalOverflow(page,name,'Tour');
     await page.locator('.career-tour').evaluate(el=>{el.scrollTop=el.scrollHeight}).catch(()=>{});await page.waitForTimeout(150);await page.locator('.career-tour').evaluate(el=>{el.scrollTop=0}).catch(()=>{});
     const play=page.locator('button[aria-label^="Play "]:not([disabled])').first();
     if(await visible(play)){
      await play.click();await page.waitForTimeout(6500);
      if(await visible(page.locator('.game'),2500)){
       await shot(page,name,'06-game-running');await assertNoHorizontalOverflow(page,name,'Gameplay');
       const gameButtons=page.locator('.game button');const count=await gameButtons.count();
       for(let n=0;n<24;n++){const i=n%Math.max(1,count);await gameButtons.nth(i).click({force:true,position:{x:8,y:8},timeout:300}).catch(()=>{})}
       const bg=await context.newPage();await bg.setContent('<title>background</title>');await bg.bringToFront();await page.waitForTimeout(900);await page.bringToFront();await page.waitForTimeout(500);
       await context.setOffline(true);await page.waitForTimeout(1200);await context.setOffline(false);await page.waitForTimeout(1200);
       if(!(await visible(page.locator('.game,.results'),1800)))addIssue(name,'high','Gameplay lost state after background/network interruption','Neither game nor results screen remained mounted.');
       await shot(page,name,'07-after-interruption');await bg.close();
      } else addIssue(name,'high','Tour play did not enter gameplay','Tapped an enabled Tour play button but gameplay was not visible after pre-roll.');
     } else addIssue(name,'medium','No enabled Tour song found','Could not exercise live gameplay from Tour.');
    } else addIssue(name,'medium','Tour screen did not open','Tour CTA did not reach .career-tour.');
   } else notes.push(`${name}: Tour CTA not present; skipped Tour gameplay path.`);
  }

  for(const [label,selector] of Object.entries(menuExpectations)){
   if(!(await ensureHome(page))){addIssue(name,'high',`${label}: could not restore home`,'Navigation recovery failed before menu test.');break}
   const item=page.locator('button').filter({hasText:label}).first();
   if(!(await visible(item,1200))){notes.push(`${name}: ${label} not reachable for anonymous mobile QA.`);continue}
   await item.click({force:true});
   const rendered=await visible(page.locator(selector),3500);
   await page.waitForTimeout(700);
   await shot(page,name,`menu-${safeName(label)}`);
   await assertNoHorizontalOverflow(page,name,label);
   const text=await screenText(page);
   if(!rendered||!text)addIssue(name,'high',`${label} rendered blank or wrong screen`,`Expected ${selector}; rendered=${rendered}; root text length=${text.length}`);
   await back(page);
  }

  await page.goto(target,{waitUntil:'networkidle',timeout:45000}).catch(()=>{});await page.waitForTimeout(1200);
  await context.setOffline(true);
  const offlineResponse=await page.reload({waitUntil:'domcontentloaded',timeout:15000}).catch(()=>null);await page.waitForTimeout(700);
  const offlineText=await screenText(page);
  if(!(await visible(page.locator('#root')))||!offlineText)addIssue(name,'high','Offline reload produced a blank shell',`Reload response: ${offlineResponse?.status?.()??'none'}`);
  await shot(page,name,'08-offline-reload').catch(()=>{});await context.setOffline(false);

  if(pageErrors.length)for(const error of pageErrors)addIssue(name,'critical','Unhandled page exception',error);
  const seriousConsole=consoleErrors.filter(text=>!/Failed to load resource|supabase|ERR_INTERNET_DISCONNECTED|net::ERR/i.test(text));
  for(const error of seriousConsole.slice(0,8))addIssue(name,'high','Console error',error);
  if(failedRequests.length>8)notes.push(`${name}: ${failedRequests.length} non-Supabase requests failed during intentional offline testing.`);
 }catch(error){addIssue(name,'critical','QA harness aborted',error instanceof Error?error.stack||error.message:String(error));await shot(page,name,'fatal').catch(()=>{})}
 finally{await browser.close()}
}

await runBrowser('webkit-iphone14',webkit);
await runBrowser('chromium-iphone14',chromium);
const rank={critical:4,high:3,medium:2,low:1};issues.sort((a,b)=>rank[b.severity]-rank[a.severity]);
const report={target,generatedAt:new Date().toISOString(),issues,notes};await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
const markdown=[`# RhythmTap destructive mobile QA`,``,`Target: ${target}`,``,`Issues: ${issues.length}`,``,...issues.map((i,n)=>`${n+1}. **${i.severity.toUpperCase()} — ${i.title}** (${i.browser})\n   ${i.detail}`),...(notes.length?['','## Notes',...notes.map(n=>`- ${n}`)]:[])].join('\n');
await fs.writeFile(path.join(out,'report.md'),markdown);console.log(markdown);
if(issues.some(issue=>issue.severity==='critical'||issue.severity==='high'))process.exitCode=1;
