import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';

const tracks=[
 ['public/audio/down-with-the-sickness','public/audio/down-with-the-sickness.mp3'],
 ['public/audio/if-you-never-left','public/audio/if-you-never-left.mp3'],
 ['public/audio/fly-like-an-eagle-metal','public/audio/fly-like-an-eagle-metal.mp3']
];
const previews=[
 ['public/previews/sickness.b64','public/previews/sickness.mp3'],
 ['public/previews/never-left.b64','public/previews/never-left.mp3'],
 ['public/previews/fly-eagle.b64','public/previews/fly-eagle.mp3']
];

const decode=async input=>Buffer.from((await readFile(input,'utf8')).trim(),'base64');

for(const [folder,output] of tracks){
 const names=(await readdir(folder)).filter(file=>file.endsWith('.b64')).sort();
 const chunks=await Promise.all(names.map(file=>decode(join(folder,file))));
 await mkdir(dirname(output),{recursive:true});
 await writeFile(output,Buffer.concat(chunks));
}

for(const [input,output] of previews){
 await mkdir(dirname(output),{recursive:true});
 await writeFile(output,await decode(input));
}
