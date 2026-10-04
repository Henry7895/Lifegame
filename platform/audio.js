const KEY='lifegame:sound';
let ctx=null;
let master=null;

function preference(){
  try{return localStorage.getItem(KEY)!=='off'}catch{return true}
}
export function enabled(){return preference()}
export function setEnabled(value){try{localStorage.setItem(KEY,value?'on':'off')}catch{}}
export function resume(){
  if(!preference())return;
  try{
    if(!ctx){ctx=new AudioContext();master=ctx.createGain();master.gain.value=.055;master.connect(ctx.destination)}
    if(ctx.state==='suspended')ctx.resume();
  }catch{}
}
function tone(freq,duration=.08,type='sine',gain=.35,slide=0){
  if(!preference())return;
  try{
    resume();
    if(!ctx||!master)return;
    const now=ctx.currentTime;
    const osc=ctx.createOscillator(),amp=ctx.createGain();
    osc.type=type;
    osc.frequency.setValueAtTime(Math.max(30,freq),now);
    if(slide)osc.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),now+duration);
    amp.gain.setValueAtTime(.0001,now);
    amp.gain.exponentialRampToValueAtTime(Math.max(.0001,gain),now+.008);
    amp.gain.exponentialRampToValueAtTime(.0001,now+duration);
    osc.connect(amp).connect(master);
    osc.start(now);
    osc.stop(now+duration+.015);
  }catch{}
}
export function click(){tone(620,.045,'square',.22,110)}
export function hit(){tone(760,.07,'triangle',.35,180)}
export function good(){tone(520,.09,'sine',.3,260);setTimeout(()=>tone(780,.11,'sine',.25,180),45)}
export function miss(){tone(180,.12,'sawtooth',.28,-90)}
export function tick(){tone(430,.055,'sine',.18,40)}
export function note(lane=0){const freqs=[262,330,392,523];tone(freqs[lane%4],.11,'square',.22,80)}
export function win(){[523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,.18,'triangle',.34,80),i*75))}
export function lose(){tone(260,.22,'sawtooth',.3,-120);setTimeout(()=>tone(150,.28,'sawtooth',.24,-50),110)}
export function score(){tone(900,.055,'sine',.18,70)}
