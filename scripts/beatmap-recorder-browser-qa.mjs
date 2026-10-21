import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const base=process.env.RHYTHTAP_QA_URL||'http://127.0.0.1:4173/Rhythtap/';
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
page.setDefaultTimeout(15000);
const errors=[];
page.on('pageerror',err=>errors.push(String(err)));

function wav(duration=4,sampleRate=8000){
 const samples=duration*sampleRate,bytes=samples*2,buf=Buffer.alloc(44+bytes);
 buf.write('RIFF',0);buf.writeUInt32LE(36+bytes,4);buf.write('WAVE',8);
 buf.write('fmt ',12);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(1,22);
 buf.writeUInt32LE(sampleRate,24);buf.writeUInt32LE(sampleRate*2,28);
 buf.writeUInt16LE(2,32);buf.writeUInt16LE(16,34);
 buf.write('data',36);buf.writeUInt32LE(bytes,40);
 for(let i=0;i<samples;i++)buf.writeInt16LE(Math.round(1600*Math.sin(i*2*Math.PI*220/sampleRate)),44+i*2);
 return buf;
}

try{
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{
  localStorage.setItem('rhythtap-tutorial-complete-v1','1');
  localStorage.setItem('rhythtap-tutorial-seen','1');
 });
 await page.reload({waitUntil:'domcontentloaded'});
 if(await page.locator('.tutorial-screen').count())
  await page.getByRole('button',{name:'Exit tutorial'}).click();
 await page.locator('.metal-home').waitFor();
 assert.equal(await page.locator('img[alt="RhythmTap"]').count(),0,'broken legacy logo image still exists');
 assert.equal(await page.locator('.rhythmtap-metal-wordmark').count(),1,'missing replacement menu logo');
 await page.locator('.metal-menu-charts').click();
 await page.locator('.imported-library').waitFor();
 await page.locator('.library-create').click();
 await page.locator('.beatmap-recorder').waitFor();
 const file=wav();
 await page.getByRole('input',{name:'Upload audio file'}).count().catch(()=>0);
 await page.locator('input[aria-label="Upload audio file"]').setInputFiles({name:'QA Beatmap.wav',mimeType:'audio/wav',buffer:file});
 await page.waitForFunction(()=>{const el=document.querySelector('audio');return el&&Number.isFinite(el.duration)&&el.duration>2});
 await page.locator('.record-button').first().click();
 await page.waitForTimeout(200);
 await page.locator('.beatmap-recorder-lane.lane-0').click();
 await page.waitForTimeout(160);
 await page.locator('.beatmap-recorder-lane.lane-1').click();
 await page.waitForTimeout(160);
 await page.locator('.beatmap-recorder-lane.lane-2').click();
 const status=await page.locator('.beatmap-recorder-stage-heading strong').innerText();
 assert.match(status,/3\s*\/\s*12,000/,'3 taps should have been recorded');
 if(await page.getByRole('button',{name:/PAUSE/}).count())await page.getByRole('button',{name:/PAUSE/}).click();
 await page.locator('.beatmap-recorder-save').click();
 await page.locator('.imported-library').waitFor();
 assert.match(await page.locator('.imported-list').innerText(),/QA Beatmap/i);
 const saved=await page.evaluate(async()=>{
  const songs=JSON.parse(localStorage.getItem('rhythtap-imported-songs')||'[]');
  const track=songs.find(song=>song.title==='QA Beatmap');
  if(!track)return{found:false};
  const stored=await new Promise((resolve,reject)=>{
   const open=indexedDB.open('rhythtap-audio',1);
   open.onerror=()=>reject(open.error);
   open.onsuccess=()=>{
    const db=open.result,req=db.transaction('tracks','readonly').objectStore('tracks').get(track.id);
    req.onsuccess=()=>{resolve(req.result);db.close()};
    req.onerror=()=>reject(req.error);
   };
  });
  return {found:true,localAudio:track.localAudio,notes:track.charts.NORMAL.length,
   sameAllDifficulties:track.charts.EASY.length===track.charts.NORMAL.length&&track.charts.HARD.length===track.charts.NORMAL.length,
   audioBytes:stored?.size||0};
 });
 assert(saved.found&&saved.localAudio&&saved.notes===3&&saved.sameAllDifficulties&&saved.audioBytes>44,JSON.stringify(saved));
 await page.reload({waitUntil:'domcontentloaded'});
 if(await page.locator('.tutorial-screen').count())await page.getByRole('button',{name:'Exit tutorial'}).click();
 await page.locator('.metal-menu-charts').click();
 assert.match(await page.locator('.imported-list').innerText(),/QA Beatmap/i);
 await page.locator('.imported-play').first().click();
 await page.waitForTimeout(300);
 assert.equal(await page.locator('.beatmap-recorder').count(),0);
 await page.goto(base,{waitUntil:'domcontentloaded'});
 if(await page.locator('.tutorial-screen').count())await page.getByRole('button',{name:'Exit tutorial'}).click();
 await page.locator('.reference-store-button').click();
 await page.locator('.song-store-hero').waitFor();
 assert.equal(await page.locator('img[alt="RhythmTap"]').count(),0,'broken logo in song store');
 assert.equal(await page.locator('.song-store-wordmark').count(),1);
 const metrics=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
 assert(metrics.document<=metrics.width&&metrics.body<=metrics.width,JSON.stringify(metrics));
 assert.deepEqual(errors,[],'page errors');
 console.log('BEATMAP RECORDER AND LOGO QA PASS',JSON.stringify({saved,metrics}));
 await page.screenshot({path:'beatmap-qa-store.png'});
}finally{await browser.close()}
