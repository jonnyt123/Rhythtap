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

async function newContext(browser,landscape=false){
 const portrait=devices['iPhone 14'];
 const landscapeProfile=devices['iPhone 14 landscape'];
 const profile=landscape&&landscapeProfile?landscapeProfile:portrait;
 const context=await browser.newContext({...profile,locale:'en-CA',timezoneId:'America/Toronto'});
 await context.addInitScript(()=>{
  localStorage.setItem('rhythmtap-tutorial-complete-v1','1');
  localStorage.setItem('rhythtap-tutorial-seen','1');
  localStorage.setItem('rhythtap-graphics','LOW');
 });
 return context;
}

async function openCase(browserName,browser,test){
 const context=await newContext(browser,Boolean(test.landscape));
 const page=await context.newPage();
 const pageErrors=[];
 page.on('pageerror',error=>pageErrors.push(String(error)));
 try{
  await page.goto(target,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(700);
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

const severity={critical:4,high:3,medium:2,low:1};
issues.sort((a,b)=>severity[b.severity]-severity[a.severity]);
const report={target,generatedAt:new Date().toISOString(),minimumPaintedPngBytes:MIN_PAINTED_PNG_BYTES,issues};
await fs.writeFile(path.join(out,'visual-report.json'),JSON.stringify(report,null,2));
const markdown=['# RhythmTap mobile visual paint QA','',`Target: ${target}`,`Issues: ${issues.length}`,'',...issues.map((issue,index)=>`${index+1}. **${issue.severity.toUpperCase()} — ${issue.title}** (${issue.browser})\n   ${issue.detail}`)].join('\n');
await fs.writeFile(path.join(out,'visual-report.md'),markdown);
console.log(markdown);
if(issues.some(issue=>issue.severity==='critical'||issue.severity==='high'))process.exitCode=1;
