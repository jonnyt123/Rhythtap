import {buildCanonicalChart as buildVersioned,normalizeChartVersion} from '../supabase/functions/validate-match/chart-validator.ts';
import {buildCanonicalChart as buildV3} from '../supabase/functions/validate-match/validator-v3.ts';
import {buildCanonicalChart as buildV4} from '../supabase/functions/validate-match/validator-v4.ts';

Deno.test('missing chart version remains v3 for existing clients',()=>{if(normalizeChartVersion(undefined)!==3)throw new Error('missing chart version must default to v3');if(normalizeChartVersion(3)!==3)throw new Error('v3 must remain v3');if(normalizeChartVersion(4)!==4)throw new Error('v4 must opt in explicitly');if(normalizeChartVersion(5)!==5)throw new Error('v5 must opt in explicitly')});
Deno.test('versioned selector preserves legacy v3 beat chart exactly',()=>{const legacy=buildV3('crazy-train','HARD'),selected=buildVersioned('crazy-train','HARD',undefined,3);if(JSON.stringify(legacy)!==JSON.stringify(selected))throw new Error('v3 selector changed legacy canonical chart')});
Deno.test('versioned selector preserves v4 beat chart exactly',()=>{const legacy=buildV4('through-fire-flames','HARD'),selected=buildVersioned('through-fire-flames','HARD',undefined,4);if(JSON.stringify(legacy)!==JSON.stringify(selected))throw new Error('v4 selector changed existing canonical chart')});
