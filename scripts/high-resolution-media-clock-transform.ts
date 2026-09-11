import type {Plugin} from 'vite';

const replaceRequired=(source:string,label:string,before:string,after:string)=>{
 if(!source.includes(before))throw new Error(`[media-clock] Unable to patch ${label}; source layout changed.`);
 return source.replace(before,after);
};

export function highResolutionMediaClockTransform():Plugin{return{name:'rhythtap-high-resolution-media-clock',enforce:'pre',transform(source,id){
 if(!id.replaceAll('\\','/').endsWith('/src/main.tsx'))return null;
 let code=source;
 code=replaceRequired(code,'transport clock fields',
  "ctx:AudioContext|null=null;source:AudioBufferSourceNode|null=null;media:HTMLAudioElement|null=null;objectUrl='';startAt=0;pausedAt=0;timer:number|undefined;song:Song|null=null;onDownloadProgress:DownloadProgress=()=>{};",
  "ctx:AudioContext|null=null;source:AudioBufferSourceNode|null=null;media:HTMLAudioElement|null=null;objectUrl='';startAt=0;pausedAt=0;timer:number|undefined;song:Song|null=null;onDownloadProgress:DownloadProgress=()=>{};mediaClockPerf=0;mediaClockMs=0;mediaClockSyncPerf=0;");
 code=replaceRequired(code,'media clock anchor',
  "await media.play();this.pausedAt=media.currentTime*1000",
  "await media.play();this.pausedAt=media.currentTime*1000;this.mediaClockMs=this.pausedAt;this.mediaClockPerf=performance.now();this.mediaClockSyncPerf=this.mediaClockPerf");
 code=replaceRequired(code,'high resolution media now',
  " ended(){return Boolean(this.media?.ended)}\n now(){return this.media?this.media.currentTime*1000:this.ctx?(this.ctx.currentTime-this.startAt)*1000:this.pausedAt}",
  " ended(){return Boolean(this.media?.ended)}\n mediaNow(){const media=this.media;if(!media)return this.pausedAt;const perf=performance.now(),sample=media.currentTime*1000;if(media.paused||media.seeking||media.readyState<3){this.mediaClockMs=sample;this.mediaClockPerf=perf;this.mediaClockSyncPerf=perf;return sample}if(!this.mediaClockPerf){this.mediaClockMs=sample;this.mediaClockPerf=perf;this.mediaClockSyncPerf=perf;return sample}let predicted=this.mediaClockMs+(perf-this.mediaClockPerf)*media.playbackRate,drift=sample-predicted;if(Math.abs(drift)>60){this.mediaClockMs=sample;this.mediaClockPerf=perf;this.mediaClockSyncPerf=perf;return sample}if(perf-this.mediaClockSyncPerf>1000){this.mediaClockMs=predicted+drift*.12;this.mediaClockPerf=perf;this.mediaClockSyncPerf=perf;predicted=this.mediaClockMs}return predicted}\n now(){return this.media?this.mediaNow():this.ctx?(this.ctx.currentTime-this.startAt)*1000:this.pausedAt}");
 return{code,map:null};
}}}
