import type {Plugin} from 'vite';

const replaceRequired=(source:string,label:string,before:string,after:string)=>{
 if(!source.includes(before))throw new Error(`[pr13-review-fixes] Unable to patch ${label}; transformed layout changed.`);
 return source.replace(before,after);
};

const patchTour=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'tour storage helpers',
  "const TOUR_KEY='rhythtap-tour-progress-v1';",
  "const TOUR_KEY='rhythtap-tour-progress-v1';\nconst tourStorageKey=(userId:string|null)=>`${TOUR_KEY}:${userId||'guest'}`;");
 code=replaceRequired(code,'tour storage functions',
  "const readLocalTour=():TourProgress[]=>{try{const rows=JSON.parse(localStorage.getItem(TOUR_KEY)||'[]');return Array.isArray(rows)?rows:[]}catch{return[]}};\nconst saveLocalTour=(rows:TourProgress[])=>localStorage.setItem(TOUR_KEY,JSON.stringify(rows));",
  "const readLocalTour=(userId:string|null):TourProgress[]=>{try{const rows=JSON.parse(localStorage.getItem(tourStorageKey(userId))||'[]');return Array.isArray(rows)?rows:[]}catch{return[]}};\nconst saveLocalTour=(userId:string|null,rows:TourProgress[])=>localStorage.setItem(tourStorageKey(userId),JSON.stringify(rows));");
 code=replaceRequired(code,'tour result local read',"const stars=starsFor(accuracy),local=readLocalTour(),existing=local.find", "const stars=starsFor(accuracy),local=readLocalTour(userId),existing=local.find");
 code=replaceRequired(code,'tour result local save',"saveLocalTour([...local.filter", "saveLocalTour(userId,[...local.filter");
 code=replaceRequired(code,'tour screen local state',"const[progress,setProgress]=useState<TourProgress[]>(readLocalTour()),[loading,setLoading]=useState(Boolean(userId));", "const[progress,setProgress]=useState<TourProgress[]>(()=>readLocalTour(userId)),[loading,setLoading]=useState(Boolean(userId));");
 code=replaceRequired(code,'tour identity reload',
  "useEffect(()=>{let mounted=true;(async()=>{if(!userId){setLoading(false);return}try{const client=await getAppClient(),{data}=await client.from('player_tour_progress').select('*').eq('user_id',userId);if(!mounted)return;const cloud=(data||[]).map((r:any)=>({gigId:String(r.gig_id),stars:Number(r.stars)||0,bestScore:Number(r.best_score)||0,bestAccuracy:Number(r.best_accuracy)||0,bestDifficulty:String(r.best_difficulty||'EASY') as TourDifficulty}));if(cloud.length){setProgress(cloud);saveLocalTour(cloud)}}finally{if(mounted)setLoading(false)}})();return()=>{mounted=false}},[userId]);",
  "useEffect(()=>{let mounted=true;setProgress(readLocalTour(userId));setLoading(Boolean(userId));(async()=>{if(!userId){setLoading(false);return}try{const client=await getAppClient(),{data}=await client.from('player_tour_progress').select('*').eq('user_id',userId);if(!mounted)return;const cloud=(data||[]).map((r:any)=>({gigId:String(r.gig_id),stars:Number(r.stars)||0,bestScore:Number(r.best_score)||0,bestAccuracy:Number(r.best_accuracy)||0,bestDifficulty:String(r.best_difficulty||'EASY') as TourDifficulty}));setProgress(cloud);saveLocalTour(userId,cloud)}finally{if(mounted)setLoading(false)}})();return()=>{mounted=false}},[userId]);");
 return code;
};

const patchMain=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'tour quit behavior',
  "quit={()=>setScreen('select')}",
  "quit={()=>{if(tourRun){setTourRun(null);setScreen('tour')}else setScreen('select')}}");
 return code;
};

export function pr13ReviewFixesTransform():Plugin{
 return {name:'rhythtap-pr13-review-fixes',enforce:'pre',transform(source,id){
  const normalized=id.replaceAll('\\\\','/');
  if(normalized.endsWith('/src/tour-social-ranked.tsx'))return{code:patchTour(source),map:null};
  if(normalized.endsWith('/src/main.tsx'))return{code:patchMain(source),map:null};
  return null;
 }};
}
