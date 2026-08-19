import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowLeft, Gauge, Pause, Play, RotateCcw, Settings, Volume2, Zap} from 'lucide-react';
import './styles.css';

type Note={id:number,time:number,lane:number,duration?:number};
type Difficulty='EASY'|'NORMAL'|'HARD';
type Song={id:string,title:string,artist:string,bpm:number,color:string,root:number,progression:number[],melody:number[],charts:Record<Difficulty,Note[]>};
type Screen='home'|'select'|'game'|'results'|'settings';
type Judge='PERFECT'|'GREAT'|'GOOD'|'MISS';
type Feedback=Judge|'HOLD';
const LANES=['D','F','J','K'];
const COLORS=['#29f2ff','#b650ff','#ff3dad','#ffd43b'];
const makeChart=(bpm:number, pattern:number[][], difficulty:Difficulty, bars=20):Note[]=>{
  const beat=60000/bpm, out:Note[]=[]; let id=0;
  for(let b=0;b<bars*4;b++){
    const base=pattern[b%pattern.length];
    const lanes=difficulty==='EASY'?[base[0]]:base;
    lanes.forEach((lane,i)=>out.push({id:id++,time:1800+b*beat,lane,duration:(b%(difficulty==='HARD'?9:13)===8&&i===0)?beat*(difficulty==='EASY'?1:1.5):undefined}));
    if(difficulty!=='EASY'&&b%8===6) out.push({id:id++,time:1800+b*beat+beat/2,lane:(b/2)%4});
    if(difficulty==='HARD'&&b%4===3){out.push({id:id++,time:1800+b*beat+beat*.5,lane:(b+1)%4});out.push({id:id++,time:1800+b*beat+beat*.75,lane:(b+3)%4})}
  } return out;
};
const charts=(bpm:number,pattern:number[][]):Record<Difficulty,Note[]>=>({EASY:makeChart(bpm,pattern,'EASY'),NORMAL:makeChart(bpm,pattern,'NORMAL'),HARD:makeChart(bpm,pattern,'HARD')});
const songs:Song[]=[
 {id:'voltage',title:'Midnight Voltage',artist:'NOVA//STATIC',bpm:118,color:'#22e8ff',root:45,progression:[0,5,3,7],melody:[12,15,19,17,12,10,7,10],charts:charts(118,[[0],[1],[2],[3],[0,3],[1],[2],[1,2]])},
 {id:'afterglow',title:'Afterglow Circuit',artist:'Luma Driver',bpm:132,color:'#ff3dad',root:40,progression:[0,3,7,5],melody:[12,14,15,19,17,15,14,10],charts:charts(132,[[0],[1,3],[2],[0,2],[3],[1],[0,3],[2]])},
 {id:'gravity',title:'Zero Gravity',artist:'Phase Garden',bpm:102,color:'#b650ff',root:43,progression:[0,7,5,3],melody:[12,19,17,15,14,10,12,7],charts:charts(102,[[0],[2],[1],[3],[0],[2],[1,3],[2]])}
];

class SynthTransport{
 ctx:AudioContext|null=null; startAt=0; pausedAt=0; timer:number|undefined; song:Song|null=null;
 async start(song:Song,from=0){this.stop();this.song=song;this.ctx=new AudioContext();await this.ctx.resume();this.startAt=this.ctx.currentTime-from/1000;this.schedule(song,from)}
 now(){return this.ctx?(this.ctx.currentTime-this.startAt)*1000:this.pausedAt}
 schedule(song:Song,from:number){if(!this.ctx)return;const ctx=this.ctx,step=30/song.bpm;let n=Math.floor(from/1000/step);const pump=()=>{if(!this.ctx)return;const horizon=(ctx.currentTime-this.startAt)+1.2;while(n*step<horizon){const t=this.startAt+n*step;if(t>ctx.currentTime){const bar=Math.floor(n/8),pos=n%8,root=song.root+song.progression[bar%song.progression.length];this.hat(t,pos%2?0.035:0.055);if(pos===0||pos===4)this.kick(t,pos===0?.34:.25);if(pos===2||pos===6)this.snare(t,.13);if(pos%2===0)this.tone(t,this.midi(root-12),step*.82,.12,'sawtooth',520);if(pos===0)this.chord(t,root,step*7.4,.035);if(pos%2===1)this.tone(t,this.midi(song.root+song.melody[(n>>1)%song.melody.length]),step*.7,.045,'square',1800)}n++}this.timer=window.setTimeout(pump,260)};pump()}
 midi(n:number){return 440*Math.pow(2,(n-69)/12)}
 tone(t:number,f:number,d:number,v:number,type:OscillatorType='triangle',cutoff=2200){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain(),filter=this.ctx.createBiquadFilter();o.type=type;o.frequency.setValueAtTime(f,t);filter.type='lowpass';filter.frequency.setValueAtTime(cutoff,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(filter).connect(g).connect(this.ctx.destination);o.start(t);o.stop(t+d+.03)}
 chord(t:number,root:number,d:number,v:number){[0,3,7].forEach((x,i)=>this.tone(t,this.midi(root+x),d,v/(i+1),'sine',1400))}
 kick(t:number,v:number){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.frequency.setValueAtTime(145,t);o.frequency.exponentialRampToValueAtTime(46,t+.12);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+.18);o.connect(g).connect(this.ctx.destination);o.start(t);o.stop(t+.2)}
 noise(t:number,d:number,v:number,highpass:number){if(!this.ctx)return;const length=Math.ceil(this.ctx.sampleRate*d),buffer=this.ctx.createBuffer(1,length,this.ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=Math.random()*2-1;const source=this.ctx.createBufferSource(),filter=this.ctx.createBiquadFilter(),g=this.ctx.createGain();source.buffer=buffer;filter.type='highpass';filter.frequency.value=highpass;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);source.connect(filter).connect(g).connect(this.ctx.destination);source.start(t);source.stop(t+d)}
 snare(t:number,v:number){this.noise(t,.12,v,1100);this.tone(t,185,.08,v*.35,'triangle',800)}
 hat(t:number,v:number){this.noise(t,.045,v,6200)}
 pause(){if(!this.ctx)return;this.pausedAt=this.now();this.ctx.close();this.ctx=null;if(this.timer)clearTimeout(this.timer)}
 async resume(){if(this.song)await this.start(this.song,this.pausedAt)}
 stop(){if(this.timer)clearTimeout(this.timer);if(this.ctx)this.ctx.close();this.ctx=null}
}

function App(){
 const [screen,setScreen]=useState<Screen>('home'),[song,setSong]=useState(songs[0]),[difficulty,setDifficulty]=useState<Difficulty>('NORMAL'),[speed,setSpeed]=useState(1),[offset,setOffset]=useState(()=>Number(localStorage.getItem('ntr-offset')||0));
 const [result,setResult]=useState({score:0,accuracy:0,maxCombo:0,counts:{PERFECT:0,GREAT:0,GOOD:0,MISS:0}});
 return <main>
  {screen==='home'&&<Home onPlay={()=>setScreen('select')} onSettings={()=>setScreen('settings')}/>} 
  {screen==='select'&&<Select song={song} setSong={setSong} difficulty={difficulty} setDifficulty={setDifficulty} back={()=>setScreen('home')} play={()=>setScreen('game')} />}
  {screen==='game'&&<Game song={song} difficulty={difficulty} speed={speed} offset={offset} quit={()=>setScreen('select')} finish={(r)=>{setResult(r);setScreen('results')}}/>}
  {screen==='results'&&<Results song={song} difficulty={difficulty} result={result} retry={()=>setScreen('game')} done={()=>setScreen('select')}/>} 
  {screen==='settings'&&<SettingsScreen speed={speed} setSpeed={setSpeed} offset={offset} setOffset={(v)=>{setOffset(v);localStorage.setItem('ntr-offset',String(v))}} back={()=>setScreen('home')}/>} 
 </main>
}

function Home({onPlay,onSettings}:{onPlay:()=>void,onSettings:()=>void}){return <section className="home screen">
 <div className="topbar"><span className="brandmark">NT//R</span><button className="icon" onClick={onSettings} aria-label="Settings"><Settings/></button></div>
 <div className="hero"><div className="eyebrow">A NEW RHYTHM EXPERIENCE</div><h1>NEON<br/><i>TAP</i></h1><p className="subtitle">RECHARGED</p><div className="orb"><span/><span/><span/></div><button className="primary" onClick={onPlay}><Play fill="currentColor"/> ENTER THE BEAT</button><p className="hint">HEADPHONES RECOMMENDED</p></div>
 <div className="footerline"><span>LOCAL PLAYER</span><strong>READY</strong></div></section>}

function Select({song,setSong,difficulty,setDifficulty,back,play}:{song:Song,setSong:(s:Song)=>void,difficulty:Difficulty,setDifficulty:(d:Difficulty)=>void,back:()=>void,play:()=>void}){return <section className="select screen">
 <header><button className="icon" onClick={back}><ArrowLeft/></button><div><small>CHOOSE YOUR SIGNAL</small><h2>TRACK SELECT</h2></div><span className="level">LV. 01</span></header>
 <div className="songlist">{songs.map((s,i)=><button key={s.id} className={'song '+(song.id===s.id?'active':'')} onClick={()=>setSong(s)} style={{'--song':s.color} as React.CSSProperties}>
  <div className="cover"><div className="covergrid"/><b>0{i+1}</b></div><div className="songmeta"><span>{s.artist}</span><h3>{s.title}</h3><div><em>{s.charts[difficulty].length} NOTES</em><span>{s.bpm} BPM</span></div></div><div className="rank">—</div></button>)}</div>
 <div className="difficulty" aria-label="Difficulty">{(['EASY','NORMAL','HARD'] as Difficulty[]).map(d=><button key={d} className={difficulty===d?'active':''} onClick={()=>setDifficulty(d)}><span>{d}</span><small>{song.charts[d].length}</small></button>)}</div>
 <div className="playdock"><div><small>{difficulty} · {song.charts[difficulty].length} NOTES</small><strong>{song.title}</strong></div><button className="primary" onClick={play}><Play fill="currentColor"/> PLAY</button></div>
 </section>}

function Game({song,difficulty,speed,offset,quit,finish}:{song:Song,difficulty:Difficulty,speed:number,offset:number,quit:()=>void,finish:(r:any)=>void}){
 const notes=song.charts[difficulty];
 const transport=useRef(new SynthTransport()),raf=useRef(0),pressed=useRef(new Set<number>()),judged=useRef(new Set<number>()),activeHolds=useRef(new Map<number,Note>()),feedbackTimer=useRef(0);
 const [ready,setReady]=useState(false),[now,setNow]=useState(0),[paused,setPaused]=useState(false),[score,setScore]=useState(0),[combo,setCombo]=useState(0),[maxCombo,setMaxCombo]=useState(0),[judge,setJudge]=useState<Feedback|null>(null),[counts,setCounts]=useState({PERFECT:0,GREAT:0,GOOD:0,MISS:0}),[pulse,setPulse]=useState(0),[energy,setEnergy]=useState(100);
 const scoreRef=useRef(score),comboRef=useRef(combo),countsRef=useRef(counts),maxRef=useRef(maxCombo);useEffect(()=>{scoreRef.current=score;comboRef.current=combo;countsRef.current=counts;maxRef.current=maxCombo},[score,combo,counts,maxCombo]);
 const end=notes.at(-1)!.time+2200;
 const showFeedback=(value:Feedback)=>{setJudge(value);clearTimeout(feedbackTimer.current);feedbackTimer.current=window.setTimeout(()=>setJudge(null),220)};
 const begin=async()=>{judged.current.clear();activeHolds.current.clear();pressed.current.clear();await transport.current.start(song);setReady(true)};
 useEffect(()=>()=>{cancelAnimationFrame(raf.current);transport.current.stop()},[]);
 const applyJudge=(j:Judge)=>{showFeedback(j);setCounts(c=>({...c,[j]:c[j]+1}));if(j==='MISS'){setCombo(0);setEnergy(e=>Math.max(0,e-8));return}const add={PERFECT:1000,GREAT:700,GOOD:350,MISS:0}[j];setScore(s=>s+add+comboRef.current*8);setCombo(c=>{const n=c+1;setMaxCombo(m=>Math.max(m,n));return n});setPulse(p=>Math.min(100,p+(j==='PERFECT'?5:2)));setEnergy(e=>Math.min(100,e+1))};
 const completeHold=(lane:number)=>{if(!activeHolds.current.has(lane))return;activeHolds.current.delete(lane);setScore(s=>s+600+comboRef.current*10);setPulse(p=>Math.min(100,p+8));setEnergy(e=>Math.min(100,e+3));showFeedback('HOLD')};
 const release=(lane:number)=>{pressed.current.delete(lane);const hold=activeHolds.current.get(lane);if(!hold)return;const remaining=hold.time+(hold.duration??0)-now;if(remaining<=120){completeHold(lane);return}activeHolds.current.delete(lane);showFeedback('MISS');setCombo(0);setEnergy(e=>Math.max(0,e-10))};
 const hit=(lane:number)=>{if(!ready||paused)return;pressed.current.add(lane);if(activeHolds.current.has(lane))return;let best:Note|undefined,dist=Infinity;for(const n of notes){const d=Math.abs(now-n.time);if(n.lane===lane&&!judged.current.has(n.id)&&d<dist){best=n;dist=d}}if(!best||dist>180)return;judged.current.add(best.id);if(best.duration)activeHolds.current.set(lane,best);applyJudge(dist<=45?'PERFECT':dist<=90?'GREAT':'GOOD')};
 useEffect(()=>{if(!ready||paused)return;const tick=()=>{const t=transport.current.now()+offset;setNow(t);for(const n of notes){if(!judged.current.has(n.id)&&t-n.time>180){judged.current.add(n.id);applyJudge('MISS')}}for(const [lane,n] of activeHolds.current){const tail=n.time+(n.duration??0);if(pressed.current.has(lane)&&t>=tail-90)completeHold(lane)}if(t>end){transport.current.stop();const c=countsRef.current,total=Object.values(c).reduce((a,b)=>a+b,0),weighted=c.PERFECT+c.GREAT*.8+c.GOOD*.5;finish({score:scoreRef.current,accuracy:total?weighted/total*100:0,maxCombo:maxRef.current,counts:c});return}raf.current=requestAnimationFrame(tick)};raf.current=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf.current)},[ready,paused]);
 useEffect(()=>{const down=(e:KeyboardEvent)=>{const i=['KeyD','KeyF','KeyJ','KeyK'].indexOf(e.code);if(i>=0){e.preventDefault();if(!e.repeat)hit(i)}if(e.code==='Escape')togglePause()};const up=(e:KeyboardEvent)=>{const i=['KeyD','KeyF','KeyJ','KeyK'].indexOf(e.code);if(i>=0)release(i)};addEventListener('keydown',down);addEventListener('keyup',up);return()=>{removeEventListener('keydown',down);removeEventListener('keyup',up)}},[now,ready,paused]);
 const togglePause=async()=>{if(!ready)return;if(paused){await transport.current.resume();setPaused(false)}else{pressed.current.clear();transport.current.pause();setPaused(true)}};
 const travel=1800/speed;
 return <section className="game screen"><div className="gamehud"><button className="icon" onClick={quit}><ArrowLeft/></button><div className="score"><small>SCORE</small><strong>{score.toString().padStart(7,'0')}</strong></div><button className="icon" onClick={togglePause}>{paused?<Play/>:<Pause/>}</button></div>
  <div className="meters"><div className="energy"><span style={{width:energy+'%'}}/></div><div className="pulse"><Zap size={14}/><span style={{width:pulse+'%'}}/></div></div>
  <div className="arena">{LANES.map((k,l)=><div className={'lane '+(activeHolds.current.has(l)?'holding':'')} key={k} style={{'--lane':COLORS[l]} as React.CSSProperties}>{notes.filter(n=>n.lane===l&&(!judged.current.has(n.id)||activeHolds.current.get(l)?.id===n.id)).map(n=>{const isActive=activeHolds.current.get(l)?.id===n.id;const y=isActive?Math.min(84,(now-(n.time-travel))/travel*100):(now-(n.time-travel))/travel*100;const tail=n.duration?Math.max(28,(n.time+n.duration-now)/travel*70):undefined;return y>-12&&y<115?<div key={n.id} className={'note '+(n.duration?'hold ':'')+(isActive?'active-hold':'')} style={{top:y+'%',height:n.duration?tail:undefined}}/>:null})}<button className="pad" onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);hit(l)}} onPointerUp={()=>release(l)} onPointerCancel={()=>release(l)}><span>{activeHolds.current.has(l)?'HOLD':k}</span></button></div>)}</div>
  <div className="feedback">{judge&&<strong className={judge.toLowerCase()}>{judge}</strong>}{combo>1&&<span>{combo}<small> COMBO</small></span>}</div>
  {!ready&&<div className="modal"><Volume2/><h2>READY TO SYNC?</h2><p>Turn up your sound. Notes are timed to the audio clock.</p><button className="primary" onClick={begin}><Play fill="currentColor"/> TAP TO START</button></div>}
  {paused&&<div className="modal"><Pause/><h2>PAUSED</h2><button className="primary" onClick={togglePause}><Play/> RESUME</button><button className="secondary" onClick={quit}>EXIT TRACK</button></div>}
 </section>}

function Results({song,difficulty,result,retry,done}:{song:Song,difficulty:Difficulty,result:any,retry:()=>void,done:()=>void}){const grade=result.accuracy>=95?'S':result.accuracy>=88?'A':result.accuracy>=75?'B':'C';useEffect(()=>{const key=`ntr-high-${song.id}-${difficulty}`;localStorage.setItem(key,String(Math.max(result.score,Number(localStorage.getItem(key)||0))))},[]);return <section className="results screen"><small>{difficulty} · TRACK COMPLETE</small><h2>{song.title}</h2><div className="grade">{grade}</div><div className="bigscore">{result.score.toLocaleString()}</div><p>{result.accuracy.toFixed(1)}% ACCURACY · {result.maxCombo} MAX COMBO</p><div className="breakdown">{Object.entries(result.counts).map(([k,v])=><div key={k}><span>{k}</span><strong>{String(v)}</strong></div>)}</div><button className="primary" onClick={retry}><RotateCcw/> RETRY</button><button className="secondary" onClick={done}>TRACK SELECT</button></section>}

function SettingsScreen({speed,setSpeed,offset,setOffset,back}:{speed:number,setSpeed:(n:number)=>void,offset:number,setOffset:(n:number)=>void,back:()=>void}){return <section className="settingsPage screen"><header><button className="icon" onClick={back}><ArrowLeft/></button><div><small>SYSTEM</small><h2>SETTINGS</h2></div></header><div className="setting"><div><Gauge/><span><strong>NOTE SPEED</strong><small>How quickly notes cross the playfield</small></span></div><output>{speed.toFixed(1)}×</output><input type="range" min="0.7" max="1.5" step="0.1" value={speed} onChange={e=>setSpeed(Number(e.target.value))}/></div><div className="setting"><div><Volume2/><span><strong>AUDIO OFFSET</strong><small>Shift note timing to match your device</small></span></div><output>{offset} ms</output><input type="range" min="-200" max="200" step="5" value={offset} onChange={e=>setOffset(Number(e.target.value))}/></div><div className="how"><h3>HOW TO PLAY</h3><p>Tap the four pads when notes meet the bright judgment line. Desktop players can use D, F, J and K. For long notes, keep holding until the glowing tail reaches the judgment line; releasing early breaks the combo.</p></div></section>}

createRoot(document.getElementById('root')!).render(<App/>);
