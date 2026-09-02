import assert from 'node:assert/strict';
const clamp=value=>Math.max(-300,Math.min(300,Math.round(value)));
const effective=(audio,offset,chart=0)=>audio+offset+chart;
const judge=distance=>distance<=55?'PERFECT':distance<=110?'GREAT':distance<=220?'GOOD':'MISS';
assert.equal(clamp(900),300);assert.equal(clamp(-900),-300);assert.equal(clamp(42.4),42);
assert.equal(effective(1000,80,-20),1060);assert.equal(effective(1000,-100,25),925);
assert.equal(judge(0),'PERFECT');assert.equal(judge(55),'PERFECT');assert.equal(judge(56),'GREAT');assert.equal(judge(110),'GREAT');assert.equal(judge(111),'GOOD');assert.equal(judge(220),'GOOD');assert.equal(judge(221),'MISS');
console.log('gameplay quality timing checks passed');
