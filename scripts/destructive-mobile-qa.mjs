import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit,devices} from 'playwright';

const target=process.env.RHYTHTAP_QA_URL||'http://127.0.0.1:4173/Rhythtap/';
const out=path.resolve(process.env.RHYTHTAP_QA_OUT||'qa-artifacts');
const TUTORIAL_KEY='rhythtap-tutorial-complete-v1';
await fs.mkdir(out,{recursive:true});

const issues=[];
const notes=[];
const safeName=value=>value.replace(/[^a-z0-9_-]+/gi,'-').toLowerCase();
const addIssue=(browser,severity,title,detail)=>issues.push({browser,severity,title,detail});
async function visible(locator,timeout=1800){try{await locator.waitFor({state:'visible',timeout});return true}catch{return false}}
async function shot(page,browser,name){await page.screenshot({path:path.join(out,`${safeName(browser)}-${name}.png`),fullPage:true});}
async function overflow(page){return await page.evaluate(()=>({w:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.documentElement.scrollHeight,ch:document.documentElement.clientHeight}));}
async function assertNoHorizontalOverflow(page,browser,label){const size=await overflow(page);if(size.w>size.cw+3)addIssue(browser,'medium',`${label}: horizontal overflow`,`${size.w}px content in ${size.cw}px viewport`);}
async function back(page){const button=page.locator('button[aria-label="Back"],button[aria-label="Back to track select"],button[aria-label="Exit tutorial"]').filter({visible:true}).first();if(await visible(button,900)){await button.click();await page.waitForTimeout(350);return true}return false;}
async function isHome(page){return visible(page.locator('section.home.screen,section.metal-home.screen').filter({visible:true}).first(),900)}
async function ensureHome(page){
 if(await isHome(page))return true;
 for(let i=0;i<5;i++){if(!(await back(page)))break;if(await isHome(page))return true}
 await page.evaluate(key=>localStorage.setItem(key,'1'),TUTORIAL_KEY).catch(()=>{});
 await page.goto(target,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{});
 await page.waitForTimeout(650);
 return isHome(page);
}
async function screenText(page){return (await page.locator('#root').innerText().catch(()=>'' )).trim()}
async function activeScreen(page){return page.locator('section.screen').filter({visible:true}).first()}
async function checkMountedScreen(page,browser,label,expectedSelector){
 const expected=page.locator(expectedSelector).filter({visible:true}).first();
 const rendered=await visible(expected,3500);
 const text=await screenText(page);
 const screen=activeScreen(page);
 const screenCount=await page.locator('section.screen').filter({visible:true}).count().catch(()=>0);
 if(!rendered||!text||screenCount!==1){
  const cls=screenCount?await screen.getAttribute('class').catch(()=>null):null;
  addIssue(browser,'high',`${label} rendered blank or wrong screen`,`Expected ${expectedSelector}; rendered=${rendered}; visibleScreens=${screenCount}; activeClass=${cls}; rootText=${text.length}`);
  return false;
 }
 return true;
}

const menuExpectations={
 'SOLO PLAY':'section.select.screen',
 'MY CHARTS':'section.imported-library.screen',
 'ACHIEVEMENTS':'section.achievementsPage.screen',
 'PROFILE':'section.account-screen.screen',
 'ONLINE BATTLE':'section.multiplayer',
};

async function verifyFirstLaunch(name,engine){
 const browser=await engine.launch({headless:true});
 const context=await browser.newContext({...devices['iPhone 14'],locale:'en-CA',timezoneId:'America/Toronto'});
 const page=await context.newPage();
 try{
  await page.goto(target,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(600);
  const tutorial=page.locator('section.tutorial-screen.screen').filter({visible:true}).first();
  if(!(await visible(tutorial,2500)))addIssue(name,'high','First-launch tutorial missing','A clean browser profile did not open RhythmTap Training.');
  else{
   await shot(page,name,'00-first-launch-tutorial');
   const exit=page.locator('button[aria-label="Exit tutorial"]').filter({visible:true}).first();
   if(!(await visible(exit,1000)))addIssue(name,'high','Tutorial exit control missing','Training opened without a visible exit control.');
   else{
    await exit.click();
    if(!(await isHome(page)))addIssue(name,'high','Tutorial exit did not reach home','Exit tutorial did not transition to the main menu.');
    const stored=await page.evaluate(key=>localStorage.getItem(key),TUTORIAL_KEY);
    if(stored!=='1')addIssue(name,'medium','Tutorial completion was not persisted',`Expected ${TUTORIAL_KEY}=1, got ${stored}`);
   }
  }
 }catch(error){addIssue(name,'critical','Onboarding QA aborted',error instanceof Error?error.stack||error.message:String(error));}
 finally{await browser.close()}
}

async function runBrowser(name,engine){
 const browser=await engine.launch({headless:true});
 const profile=devices['iPhone 14'];
 const context=await browser.newContext({...profile,locale:'en-CA',timezoneId:'America/Toronto'});
 await context.addInitScript(key=>localStorage.setItem(key,'1'),TUTORIAL_KEY);
 const page=await context.newPage();
 const consoleErrors=[];const pageErrors=[];const failedRequests=[];
 page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});
 page.on('pageerror',error=>pageErrors.push(String(error)));
 page.on('requestfailed',request=>{const url=request.url();if(!url.includes('supabase.co'))failedRequests.push(`${request.method()} ${url} :: ${request.failure()?.errorText||'failed'}`)});
 try{
  await page.goto(target,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(900);
  await shot(page,name,'01-boot-home');
  if(!(await visible(page.locator('#root'))))addIssue(name,'critical','App did not mount','#root was not visible after navigation');
  if(!(await isHome(page)))addIssue(name,'critical','Home screen not reachable','Destructive QA booted with onboarding completed but the home screen was not visible.');
  await assertNoHorizontalOverflow(page,name,'Boot');

  if(await isHome(page)){
   await assertNoHorizontalOverflow(page,name,'Home');
   const scroll=page.locator('.metal-home-content,.home-content').filter({visible:true}).first();
   if(await visible(scroll)){await scroll.evaluate(el=>{el.scrollTop=el.scrollHeight});await page.waitForTimeout(100);await scroll.evaluate(el=>{el.scrollTop=0})}
   await page.setViewportSize({width:844,height:390});await page.waitForTimeout(350);await shot(page,name,'02-landscape');await assertNoHorizontalOverflow(page,name,'Landscape home');
   await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);
  }

  if(await ensureHome(page)){
   const settingsButton=page.locator('button[aria-label="Settings"]').filter({visible:true}).first();
   if(await visible(settingsButton)){
    await settingsButton.click();
    if(!(await checkMountedScreen(page,name,'Settings','section.settingsPage.screen'))){
     addIssue(name,'high','Settings failed to open','Home Settings button did not reach the settings screen.');
    }else{
     await shot(page,name,'03-settings');await assertNoHorizontalOverflow(page,name,'Settings');
     const ranges=page.locator('section.settingsPage.screen input[type="range"]');
     if(await ranges.count()){
      const speed=ranges.first();
      await speed.evaluate(el=>{el.value='1.5';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))});
      await page.waitForTimeout(200);
      const stored=await page.evaluate(()=>localStorage.getItem('ntr-speed'));
      if(stored!=='1.5')addIssue(name,'medium','Note speed did not persist immediately',`localStorage ntr-speed=${stored}`);
      await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(700);
      const persisted=await page.evaluate(()=>localStorage.getItem('ntr-speed'));
      if(persisted!=='1.5')addIssue(name,'medium','Note speed storage changed after reload',`Expected 1.5, got ${persisted}`);
      await ensureHome(page);
      const reopen=page.locator('button[aria-label="Settings"]').filter({visible:true}).first();
      if(await visible(reopen)){await reopen.click();const reloaded=page.locator('section.settingsPage.screen input[type="range"]').first();if(await visible(reloaded,2500)){const value=await reloaded.inputValue();if(value!=='1.5')addIssue(name,'medium','Note speed reset after reload',`Expected 1.5, got ${value}`)}}
     }
     await back(page);await ensureHome(page);
     for(let i=0;i<4;i++){
      const button=page.locator('button[aria-label="Settings"]').filter({visible:true}).first();
      if(!(await visible(button,1200))){addIssue(name,'medium','Settings rapid-cycle lost home state',`Cycle ${i+1}: Settings button unavailable.`);break}
      await button.click();
      if(!(await visible(page.locator('section.settingsPage.screen').filter({visible:true}).first(),1800))){addIssue(name,'high','Settings rapid-cycle navigation failed',`Cycle ${i+1}: settings screen did not render.`);break}
      await back(page);
      if(!(await isHome(page))){addIssue(name,'high','Settings rapid-cycle could not return home',`Cycle ${i+1}: home did not render.`);break}
     }
    }
   } else addIssue(name,'high','Settings entry not found','Home rendered, but the Settings icon was unavailable.');
  }

  if(await ensureHome(page)){
   const tour=page.locator('.tour-main-cta').filter({visible:true}).first();
   if(await visible(tour)){
    await tour.click();
    if(await visible(page.locator('section.career-tour.screen').filter({visible:true}).first(),3500)){
     await shot(page,name,'04-tour');await assertNoHorizontalOverflow(page,name,'Tour');
     await page.locator('section.career-tour.screen').evaluate(el=>{el.scrollTop=el.scrollHeight}).catch(()=>{});await page.waitForTimeout(150);await page.locator('section.career-tour.screen').evaluate(el=>{el.scrollTop=0}).catch(()=>{});
     const play=page.locator('button[aria-label^="Play "]:not([disabled])').filter({visible:true}).first();
     if(await visible(play)){
      await play.click();await page.waitForTimeout(6500);
      if(await visible(page.locator('section.game.screen').filter({visible:true}).first(),2500)){
       await shot(page,name,'05-game-running');await assertNoHorizontalOverflow(page,name,'Gameplay');
       const pads=page.locator('.pads button,.hit-pads button,.game .lane-pad').filter({visible:true});
       const count=await pads.count();
       if(count){for(let n=0;n<24;n++)await pads.nth(n%count).click({force:true,position:{x:8,y:8},timeout:300}).catch(()=>{})}
       const bg=await context.newPage();await bg.setContent('<title>background</title>');await bg.bringToFront();await page.waitForTimeout(900);await page.bringToFront();await page.waitForTimeout(500);
       await context.setOffline(true);await page.waitForTimeout(1200);await context.setOffline(false);await page.waitForTimeout(1200);
       if(!(await visible(page.locator('section.game.screen,section.results.screen').filter({visible:true}).first(),1800)))addIssue(name,'high','Gameplay lost state after background/network interruption','Neither game nor results screen remained mounted.');
       await shot(page,name,'06-after-interruption');await bg.close();
      } else addIssue(name,'high','Tour play did not enter gameplay','Tapped an enabled Tour play button but gameplay was not visible after pre-roll.');
     } else notes.push(`${name}: no enabled Tour play button was available in this profile.`);
    } else addIssue(name,'medium','Tour screen did not open','Tour CTA did not reach the Career/Tour screen.');
   } else notes.push(`${name}: Tour CTA not present; skipped Tour gameplay path.`);
  }

  for(const [label,selector] of Object.entries(menuExpectations)){
   if(!(await ensureHome(page))){addIssue(name,'high',`${label}: could not restore home`,'Navigation recovery failed before menu test.');break}
   const item=page.locator('button').filter({hasText:label,visible:true}).first();
   if(!(await visible(item,1200))){notes.push(`${name}: ${label} not reachable for anonymous mobile QA.`);continue}
   await item.click();
   await page.waitForTimeout(500);
   await checkMountedScreen(page,name,label,selector);
   await shot(page,name,`menu-${safeName(label)}`);
   await assertNoHorizontalOverflow(page,name,label);
   await back(page);
  }

  if(await ensureHome(page)){
   await page.reload({waitUntil:'networkidle',timeout:45000}).catch(()=>{});await page.waitForTimeout(900);
   await context.setOffline(true);
   const offlineResponse=await page.reload({waitUntil:'domcontentloaded',timeout:15000}).catch(()=>null);await page.waitForTimeout(700);
   const offlineText=await screenText(page);
   if(!(await visible(page.locator('#root')))||!offlineText)addIssue(name,'high','Offline reload produced a blank shell',`Reload response: ${offlineResponse?.status?.()??'none'}`);
   await shot(page,name,'07-offline-reload').catch(()=>{});await context.setOffline(false);
  }

  if(pageErrors.length)for(const error of pageErrors)addIssue(name,'critical','Unhandled page exception',error);
  const seriousConsole=consoleErrors.filter(text=>!/Failed to load resource|supabase|ERR_INTERNET_DISCONNECTED|net::ERR/i.test(text));
  for(const error of seriousConsole.slice(0,8))addIssue(name,'high','Console error',error);
  if(failedRequests.length>8)notes.push(`${name}: ${failedRequests.length} non-Supabase requests failed during intentional offline testing.`);
 }catch(error){addIssue(name,'critical','QA harness aborted',error instanceof Error?error.stack||error.message:String(error));await shot(page,name,'fatal').catch(()=>{})}
 finally{await browser.close()}
}

await verifyFirstLaunch('webkit-onboarding',webkit);
await verifyFirstLaunch('chromium-onboarding',chromium);
await runBrowser('webkit-iphone14',webkit);
await runBrowser('chromium-iphone14',chromium);
const rank={critical:4,high:3,medium:2,low:1};issues.sort((a,b)=>rank[b.severity]-rank[a.severity]);
const report={target,generatedAt:new Date().toISOString(),issues,notes};await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
const markdown=[`# RhythmTap destructive mobile QA`,``,`Target: ${target}`,``,`Issues: ${issues.length}`,``,...issues.map((i,n)=>`${n+1}. **${i.severity.toUpperCase()} — ${i.title}** (${i.browser})\n   ${i.detail}`),...(notes.length?['','## Notes',...notes.map(n=>`- ${n}`)]:[])].join('\n');
await fs.writeFile(path.join(out,'report.md'),markdown);console.log(markdown);
if(issues.some(issue=>issue.severity==='critical'||issue.severity==='high'))process.exitCode=1;
