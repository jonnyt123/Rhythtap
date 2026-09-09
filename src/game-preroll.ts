const PREROLL_MS=5000;
let armed=false;
let disarmTimer=0;

const sleep=(ms:number)=>new Promise<void>(resolve=>window.setTimeout(resolve,ms));

function armPreroll(){
  armed=true;
  clearTimeout(disarmTimer);
  disarmTimer=window.setTimeout(()=>{armed=false},120000);
}

function consumePreroll(){
  if(!armed)return false;
  armed=false;
  clearTimeout(disarmTimer);
  return true;
}

function getGameScreen(){return document.querySelector<HTMLElement>('.game.screen')}

async function showCountdown(){
  const game=getGameScreen();
  if(!game){await sleep(PREROLL_MS);return}
  const overlay=document.createElement('div');
  overlay.className='rt-preroll';
  overlay.setAttribute('role','status');
  overlay.setAttribute('aria-live','assertive');
  overlay.innerHTML='<small>GET READY</small><strong>5</strong><span>TRACK STARTS IN</span>';
  game.appendChild(overlay);
  const value=overlay.querySelector('strong')!;
  for(let count=5;count>=1;count--){
    value.textContent=String(count);
    overlay.dataset.tick=String(count);
    await sleep(1000);
  }
  value.textContent='GO';
  overlay.dataset.tick='go';
  window.setTimeout(()=>overlay.remove(),360);
}

// Arm only from the actual gameplay-start controls. Preview playback and other
// media remain untouched.
document.addEventListener('pointerdown',event=>{
  const button=(event.target as Element|null)?.closest('button');
  if(!button||!button.closest('.game.screen'))return;
  const label=(button.textContent||'').replace(/\s+/g,' ').trim().toUpperCase();
  if(label.includes('TAP TO START')||label.includes('START PLAYING'))armPreroll();
},{capture:true,passive:true});

const nativeMediaPlay=HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play=async function(){
  if(!consumePreroll())return nativeMediaPlay.call(this);

  // Unlock iOS media playback while the user activation is still live, but
  // keep the transport parked at t=0 while the five-second countdown runs.
  const wasMuted=this.muted;
  const oldVolume=this.volume;
  this.muted=true;
  this.volume=0;
  await nativeMediaPlay.call(this);
  this.pause();
  try{this.currentTime=0}catch{}
  await showCountdown();
  this.muted=wasMuted;
  this.volume=oldVolume;
  return nativeMediaPlay.call(this);
};

const AudioContextCtor=window.AudioContext;
if(AudioContextCtor){
  const nativeResume=AudioContextCtor.prototype.resume;
  AudioContextCtor.prototype.resume=async function(){
    if(!consumePreroll())return nativeResume.call(this);

    // Unlock the WebAudio context under the original user gesture, suspend at
    // zero, then release it exactly when the countdown reaches GO. The game
    // sets startAt after this promise resolves, so chart time and synth audio
    // share the same zero point.
    await nativeResume.call(this);
    if(this.state==='running')await this.suspend();
    await showCountdown();
    return nativeResume.call(this);
  };
}
