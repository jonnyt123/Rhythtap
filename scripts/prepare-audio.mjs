import {access} from 'node:fs/promises';

const required=[
 'public/audio/down-with-the-sickness.mp3',
 'public/audio/if-you-never-left.mp3',
 'public/audio/fly-like-an-eagle-metal.mp3',
 'public/previews/sickness.mp3',
 'public/previews/never-left.mp3',
 'public/previews/fly-eagle.mp3'
];

await Promise.all(required.map(path=>access(path)));
