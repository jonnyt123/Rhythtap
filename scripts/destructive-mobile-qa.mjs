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

async function visible(locator){try{return await locator.isVisible({timeout:1500})}catch{return false}}
async function shot(page,browser,name){await page.screenshot({path:path.join(out,`${safeName(browser)}-${name}.png`),fullPage:true});}
async function overflow(page){return await page.evaluate(()=>({w:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.documentElement.scrollHeight,ch:document.documentElement.clientHeight}));}
async function assertNoHorizontalOverflow(page,browser,label){const size=await overflow(page);if(size.w>size.cw+3)addIssue(browser,'medium',`${label}: horizontal overflow`,`${size.w}px content in ${size.cw}px viewport`);}
async function back(page){const button=page.locator('button[aria-label="Back"],button[aria-label="Back to track select"],button[aria-label="Exit tutorial"]').first();if(await visible(button)){await button.click();await page.waitForTimeout(250);return true}return false;}
async function clickText(page,text){const target=page.getByText(text,{exact:true}).first();if(await visible(target)){await target.click();await page.waitForTimeout(250);return true}return false;}

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

  const tutorial=page.getByText('RHYTHTAP TRAINING',{exact:true});
  if(await visible(tutorial)){
   await shot(page,name,'01-first-launch-tutorial');
   const exit=page.locator('button[aria-label="Exit tutorial"]');
   if(await visible(exit)){await exit.click();await page.waitForTimeout(400)}
  }

  if(!(await visible(page.locator('.metal-home,.home')))){
   addIssue(name,'high','Home screen not reachable','After first-launch handling the expected home screen was not visible.');
  }else{
   await shot(page,name,'02-home');
   await assertNoHorizontalOverflow(page,name,'Home');
   const scroll=page.locator('.metal-home-content,.home-content').first();
   if(await visible(scroll)){
    await scroll.evaluate(el=>{el.scrollTop=el.scrollHeight});await page.waitForTimeout(100);
    await scroll.evaluate(el=>{el.scrollTop=0});
   }
   await page.setViewportSize({width:844,height:390});await page.waitForTimeout(250);await shot(page,name,'03-landscape');
   await assertNoHorizontalOverflow(page,name,'Landscape home');
   await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
  }

  // Settings abuse + persistence.
  const settingsButton=page.locator('button[aria-label="Settings"],button').filter({hasText:'SETTINGS'}).first();
  if(await visible(settingsButton)){
   for(let i=0;i<4;i++){await settingsButton.click({force:true}).catch(()=>{});await page.waitForTimeout(40)}
   await page.waitForTimeout(300);
   if(!(await visible(page.locator('.settingsPage'))))addIssue(name,'high','Rapid Settings taps broke navigation','Expected settings screen after repeated taps.');
   else{
    await shot(page,name,'04-settings');
    await assertNoHorizontalOverflow(page,name,'Settings');
    const ranges=page.locator('.settingsPage input[type="range"]');
    if(await ranges.count()){
     const speed=ranges.first();
     await speed.evaluate(el=>{el.value='1.5';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))});
     await page.waitForTimeout(150);
     const stored=await page.evaluate(()=>localStorage.getItem('ntr-speed'));
     if(stored!=='1.5')addIssue(name,'medium','Note speed did not persist immediately',`localStorage ntr-speed=${stored}`);
     await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(500);
     const reloaded=page.locator('.settingsPage input[type="range"]').first();
     if(await visible(reloaded)){
      const value=await reloaded.inputValue();
      if(value!=='1.5')addIssue(name,'medium','Note speed reset after reload',`Expected 1.5, got ${value}`);
     }
    }
    await back(page);
   }
  } else addIssue(name,'medium','Settings entry not found','Could not exercise settings persistence or rapid tap handling.');

  // Tour scrolling and gameplay entry.
  if(await visible(page.locator('.metal-home,.home'))){
   const tour=page.locator('.tour-main-cta');
   if(await visible(tour)){
    await tour.click();await page.waitForTimeout(500);
    if(await visible(page.locator('.career-tour'))){
     await shot(page,name,'05-tour');await assertNoHorizontalOverflow(page,name,'Tour');
     await page.locator('.career-tour').evaluate(el=>{el.scrollTop=el.scrollHeight}).catch(()=>{});await page.waitForTimeout(150);
     await page.locator('.career-tour').evaluate(el=>{el.scrollTop=0}).catch(()=>{});
     const play=page.locator('button[aria-label^="Play "]:not([disabled])').first();
     if(await visible(play)){
      await play.click();await page.waitForTimeout(6500);
      if(await visible(page.locator('.game'))){
       await shot(page,name,'06-game-running');await assertNoHorizontalOverflow(page,name,'Gameplay');
       const pads=page.locator('.game button').filter({has:page.locator('span')});
       const count=await pads.count();
       for(let i=0;i<Math.min(count,3);i++)for(let n=0;n<8;n++)await pads.nth(i).click({force:true,position:{x:10,y:10}}).catch(()=>{});
       const bg=await context.newPage();await bg.setContent('<title>background</title>');await bg.bringToFront();await page.waitForTimeout(900);await page.bringToFront();await page.waitForTimeout(400);
       await context.setOffline(true);await page.waitForTimeout(1200);await context.setOffline(false);await page.waitForTimeout(1000);
       if(!(await visible(page.locator('.game,.results'))))addIssue(name,'high','Gameplay lost state after background/network interruption','Neither game nor results screen remained mounted.');
       await shot(page,name,'07-after-interruption');
       await bg.close();
       const quit=page.locator('.game button').filter({hasText:/QUIT|LEAVE|BACK/i}).first();
       if(await visible(quit))await quit.click({force:true}).catch(()=>{});
      } else addIssue(name,'high','Tour play did not enter gameplay','Tapped an enabled Tour play button but game screen was not visible after pre-roll.');
     } else addIssue(name,'medium','No enabled Tour song found','Could not exercise live gameplay from Tour.');
    } else addIssue(name,'medium','Tour screen did not open','Tour CTA did not reach .career-tour.');
   } else notes.push(`${name}: Tour CTA not present in this build; skipped Tour gameplay path.`);
  }

  // Home menu pages: rapidly open/back and assert no crash or horizontal overflow.
  if(!(await visible(page.locator('.metal-home,.home')))){
   for(let i=0;i<4;i++){if(await back(page)){}else break}
  }
  const menuTargets=['SOLO PLAY','MY CHARTS','ACHIEVEMENTS','PROFILE','ONLINE BATTLE'];
  for(const label of menuTargets){
   if(!(await visible(page.locator('.metal-home,.home')))){for(let i=0;i<3;i++){if(!(await back(page)))break}}
   const item=page.locator('button').filter({hasText:label}).first();
   if(!(await visible(item))){notes.push(`${name}: ${label} not reachable for anonymous mobile QA.`);continue}
   await item.click();await page.waitForTimeout(350);await assertNoHorizontalOverflow(page,name,label);
   await shot(page,name,`menu-${safeName(label)}`);
   if(!(await visible(page.locator('#root'))))addIssue(name,'critical',`${label} unmounted app`,'#root disappeared after navigation.');
   await back(page);
  }

  // Service worker/offline reload after an online visit.
  await page.goto(target,{waitUntil:'networkidle',timeout:45000}).catch(()=>{});await page.waitForTimeout(1200);
  await context.setOffline(true);
  const offlineResponse=await page.reload({waitUntil:'domcontentloaded',timeout:15000}).catch(()=>null);
  await page.waitForTimeout(500);
  if(!(await visible(page.locator('#root')))||!(await page.locator('#root').innerText().catch(()=>'')))addIssue(name,'high','Offline reload produced a blank shell',`Reload response: ${offlineResponse?.status?.()??'none'}`);
  await shot(page,name,'08-offline-reload').catch(()=>{});
  await context.setOffline(false);

  if(pageErrors.length)for(const error of pageErrors)addIssue(name,'critical','Unhandled page exception',error);
  const seriousConsole=consoleErrors.filter(text=>!/Failed to load resource|supabase|ERR_INTERNET_DISCONNECTED|net::ERR/i.test(text));
  for(const error of seriousConsole.slice(0,8))addIssue(name,'high','Console error',error);
  if(failedRequests.length>8)notes.push(`${name}: ${failedRequests.length} non-Supabase requests failed during intentional offline testing.`);
 }catch(error){
  addIssue(name,'critical','QA harness aborted',error instanceof Error?error.stack||error.message:String(error));
  await shot(page,name,'fatal').catch(()=>{});
 }finally{
  await context.tracing?.stop?.().catch(()=>{});
  await browser.close();
 }
}

await runBrowser('webkit-iphone14',webkit);
await runBrowser('chromium-iphone14',chromium);

const rank={critical:4,high:3,medium:2,low:1};
issues.sort((a,b)=>rank[b.severity]-rank[a.severity]);
const report={target,generatedAt:new Date().toISOString(),issues,notes};
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
const markdown=[`# RhythmTap destructive mobile QA`,``,`Target: ${target}`,``,`Issues: ${issues.length}`,``,...issues.map((i,n)=>`${n+1}. **${i.severity.toUpperCase()} — ${i.title}** (${i.browser})\n   ${i.detail}`),...(notes.length?['','## Notes',...notes.map(n=>`- ${n}`)]:[])].join('\n');
await fs.writeFile(path.join(out,'report.md'),markdown);
console.log(markdown);
if(issues.some(issue=>issue.severity==='critical'||issue.severity==='high'))process.exitCode=1;
