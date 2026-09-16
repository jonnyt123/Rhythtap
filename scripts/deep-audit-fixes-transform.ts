import type {Plugin} from 'vite';

const replaceRequired=(source:string,label:string,before:string,after:string)=>{
 if(!source.includes(before))throw new Error(`[deep-audit] Unable to patch ${label}; transformed layout changed.`);
 return source.replace(before,after);
};

const patchMain=(source:string)=>{
 let code=source;
 code=replaceRequired(code,'indexeddb open failure handling',
  "const openAudioStore=()=>new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('rhythtap-audio',1);request.onupgradeneeded=()=>request.result.createObjectStore('tracks');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});",
  "const openAudioStore=()=>new Promise<IDBDatabase>((resolve,reject)=>{if(typeof indexedDB==='undefined'){reject(new Error('Local audio storage is unavailable in this browser.'));return}const request=indexedDB.open('rhythtap-audio',1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('tracks'))request.result.createObjectStore('tracks')};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Unable to open local audio storage.'));request.onblocked=()=>reject(new Error('Local audio storage is blocked by another RhythmTap tab. Close other tabs and try again.'))});"
 );
 code=replaceRequired(code,'indexeddb write abort handling',
  "const storeAudio=async(id:string,file:File)=>{const db=await openAudioStore();await new Promise<void>((resolve,reject)=>{const transaction=db.transaction('tracks','readwrite');transaction.objectStore('tracks').put(file,id);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error)});db.close()};",
  "const storeAudio=async(id:string,file:File)=>{const db=await openAudioStore();try{await new Promise<void>((resolve,reject)=>{const transaction=db.transaction('tracks','readwrite');transaction.objectStore('tracks').put(file,id);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error||new Error('Unable to save local audio.'));transaction.onabort=()=>reject(transaction.error||new Error('Local audio save was aborted.'))})}finally{db.close()}};"
 );
 code=replaceRequired(code,'indexeddb read cleanup',
  "const getStoredAudio=async(id:string)=>{const db=await openAudioStore(),file=await new Promise<Blob|undefined>((resolve,reject)=>{const request=db.transaction('tracks').objectStore('tracks').get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});db.close();return file};",
  "const getStoredAudio=async(id:string)=>{const db=await openAudioStore();try{return await new Promise<Blob|undefined>((resolve,reject)=>{const request=db.transaction('tracks').objectStore('tracks').get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Unable to read local audio.'))})}finally{db.close()}};"
 );
 code=replaceRequired(code,'indexeddb delete abort handling',
  "const deleteStoredAudio=async(id:string)=>{const db=await openAudioStore();await new Promise<void>((resolve,reject)=>{const transaction=db.transaction('tracks','readwrite');transaction.objectStore('tracks').delete(id);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error)});db.close()};",
  "const deleteStoredAudio=async(id:string)=>{const db=await openAudioStore();try{await new Promise<void>((resolve,reject)=>{const transaction=db.transaction('tracks','readwrite');transaction.objectStore('tracks').delete(id);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error||new Error('Unable to delete local audio.'));transaction.onabort=()=>reject(transaction.error||new Error('Local audio deletion was aborted.'))})}finally{db.close()}};"
 );
 code=replaceRequired(code,'generic mobile audio mime fallback',
  "const attachAudio=async(id:string,file:File)=>{if(!file.type.startsWith('audio/'))throw new Error('Choose a valid audio file.');await storeAudio(id,file);",
  "const attachAudio=async(id:string,file:File)=>{const mime=file.type.toLowerCase(),knownExtension=/\\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(file.name),genericMime=!mime||mime==='application/octet-stream';if(!(mime.startsWith('audio/')||(genericMime&&knownExtension)))throw new Error('Choose a valid audio file.');await storeAudio(id,file);"
 );
 code=replaceRequired(code,'safe imported audio cleanup',
  "const removeImported=(id:string)=>{void deleteStoredAudio(id);setLibrary(current=>{",
  "const removeImported=(id:string)=>{void deleteStoredAudio(id).catch(error=>console.warn('[audio] local cleanup failed',error));setLibrary(current=>{"
 );
 code=replaceRequired(code,'cancel metadata waiter on stop',
  "if(media.readyState<1)await new Promise<void>((resolve,reject)=>{const loaded=()=>{cleanup();resolve()},failed=()=>{cleanup();reject(generation!==this.loadGeneration?new DOMException('Audio load cancelled','AbortError'):new Error('Unable to load audio'))},cleanup=()=>{media.removeEventListener('loadedmetadata',loaded);media.removeEventListener('error',failed)};media.addEventListener('loadedmetadata',loaded,{once:true});media.addEventListener('error',failed,{once:true});media.load()});",
  "if(media.readyState<1)await new Promise<void>((resolve,reject)=>{const loaded=()=>{cleanup();resolve()},failed=()=>{cleanup();reject(generation!==this.loadGeneration?new DOMException('Audio load cancelled','AbortError'):new Error('Unable to load audio'))},cancelled=()=>{cleanup();reject(new DOMException('Audio load cancelled','AbortError'))},cleanup=()=>{media.removeEventListener('loadedmetadata',loaded);media.removeEventListener('error',failed);media.removeEventListener('rhythmtap-cancel',cancelled)};media.addEventListener('loadedmetadata',loaded,{once:true});media.addEventListener('error',failed,{once:true});media.addEventListener('rhythmtap-cancel',cancelled,{once:true});media.load()});"
 );
 code=replaceRequired(code,'signal pending media cancellation',
  "if(this.media){this.media.pause();this.media.removeAttribute('src');",
  "if(this.media){this.media.dispatchEvent(new Event('rhythmtap-cancel'));this.media.pause();this.media.removeAttribute('src');"
 );
 code=replaceRequired(code,'itch safe service worker registration',
  "if('serviceWorker'in navigator)addEventListener('load',()=>{void navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',{scope:import.meta.env.BASE_URL})});",
  "if(import.meta.env.MODE!=='itch'&&'serviceWorker'in navigator)addEventListener('load',()=>{void navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',{scope:import.meta.env.BASE_URL}).catch(error=>console.warn('[sw] registration failed',error))});"
 );
 return code;
};

export function deepAuditFixesTransform():Plugin{
 return {name:'rhythtap-deep-audit-fixes-transform',enforce:'pre',transform(source,id){
  if(!id.replaceAll('\\\\','/').endsWith('/src/main.tsx'))return null;
  return{code:patchMain(source),map:null};
 }};
}
