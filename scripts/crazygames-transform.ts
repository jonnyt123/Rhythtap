import type {Plugin} from 'vite';

export function crazygamesTransform():Plugin {
 return {
  name:'rhythtap-crazygames', enforce:'pre',
  transform(source,id){
   if(!id.replaceAll('\\','/').endsWith('/src/main.tsx'))return null;
   const start=source.indexOf('function App(){');
   const end=source.indexOf('\nfunction Home(',start);
   if(start<0||end<0)throw new Error('Portal App boundary missing');
   const app=`function App(){
    const [track,setTrack]=useState(0),[attempt,setAttempt]=useState(0);
    const [result,setResult]=useState<{score:number;accuracy:number}|null>(null);
    const session=useMultiplayerSession(null,()=>{});
    const songs=baseSongs.filter(song=>['voltage','afterglow','gravity'].includes(song.id));
    const song=songs[track];
    if(result)return <section className="screen results"><h1>SET COMPLETE</h1><h2>{song.title}</h2><p>{result.score.toLocaleString()} POINTS · {result.accuracy.toFixed(1)}% ACCURACY</p><button className="primary" onClick={()=>{setResult(null);setAttempt(value=>value+1)}}>PLAY AGAIN</button><button className="secondary" onClick={()=>{setTrack(value=>(value+1)%songs.length);setResult(null);setAttempt(value=>value+1)}}>NEXT TRACK</button></section>;
    return <Game key={attempt} song={song} difficulty="EASY" speed={1} offset={loadCalibration()} noteTheme="ORB" padTheme="CORE" graphicsMode="LOW" multiplayerSession={session} engagementUserId={null} engagementReady={false} quit={()=>{setTrack(value=>(value+1)%songs.length);setAttempt(value=>value+1)}} finish={setResult}/>;
   }
   `;
   let code=source.slice(0,start)+app+source.slice(end);
   code=code.replace("useState(()=>!multiplayerSession.enabled&&localStorage.getItem('rhythtap-tutorial-seen')!=='1')","useState(false)");
   code=code.replace("Turn up your sound. Notes are timed to the audio clock.","Tap the circle beneath each falling note. Hold long notes until their tails reach the circle.");
   code=code.replace("import.meta.env.MODE!=='itch'&&'serviceWorker'in navigator","false&&'serviceWorker'in navigator");
   return {code,map:null};
  },
  transformIndexHtml(html){return html.replace(/<link[^>]+(?:fonts.googleapis.com|fonts.gstatic.com)[^>]*>/g,'');},
 };
}
