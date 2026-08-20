import {rm} from 'node:fs/promises';

const obsolete=[
 'dist/audio/down-with-the-sickness',
 'dist/audio/if-you-never-left',
 'dist/audio/fly-like-an-eagle-metal',
 'dist/previews/sickness.b64',
 'dist/previews/never-left.b64',
 'dist/previews/fly-eagle.b64'
];

await Promise.all(obsolete.map(path=>rm(path,{recursive:true,force:true})));
