import {assert} from 'jsr:@std/assert';

const theme=await Deno.readTextFile('src/death-metal-theme.css');
const transform=await Deno.readTextFile('scripts/metal-menu-transform.ts');

Deno.test('death metal theme is loaded after the metal menu skin',()=>{
  assert(transform.includes("import './metal-menu.css';\\nimport './death-metal-theme.css';"));
});

Deno.test('death metal theme replaces neon core palette and keeps readable lane separation',()=>{
  assert(theme.includes('--metal-blood:#b51f25'));
  assert(theme.includes('--metal-bone:#e7e1d6'));
  assert(theme.includes('.lane:nth-child(1){--lane:#d04a45!important}'));
  assert(theme.includes('.lane:nth-child(2){--lane:#bd762e!important}'));
  assert(theme.includes('.lane:nth-child(3){--lane:#aab0b6!important}'));
  assert(!theme.includes('#29f2ff'));
  assert(!theme.includes('#ff3dad'));
});

Deno.test('theme remains presentation-only',()=>{
  assert(!theme.includes('TIMING'));
  assert(!theme.includes('perfect:'));
  assert(!theme.includes('great:'));
  assert(!theme.includes('good:'));
});
