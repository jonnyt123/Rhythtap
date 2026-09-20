import type {Plugin} from 'vite';

const SONGS=`,
 {id:'my-immortal',title:'My Immortal',artist:'Evanescence',bpm:76,color:'#8fb3ff',root:0,progression:[],melody:[],unlockLevel:2,duration:270.497,audioFile:'audio/my-immortal.mp3',previewFile:'audio/my-immortal.mp3',charts:beatCharts(76,232,270.497,4)},
 {id:'crazy-train',title:'Crazy Train',artist:'Ozzy Osbourne',bpm:136,color:'#ffbf3d',root:0,progression:[],melody:[],unlockLevel:2,duration:226.325,audioFile:'audio/crazy-train.mp3',previewFile:'audio/crazy-train.mp3',charts:beatCharts(136,325,226.325,1)},
 {id:'kill-you',title:'Kill You',artist:'Eminem',bpm:107.666,color:'#ff536d',root:0,progression:[],melody:[],unlockLevel:3,duration:264.411,audioFile:'audio/kill-you.mp3',previewFile:'audio/kill-you.mp3',charts:beatCharts(107.666,232,264.411,2)},
 {id:'kryptonite',title:'Kryptonite',artist:'3 Doors Down',bpm:99.384,color:'#63e2ff',root:0,progression:[],melody:[],unlockLevel:2,duration:234.292,audioFile:'audio/kryptonite.mp3',previewFile:'audio/kryptonite.mp3',charts:beatCharts(99.384,627,234.292,0)},
 {id:'through-fire-flames',title:'Through the Fire and Flames',artist:'DragonForce',bpm:198.8,color:'#ff6f2d',root:0,progression:[],melody:[],unlockLevel:5,duration:300.121,audioFile:'audio/through-fire-flames.mp3',previewFile:'audio/through-fire-flames.mp3',charts:beatCharts(198.8,1324,300.121,3)}`;

export function songPackTransform():Plugin{
 return {name:'rhythtap-song-pack-transform',enforce:'pre',transform(source,id){
  if(!id.replaceAll('\\','/').endsWith('/src/main.tsx'))return null;
  const marker='\n];\nconst IMPORTED_SONGS_KEY=';
  if(!source.includes(marker))throw new Error('[song-pack] Unable to locate base song catalog.');
  return {code:source.replace(marker,`${SONGS}\n];\nconst IMPORTED_SONGS_KEY=`),map:null};
 }};
}
