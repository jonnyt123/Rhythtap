import assert from 'node:assert/strict';
import {buildCanonicalChart,validateAgainstChart,parseOnsetEvents,makeOnsetChart} from '../.validator-ci/validator.js';

const chart=buildCanonicalChart('voltage','EASY');
const events=[];
for(const note of chart.notes){
 events.push({kind:'PERFECT',noteId:note.id,lane:note.lane,atMs:Math.round(note.time)});
 if(note.duration)events.push({kind:'HOLD',noteId:note.id,lane:note.lane,atMs:Math.round(note.time+note.duration)});
}
events.sort((a,b)=>a.atMs-b.atMs||a.noteId-b.noteId||(a.kind==='HOLD'?1:-1));
const result=validateAgainstChart(events,chart);
assert.equal(result.noteCount,chart.notes.length);
assert.equal(result.perfect,chart.notes.length);
assert.equal(result.miss,0);
assert.ok(result.score>0);

const wrongLane=structuredClone(events);wrongLane[0].lane=(wrongLane[0].lane+1)%3;
assert.throws(()=>validateAgainstChart(wrongLane,chart),/Lane mismatch/);
const fakePerfect=structuredClone(events);const firstInitial=fakePerfect.find(event=>event.kind!=='HOLD');const firstNote=chart.notes.find(note=>note.id===firstInitial.noteId);firstInitial.atMs=Math.round(firstNote.time+100);fakePerfect.sort((a,b)=>a.atMs-b.atMs||a.noteId-b.noteId);assert.throws(()=>validateAgainstChart(fakePerfect,chart),/Timing does not match PERFECT/);
const missing=events.filter((_,index)=>index!==0);assert.throws(()=>validateAgainstChart(missing,chart),/Incomplete chart result/);
const duplicate=[...events,events[0]].sort((a,b)=>a.atMs-b.atMs||a.noteId-b.noteId);assert.throws(()=>validateAgainstChart(duplicate,chart),/Duplicate judgement/);
const nonHold=chart.notes.find(note=>!note.duration);const badHold=[...events,{kind:'HOLD',noteId:nonHold.id,lane:nonHold.lane,atMs:Math.round(nonHold.time+500)}].sort((a,b)=>a.atMs-b.atMs||a.noteId-b.noteId);assert.throws(()=>validateAgainstChart(badHold,chart),/non-hold/);
const actualHold=chart.notes.find(note=>note.duration);if(actualHold){const early=structuredClone(events);const h=early.find(event=>event.kind==='HOLD'&&event.noteId===actualHold.id);h.atMs=Math.round(actualHold.time+(actualHold.duration??0)-300);early.sort((a,b)=>a.atMs-b.atMs||a.noteId-b.noteId);assert.throws(()=>validateAgainstChart(early,chart),/too early/)}

const holdChart={songId:'test',difficulty:'NORMAL',notes:[{id:0,time:1000,lane:1,duration:800}],endMs:3200};
const holdGood=[{kind:'PERFECT',noteId:0,lane:1,atMs:1000},{kind:'HOLD',noteId:0,lane:1,atMs:1800}];
assert.equal(validateAgainstChart(holdGood,holdChart).holdCount,1);
const holdEarly=structuredClone(holdGood);holdEarly[1].atMs=1500;assert.throws(()=>validateAgainstChart(holdEarly,holdChart),/too early/);

const source='export type OnsetEvent=readonly [time:number,lane:number,strength:number];\nexport const sicknessEvents:readonly OnsetEvent[]=[[1000,0,100],[1500,1,80],[2100,2,95]];';
const parsed=parseOnsetEvents(source,'sicknessEvents');assert.equal(parsed.length,3);assert.ok(makeOnsetChart(parsed,'NORMAL').length>=3);
console.log(JSON.stringify({noteCount:result.noteCount,holdCount:result.holdCount,score:result.score,accuracy:result.accuracy,maxCombo:result.maxCombo}));
