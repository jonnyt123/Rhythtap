import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit,devices} from 'playwright';

const target=process.env.RHYTHTAP_QA_URL||'http://127.0.0.1:4173/Rhythtap/';
const out=path.resolve(process.env.RHYTHTAP_QA_OUT||'qa-artifacts');
const MIN_PAINTED_PNG_BYTES=30000;
const issues=[];
await fs.mkdir(out,{recursive:true});

const slug=value=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const add=(browser,severity,title,detail)=>issues.push({browser,severity,title,detail});
const visible=async(locator,timeout=4000)=>{try{await locator.waitFor({state:'visible',timeout});return true}catch{return false}};
const settlePaint=async page=>{
 await page.waitForTimeout(450);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))).catch(()=>{});
 await page.waitForTimeout(120);
};

async function capturePaint(page,browser,label){
 await settlePaint(page);
 const filename=`visual-${slug(browser)}-${slug(label)}.png`;
 const filepath=path.join(out,filename);
 const first=await page.screenshot({path:filepath,fullPage:false});
 if(first.byteLength>=MIN_PAINTED_PNG_BYTES)return;

 // A second natural paint attempt distinguishes a transient screenshot race from a persistent blank frame.
 await page.waitForTimeout(900);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))).catch(()=>{});
 const retryName=`visual-${slug(browser)}-${slug(label)}-retry.png`;
 const retry=await page.screenshot({path:path.join(out,retryName),fullPage:false});
 const rootText=(await page.locator('#root').innerText().catch(()=>'' )).trim();
 const screen=page.locator('section.screen').filter({visible:true}).first();
 const cls=await screen.getAttribute('class').catch(()=>null);
 if(retry.byteLength<MIN_PAINTED_PNG_BYTES){
  add(browser,'high',`${label}: persistent near-blank visual frame`,`PNG stayed unusually small after two settled paints (${first.byteLength} B, ${retry.byteLength} B) while rootText=${rootText.length}, activeClass=${cls}`);
 }else{
  add(browser,'medium',`${label}: delayed visual paint`,`First settled screenshot was near-blank (${first.byteLength} B) but recovered without navigation (${retry.byteLength} B).`);
 }
}

async function newContext(browser,landscape=false,viewport=null){
 const portrait=devices['iPhone 14'];
 const landscapeProfile=devices['iPhone 14 landscape'];
 const profile=landscape&&landscapeProfile?landscapeProfile:portrait;
 const size=viewport?{viewport,screen:viewport}:{};
 return browser.newContext({...profile,...size,locale:'en-CA',timezoneId:'America/Toronto'});
}

async function prepareHome(page,{xp=null}={}){
 await page.goto(target,{waitUntil:'domcontentloaded',timeout:45000});
 // Production first-launch state is selected during app boot. Seed storage from the
 // loaded origin and perform a real reload rather than relying on addInitScript timing.
 await page.evaluate(({xp})=>{
  localStorage.setItem('rhythmtap-tutorial-complete-v1','1');
  localStorage.setItem('rhythmtap-tutorial-seen','1');
  localStorage.setItem('rhythtap-graphics','LOW');
  if(xp!==null)localStorage.setItem('rhythtap-profile',JSON.stringify({xp}));
 },{xp});
 await page.reload({waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForTimeout(700);

 // Keep the QA independent of the tutorial storage implementation. If a future
 // onboarding revision still opens training, exit it through the real UI contract.
 const tutorial=page.locator('.tutorial-screen').filter({visible:true}).first();
 if(await visible(tutorial,900)){
  const exit=page.locator('.tutorial-screen button[aria-label="Exit tutorial"]').first();
  if(await visible(exit,900)){
   await exit.click();
   await page.waitForTimeout(250);
  }
 }
 return visible(page.locator('.metal-home,.home').filter({visible:true}).first(),5000);
}

async function openCase(browserName,browser,test){
 const context=await newContext(browser,Boolean(test.landscape));
 const page=await context.newPage();
 const pageErrors=[];
 page.on('pageerror',error=>pageErrors.push(String(error)));
 try{
  const homeReady=await prepareHome(page);
  if(!homeReady){
   const rootText=(await page.locator('#root').innerText().catch(()=>'' )).trim();
   add(browserName,'high',`${test.label}: home bootstrap failed`,`Neither the seeded reload nor tutorial exit reached home; rootText=${rootText.slice(0,220)}`);
   return;
  }
  if(test.action){
   const trigger=page.locator(test.action.selector).filter({hasText:test.action.text||undefined,visible:true}).first();
   if(!(await visible(trigger,3000))){
    add(browserName,'high',`${test.label}: navigation trigger missing`,`Could not find ${test.action.selector}${test.action.text?` containing ${test.action.text}`:''}.`);
    return;
   }
   await trigger.click({force:true});
  }
  const expected=page.locator(test.expected).filter({visible:true}).first();
  if(!(await visible(expected,4500))){
   const rootText=(await page.locator('#root').innerText().catch(()=>'' )).trim();
   add(browserName,'high',`${test.label}: expected screen missing`,`Expected ${test.expected}; rootText=${rootText.length}.`);
   return;
  }
  await capturePaint(page,browserName,test.label);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  if(overflow>3)add(browserName,'medium',`${test.label}: horizontal overflow`,`${overflow}px beyond viewport.`);
  for(const error of pageErrors)add(browserName,'critical',`${test.label}: page exception`,error);
 }catch(error){
  add(browserName,'critical',`${test.label}: visual QA aborted`,error instanceof Error?error.stack||error.message:String(error));
 }finally{
  await context.close();
 }
}

const cases=[
 {label:'home portrait',expected:'.metal-home'},
 {label:'home landscape',expected:'.metal-home',landscape:true},
 {label:'settings',expected:'.settingsPage',action:{selector:'button[aria-label="Settings"]'}},
 {label:'tour',expected:'.career-tour',action:{selector:'.tour-main-cta'}},
 {label:'solo play',expected:'.select',action:{selector:'button',text:'SOLO PLAY'}},
 {label:'my charts',expected:'.imported-library',action:{selector:'button',text:'MY CHARTS'}},
 {label:'achievements',expected:'.achievementsPage',action:{selector:'button',text:'ACHIEVEMENTS'}},
 {label:'profile',expected:'.account-screen',action:{selector:'button',text:'PROFILE'}},
 // Anonymous Online Battle intentionally routes to RhythmTap ID.
 {label:'online battle sign-in gate',expected:'.account-screen',action:{selector:'button',text:'ONLINE BATTLE'}},
];

for(const [browserName,engine] of [['webkit-iphone14',webkit],['chromium-iphone14',chromium]]){
 const browser=await engine.launch({headless:true});
 try{for(const test of cases)await openCase(browserName,browser,test)}finally{await browser.close()}
}


const exactPhoneViewports=[
 {width:320,height:568},
 {width:375,height:667},
 {width:390,height:844},
 {width:393,height:852},
 {width:414,height:896},
 {width:430,height:932},
];

async function checkExactMainMenuViewport(browserName,browser,viewport,{largeValues=false}={}){
 const label=`main menu ${viewport.width}x${viewport.height}${largeValues?' large-values':''}`;
 const context=await newContext(browser,false,viewport);
 const page=await context.newPage();
 const pageErrors=[],consoleErrors=[];
 page.on('pageerror',error=>pageErrors.push(String(error)));
 page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
 try{
  if(!(await prepareHome(page,{xp:largeValues?10000000:null}))){
   add(browserName,'critical',`${label}: home not rendered`,(await page.locator('#root').innerText().catch(()=>'' )).slice(0,260));
   return;
  }

  const required=[
   ['logo','.reference-logo-block'],
   ['announcement','.reference-announcement'],
   ['character','.reference-character-slot'],
   ['player panel','.reference-player-card'],
   ['store','.reference-store-button'],
   ['user beatmaps','.metal-menu-charts'],
   ['settings','.metal-menu-settings'],
   ['play','.metal-menu-solo'],
  ];
  for(const [name,selector] of required){
   const locator=page.locator(selector).first();
   if(!(await visible(locator,2500))){add(browserName,'high',`${label}: ${name} missing`,selector);continue}
   const box=await locator.boundingBox();
   if(box&&(box.x<-2||box.x+box.width>viewport.width+2))add(browserName,'high',`${label}: ${name} outside horizontal viewport`,JSON.stringify(box));
  }

  const metrics=await page.evaluate(()=>({
   documentOverflowX:document.documentElement.scrollWidth-document.documentElement.clientWidth,
   documentOverflowY:document.documentElement.scrollHeight-window.innerHeight,
   bodyOverflowX:document.body.scrollWidth-document.body.clientWidth,
   content:document.querySelector('.metal-home-content')?{
    clientHeight:document.querySelector('.metal-home-content').clientHeight,
    scrollHeight:document.querySelector('.metal-home-content').scrollHeight,
    scrollWidth:document.querySelector('.metal-home-content').scrollWidth,
    clientWidth:document.querySelector('.metal-home-content').clientWidth,
   }:null,
  }));
  if(metrics.documentOverflowX>3||metrics.bodyOverflowX>3)add(browserName,'high',`${label}: horizontal page overflow`,JSON.stringify(metrics));
  if(metrics.documentOverflowY>3)add(browserName,'medium',`${label}: document owns vertical scrolling`,`${metrics.documentOverflowY}px; menu scrolling should remain inside .metal-home-content.`);

  const playBox=await page.locator('.metal-menu-solo').first().boundingBox();
  if(playBox&&(playBox.y<0||playBox.y+playBox.height>viewport.height+2))add(browserName,'high',`${label}: PLAY is not in the initial viewport`,JSON.stringify(playBox));

  const statValues=page.locator('.reference-stat-row b');
  const statCount=await statValues.count();
  for(let i=0;i<statCount;i++){
   const overflow=await statValues.nth(i).evaluate(el=>el.scrollWidth-el.clientWidth);
   if(overflow>1)add(browserName,'high',`${label}: player stat is clipped`,`${overflow}px clipped in row ${i+1}`);
  }
  if(largeValues){
   const stats=(await page.locator('.reference-stat-row').allTextContents()).join(' | ');
   if(!stats.replaceAll(',','').includes('1000000'))add(browserName,'high',`${label}: 1,000,000-credit stress value missing`,stats);
  }

  await capturePaint(page,browserName,label);
  for(const error of pageErrors)add(browserName,'critical',`${label}: page exception`,error);
  for(const error of consoleErrors.filter(value=>!/favicon|Failed to load resource.*404/i.test(value)))add(browserName,'high',`${label}: console error`,error);
 }catch(error){
  add(browserName,'critical',`${label}: viewport QA aborted`,error instanceof Error?error.stack||error.message:String(error));
 }finally{
  await context.close();
 }
}

{
 const browser=await webkit.launch({headless:true});
 try{
  for(const viewport of exactPhoneViewports)await checkExactMainMenuViewport('webkit-exact-menu',browser,viewport);
  await checkExactMainMenuViewport('webkit-exact-menu',browser,{width:320,height:568},{largeValues:true});
  await checkExactMainMenuViewport('webkit-exact-menu',browser,{width:844,height:390});
 }finally{await browser.close()}
}

const severity={critical:4,high:3,medium:2,low:1};
issues.sort((a,b)=>severity[b.severity]-severity[a.severity]);
const report={target,generatedAt:new Date().toISOString(),minimumPaintedPngBytes:MIN_PAINTED_PNG_BYTES,issues};
await fs.writeFile(path.join(out,'visual-report.json'),JSON.stringify(report,null,2));
const markdown=['# RhythmTap mobile visual paint QA','',`Target: ${target}`,`Issues: ${issues.length}`,'',...issues.map((issue,index)=>`${index+1}. **${issue.severity.toUpperCase()} — ${issue.title}** (${issue.browser})\n   ${issue.detail}`)].join('\n');
await fs.writeFile(path.join(out,'visual-report.md'),markdown);
console.log(markdown);
if(issues.some(issue=>issue.severity==='critical'||issue.severity==='high'))process.exitCode=1;
