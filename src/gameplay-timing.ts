export type TimingJudge='PERFECT'|'GREAT'|'GOOD'|'MISS';
export const clampCalibration=(value:number)=>Math.max(-300,Math.min(300,Math.round(value)));
export const effectiveHitTime=(audioTimeMs:number,calibrationMs:number,chartOffsetMs=0)=>audioTimeMs+calibrationMs+chartOffsetMs;
export const judgeDistance=(distanceMs:number):TimingJudge=>distanceMs<=55?'PERFECT':distanceMs<=110?'GREAT':distanceMs<=220?'GOOD':'MISS';
export const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);if(!sorted.length)return 0;const middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2};
export const suggestedCalibration=(samples:number[])=>clampCalibration(-median(samples));
