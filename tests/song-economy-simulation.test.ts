import {assert,assertEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {SONG_STORE_CATALOG,coinsForXpAward} from '../src/song-economy.ts';

const paid=SONG_STORE_CATALOG.filter(entry=>!entry.starter);

type Simulation={owned:number;coins:number;unlockAt:number[]};

const simulate=(xpAwards:number[],clears:number):Simulation=>{
 let coins=0,owned=0;
 const unlockAt:number[]=[];
 for(let clear=1;clear<=clears;clear++){
  coins+=coinsForXpAward(xpAwards[(clear-1)%xpAwards.length]);
  while(owned<paid.length&&coins>=paid[owned].price){
   coins-=paid[owned].price;
   unlockAt.push(clear);
   owned++;
  }
 }
 return{owned,coins,unlockAt};
};

const players={
 casual:[375,375,450,375,525,375,450,375,600,375],
 regular:[525,600,675,600,750,675,600,825,675,750],
 skilled:[825,975,1050,1125,1200,975,1050,1275,1125,1200],
 expert:[1275,1425,1500,1350,1500,1425,1500,1500,1350,1500],
} as const;

Deno.test('50 to 100 clear simulations preserve meaningful progression bands',()=>{
 const casual50=simulate([...players.casual],50),casual100=simulate([...players.casual],100);
 const regular50=simulate([...players.regular],50),regular100=simulate([...players.regular],100);
 const skilled50=simulate([...players.skilled],50),expert50=simulate([...players.expert],50);

 assert(casual50.owned>=4,'casual player should own at least four paid songs after 50 clears');
 assert(casual100.owned>=6,'casual player should own most of the paid catalog after 100 clears');
 assert(regular50.owned>=5,'regular player should own at least five paid songs after 50 clears');
 assertEquals(regular100.owned,paid.length,'regular player should finish the paid catalog inside 100 clears');
 assertEquals(skilled50.owned,paid.length,'skilled player should finish the current catalog inside 50 clears');
 assertEquals(expert50.owned,paid.length,'expert player should finish the current catalog inside 50 clears');

 assert((casual50.unlockAt[0]??Infinity)<=8,'the first purchase should arrive quickly even for casual clears');
 assert((expert50.unlockAt.at(-1)??0)>=30,'the whole catalog must not collapse into a trivial sub-30-clear unlock');
});

Deno.test('rebalanced catalog targets a 3,400 coin paid progression',()=>{
 assertEquals(paid.map(entry=>entry.price),[200,300,350,450,550,650,900]);
 assertEquals(paid.reduce((sum,entry)=>sum+entry.price,0),3400);
 const regular=simulate([...players.regular],100);
 const skilled=simulate([...players.skilled],100);
 assert((regular.unlockAt.at(-1)??Infinity)<=80,'regular progression should complete around the 50–100 clear window');
 assert((skilled.unlockAt.at(-1)??Infinity)<=50,'skilled progression should complete faster without being instant');
});
