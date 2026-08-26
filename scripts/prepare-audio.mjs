import {access} from 'node:fs/promises';

const required=[
 'public/audio/down-with-the-sickness.mp3',
 'public/audio/if-you-never-left.mp3',
 'public/audio/fly-like-an-eagle-metal.mp3',
 'public/audio/my-immortal.mp3',
 'public/audio/crazy-train.mp3',
 'public/audio/kill-you.mp3',
 'public/audio/kryptonite.mp3',
 'public/audio/through-fire-flames.mp3',
 'public/previews/sickness.mp3',
 'public/previews/never-left.mp3',
 'public/previews/fly-eagle.mp3'
];

await Promise.all(required.map(path=>access(path)));
