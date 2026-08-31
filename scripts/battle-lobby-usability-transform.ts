import type {Plugin} from 'vite';

const startControlBefore=`{isHost?<button className="primary" disabled={status!=='connected'||!bothReady} onClick={()=>{void startMatch()}}><Play fill="currentColor"/> START BATTLE</button>:<div className="mp-wait"><LoaderCircle/> WAITING FOR HOST</div>}`;
const startControlAfter=`{isHost?<button className="primary mp-start-button" disabled={status!=='connected'||!bothReady} onClick={()=>{void startMatch()}}>{status!=='connected'?<><LoaderCircle/> CONNECTING…</>:players.length<2?<><Users/> WAITING FOR RIVAL</>:!bothReady?<><LoaderCircle/> GETTING READY…</>:<><Play fill="currentColor"/> START BATTLE</>}</button>:<div className="mp-wait">{bothReady?<><Play/> READY — WAITING FOR HOST</>:<><LoaderCircle/> GETTING READY…</>}</div>}`;

const usabilityCss=`
/* Online Battle mobile usability: app-owned scrolling + persistent start control */
.multiplayer.battle-room{box-sizing:border-box;height:100dvh;min-height:100dvh;overflow-y:auto;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding-bottom:calc(118px + env(safe-area-inset-bottom))}
.battle-room .mp-panel{overflow:hidden}
.battle-room .mp-song-list{max-height:min(38dvh,360px);overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding-right:4px;scrollbar-gutter:stable}
.battle-room .mp-song-list button{touch-action:pan-y;flex:0 0 auto}
.battle-room .mp-song-list::-webkit-scrollbar{width:5px}.battle-room .mp-song-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:999px}
.battle-room .mp-room-footer{position:fixed;z-index:30;left:50%;bottom:calc(8px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(720px,calc(100% - 20px));margin:0;box-shadow:0 16px 44px rgba(0,0,0,.48);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
.battle-room .mp-room-footer .primary{min-width:178px;min-height:54px;font-size:12px;letter-spacing:.04em}.battle-room .mp-room-footer .primary:disabled{opacity:.72}.battle-room .mp-start-button svg.lucide-loader-circle{animation:mpSpin 1s linear infinite}
.battle-room .mp-room-footer>div:first-child{min-width:0}.battle-room .mp-room-footer>div:first-child span{min-width:0}.battle-room .mp-room-footer>div:first-child strong,.battle-room .mp-room-footer>div:first-child small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media(max-width:540px){.multiplayer.battle-room{padding-bottom:calc(150px + env(safe-area-inset-bottom))}.battle-room .mp-song-list{max-height:min(33dvh,280px)}.battle-room .mp-room-footer{width:calc(100% - 16px);bottom:calc(6px + env(safe-area-inset-bottom));padding:12px}.battle-room .mp-room-footer .primary{width:100%;min-height:56px}.battle-room .mp-room-code{margin-top:12px}.battle-room .mp-panel{margin-top:12px}}
`;

export function battleLobbyUsabilityTransform():Plugin{
 return {name:'rhythtap-battle-lobby-usability-transform',enforce:'pre',transform(source,id){
  const normalized=id.replaceAll('\\','/');
  if(normalized.endsWith('/src/multiplayer-lobby.tsx')){
   if(!source.includes(startControlBefore))throw new Error('[battle-usability] Start control marker missing after battle experience transform.');
   return {code:source.replace(startControlBefore,startControlAfter),map:null};
  }
  if(normalized.endsWith('/src/multiplayer.css'))return {code:source+usabilityCss,map:null};
  return null;
 }};
}
