import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium,devices} from 'playwright';

const target=process.env.RHYTHTAP_QA_URL||'http://127.0.0.1:4173/Rhythtap/';
const out=path.resolve(process.env.RHYTHTAP_QA_OUT||'qa-artifacts');
await fs.mkdir(out,{recursive:true});

const issues=[];
const add=(severity,title,detail)=>issues.push({browser:'chromium-pixel5',severity,title,detail});
const vis=async(locator,ms=2500)=>{try{await locator.waitFor({state:'visible',timeout:ms});return true}catch{return false}};
const snap=(page,name)=>page.screenshot({path:path.join(out,`chromium-pixel5-${name}.png`),fullPage:false});

const browser=await chromium.launch({headless:true});
try{
  const profile=devices['Pixel 5'];

  const fresh=async({landscape=false,clean=false}={})=>{
    const context=await browser.newContext({
      ...profile,
      viewport:landscape?{width:851,height:393}:profile.viewport,
      screen:landscape?{width:851,height:393}:profile.screen,
      locale:'en-CA',
      timezoneId:'America/Toronto',
    });
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(target,{waitUntil:'domcontentloaded',timeout:45000});
    if(!clean){
      await page.evaluate(()=>{
        localStorage.setItem('rhythmtap-tutorial-complete-v1','1');
        localStorage.setItem('rhythtap-tutorial-seen','1');
      });
      await page.reload({waitUntil:'domcontentloaded'});
    }
    await page.waitForTimeout(700);
    return{context,page,errors};
  };

  const checkHome=async(page,label)=>{
    const home=page.locator('.metal-home,.home');
    if(!(await vis(home,4000))){
      add('critical',`${label}: home not rendered`,(await page.locator('#root').innerText().catch(()=>'' )).slice(0,250));
      return false;
    }
    return true;
  };

  const checkOverflow=async(page,label)=>{
    const x=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    if(x>3)add('medium',`${label}: horizontal overflow`,`${x}px beyond viewport`);
  };

  // Clean first launch.
  {
    const{context,page,errors}=await fresh({clean:true});
    if(!(await vis(page.locator('.tutorial-screen'),3000)))add('high','Android first-launch tutorial missing','Expected .tutorial-screen on clean storage');
    await snap(page,'01-first-launch');
    for(const e of errors)add('critical','First-launch page exception',e);
    await context.close();
  }

  // Portrait and landscape layout.
  for(const landscape of [false,true]){
    const{context,page,errors}=await fresh({landscape});
    const label=landscape?'Landscape':'Portrait';
    if(await checkHome(page,label)){
      await checkOverflow(page,`${label} home`);
      await snap(page,landscape?'03-home-landscape':'02-home-portrait');
    }
    for(const e of errors)add('critical',`${label} page exception`,e);
    await context.close();
  }

  // Settings persistence.
  {
    const{context,page,errors}=await fresh();
    if(await checkHome(page,'Settings')){
      const button=page.locator('button[aria-label="Settings"]').first();
      if(!(await vis(button))){
        add('high','Settings button missing','Home rendered without Settings');
      }else{
        await button.click();
        if(!(await vis(page.locator('.settingsPage'),3000))){
          add('high','Settings failed to render','Expected .settingsPage');
        }else{
          const speed=page.locator('.settingsPage input[type="range"]').first();
          if(await vis(speed)){
            await speed.focus();
            await speed.press('End');
            await page.waitForTimeout(150);
            const stored=await page.evaluate(()=>localStorage.getItem('ntr-speed'));
            if(stored!=='1.5')add('high','Android note speed failed to persist',`ntr-speed=${stored}`);
          }
          await snap(page,'04-settings');
        }
      }
    }
    for(const e of errors)add('critical','Settings page exception',e);
    await context.close();
  }

  // Tour, gameplay, background/foreground, and network interruption.
  {
    const{context,page,errors}=await fresh();
    if(await checkHome(page,'Tour')){
      const tour=page.locator('.tour-main-cta');
      if(await vis(tour)){
        await tour.click();
        if(!(await vis(page.locator('.career-tour'),4000))){
          add('high','Tour failed to render','Expected .career-tour');
        }else{
          await checkOverflow(page,'Tour');
          const play=page.locator('button[aria-label^="Play "]:not([disabled])').first();
          if(await vis(play)){
            await play.click();
            await page.waitForTimeout(6500);
            if(!(await vis(page.locator('.game'),3000))){
              add('high','Android Tour failed to enter gameplay','Expected .game after preroll');
            }else{
              await snap(page,'05-game-running');
              const bg=await context.newPage();
              await bg.setContent('<p>background</p>');
              await bg.bringToFront();
              await page.waitForTimeout(800);
              await page.bringToFront();
              await context.setOffline(true);
              await page.waitForTimeout(900);
              await context.setOffline(false);
              await page.waitForTimeout(900);
              if(!(await vis(page.locator('.game,.results'),2200)))add('high','Android gameplay lost state after interruption','No game/results after resume');
              await snap(page,'06-game-resumed');
              await bg.close();
            }
          }
        }
      }
    }
    for(const e of errors)add('critical','Tour/game page exception',e);
    await context.close();
  }

  // Offline shell.
  {
    const{context,page,errors}=await fresh();
    await page.waitForTimeout(1800);
    await context.setOffline(true);
    await page.reload({waitUntil:'domcontentloaded',timeout:15000}).catch(()=>{});
    await page.waitForTimeout(700);
    const text=(await page.locator('#root').innerText().catch(()=>'' )).trim();
    if(!text)add('high','Android offline reload produced blank shell','No rendered app text while offline');
    await snap(page,'07-offline');
    await context.setOffline(false);
    for(const e of errors.filter(e=>!e.includes('fetch')))add('critical','Offline page exception',e);
    await context.close();
  }
}finally{
  await browser.close();
}

const order={critical:4,high:3,medium:2,low:1};
issues.sort((a,b)=>order[b.severity]-order[a.severity]);
const report={target,generatedAt:new Date().toISOString(),issues};
await fs.writeFile(path.join(out,'android-report.json'),JSON.stringify(report,null,2));
const md=['# RhythmTap Android destructive mobile QA','',`Target: ${target}`,`Issues: ${issues.length}`,'',...issues.map((i,n)=>`${n+1}. **${i.severity.toUpperCase()} — ${i.title}**\n   ${i.detail}`)].join('\n');
await fs.writeFile(path.join(out,'android-report.md'),md);
console.log(md);
if(issues.some(i=>i.severity==='critical'||i.severity==='high'))process.exitCode=1;
