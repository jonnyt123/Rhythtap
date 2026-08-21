import {readdir} from 'node:fs/promises';

const files=await readdir('dist/audio',{recursive:true});
if(files.some(file=>file.endsWith('.b64')))throw new Error('Base64 audio chunks must not be included in the production build.');
