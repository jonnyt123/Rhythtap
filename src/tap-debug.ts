import './tap-debug.css';

const params=new URLSearchParams(location.search);
const enabled=params.get('tapdebug')==='1'||localStorage.getItem('rhythtap-tap-debug')==='1';

type JudgementDetail={
  eventTimeStamp?:number;
  lane:number;
  hitTime:number;
  matched:boolean;
  noteId:number|null;
  noteTime:number|null;
  deltaMs:number|null;
  judge:string;
};

type PendingTap={
  stamp:number;
  lane:string;
  marker:HTMLElement;
  sequence:number;
  age:number;
};

if(enabled){
  localStorage.setItem('rhythtap-tap-debug','1');
  document.documentElement.dataset.tapDebug='1';

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
  const pending:PendingTap[]=[];

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

  const prunePending=()=>{
    const cutoff=performance.now()-2500;
    for(let i=pending.length-1;i>=0;i--){
      let normalized=pending[i].stamp;
      if(normalized>1e12&&Number.isFinite(performance.timeOrigin))normalized-=performance.timeOrigin;
      if(normalized<cutoff||!pending[i].marker.isConnected)pending.splice(i,1);
    }
  };

  const down=(event:PointerEvent)=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    sequence+=1;
    const marker=document.createElement('div');
    marker.className='rt-tap-debug-marker is-down';
    marker.dataset.pointer=String(event.pointerId);
    marker.dataset.eventStamp=String(event.timeStamp);
    marker.innerHTML='<i></i><b></b><span></span>';
    position(marker,event);
    const lane=laneLabel(event.target);
    const age=eventAge(event.timeStamp);
    const label=marker.querySelector('span');
    if(label)label.textContent=`#${sequence} ${lane} q${age}ms • WAIT`;
    status.textContent=`TAP DEBUG • #${sequence} • ${lane} • q${age}ms • WAIT`;
    layer.appendChild(marker);
    active.set(event.pointerId,marker);
    pending.push({stamp:event.timeStamp,lane,marker,sequence,age});
    prunePending();
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
    window.setTimeout(()=>{marker.remove();prunePending()},1200);
  };

  const judgement=(event:Event)=>{
    if(!(event instanceof CustomEvent))return;
    const detail=event.detail as JudgementDetail|undefined;
    if(!detail||!Number.isFinite(detail.lane))return;
    const lane=`L${detail.lane+1}`;
    const stamp=Number(detail.eventTimeStamp);
    let bestIndex=-1,bestGap=Infinity;
    for(let i=pending.length-1;i>=0;i--){
      const tap=pending[i];
      if(tap.lane!==lane)continue;
      const gap=Number.isFinite(stamp)?Math.abs(tap.stamp-stamp):0;
      if(gap<bestGap){bestIndex=i;bestGap=gap}
      if(gap<=.5)break;
    }
    if(bestIndex<0||bestGap>8)return;
    const tap=pending.splice(bestIndex,1)[0];
    const label=tap.marker.querySelector('span');
    const diagnostic=detail.matched&&Number.isFinite(detail.deltaMs)
      ?`${Number(detail.deltaMs)>=0?'+':''}${Math.round(Number(detail.deltaMs))}ms ${detail.judge} • N${detail.noteId} @${Math.round(Number(detail.noteTime))}ms`
      :'NO NOTE';
    tap.marker.dataset.judge=detail.matched?detail.judge:'NO_NOTE';
    tap.marker.classList.add(detail.matched?`judge-${detail.judge.toLowerCase()}`:'judge-no-note');
    if(label)label.textContent=`#${tap.sequence} ${lane} q${tap.age}ms • ${diagnostic}`;
    status.textContent=`TAP DEBUG • #${tap.sequence} • ${lane} • q${tap.age}ms • ${diagnostic}`;
  };

  addEventListener('pointerdown',down,{capture:true,passive:true});
  addEventListener('pointermove',move,{capture:true,passive:true});
  addEventListener('pointerup',finish,{capture:true,passive:true});
  addEventListener('pointercancel',finish,{capture:true,passive:true});
  addEventListener('rhythtap:tap-judgement',judgement as EventListener);

  addEventListener('beforeunload',()=>{
    delete document.documentElement.dataset.tapDebug;
    removeEventListener('pointerdown',down,true);
    removeEventListener('pointermove',move,true);
    removeEventListener('pointerup',finish,true);
    removeEventListener('pointercancel',finish,true);
    removeEventListener('rhythtap:tap-judgement',judgement as EventListener);
  },{once:true});
}
