import './tap-debug.css';

const params=new URLSearchParams(location.search);
const enabled=params.get('tapdebug')==='1'||localStorage.getItem('rhythtap-tap-debug')==='1';

if(enabled){
  localStorage.setItem('rhythtap-tap-debug','1');

  const layer=document.createElement('div');
  layer.className='rt-tap-debug-layer';
  layer.setAttribute('aria-hidden','true');

  const status=document.createElement('div');
  status.className='rt-tap-debug-status';
  status.textContent='TAP DEBUG • 0';
  layer.appendChild(status);
  document.body.appendChild(layer);

  let sequence=0;
  const active=new Map<number,HTMLElement>();

  const eventAge=(stamp:number)=>{
    let normalized=stamp;
    if(normalized>1e12&&Number.isFinite(performance.timeOrigin))normalized-=performance.timeOrigin;
    const age=performance.now()-normalized;
    return Number.isFinite(age)?Math.max(0,Math.round(age)):0;
  };

  const laneLabel=(target:EventTarget|null)=>{
    const element=target instanceof Element?target.closest('.pad'):null;
    if(!element)return 'SCREEN';
    const label=element.getAttribute('aria-label')||'';
    const match=label.match(/Lane\s+(\d+)/i);
    return match?`L${match[1]}`:'PAD';
  };

  const position=(marker:HTMLElement,event:PointerEvent)=>{
    marker.style.setProperty('--tap-x',`${event.clientX}px`);
    marker.style.setProperty('--tap-y',`${event.clientY}px`);
  };

  const down=(event:PointerEvent)=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    sequence+=1;
    const marker=document.createElement('div');
    marker.className='rt-tap-debug-marker is-down';
    marker.dataset.pointer=String(event.pointerId);
    marker.innerHTML='<i></i><b></b><span></span>';
    position(marker,event);
    const lane=laneLabel(event.target);
    const age=eventAge(event.timeStamp);
    const label=marker.querySelector('span');
    if(label)label.textContent=`#${sequence} ${lane} ${age}ms`;
    status.textContent=`TAP DEBUG • ${sequence} • ${lane} • ${age}ms`;
    layer.appendChild(marker);
    active.set(event.pointerId,marker);
  };

  const move=(event:PointerEvent)=>{
    const marker=active.get(event.pointerId);
    if(marker)position(marker,event);
  };

  const finish=(event:PointerEvent)=>{
    const marker=active.get(event.pointerId);
    if(!marker)return;
    position(marker,event);
    marker.classList.remove('is-down');
    marker.classList.add('is-up');
    active.delete(event.pointerId);
    window.setTimeout(()=>marker.remove(),650);
  };

  addEventListener('pointerdown',down,{capture:true,passive:true});
  addEventListener('pointermove',move,{capture:true,passive:true});
  addEventListener('pointerup',finish,{capture:true,passive:true});
  addEventListener('pointercancel',finish,{capture:true,passive:true});

  addEventListener('beforeunload',()=>{
    removeEventListener('pointerdown',down,true);
    removeEventListener('pointermove',move,true);
    removeEventListener('pointerup',finish,true);
    removeEventListener('pointercancel',finish,true);
  },{once:true});
}
