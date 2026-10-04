const KEY='lifegame:rooms',ME=crypto.randomUUID();
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}};
const write=v=>{localStorage.setItem(KEY,JSON.stringify(v.filter(r=>r.status!=='CLOSED').slice(-40)));dispatchEvent(new Event('lifegame:rooms'))};
const makeCode=()=>[...crypto.getRandomValues(new Uint8Array(5))].map(n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');
export const current=()=>localStorage.getItem('lifegame:current-room')||'';
export const get=c=>read().find(r=>r.code===String(c||'').toUpperCase());
export const list=()=>read().filter(r=>!r.private&&r.status==='WAITING');
export function create(game,name,maxPlayers=8,privateRoom=false){const r={code:makeCode(),gameSlug:game,maxPlayers,private:privateRoom,locked:false,status:'WAITING',createdAt:Date.now(),hostId:ME,players:[{id:ME,name:String(name||'Player').slice(0,24),ready:true,host:true}]};write([...read(),r]);localStorage.setItem('lifegame:current-room',r.code);return r}
export function join(c,name){const l=read(),r=l.find(x=>x.code===String(c||'').toUpperCase());if(!r||r.status!=='WAITING'||r.locked||r.players.length>=r.maxPlayers)return null;if(!r.players.some(p=>p.id===ME))r.players.push({id:ME,name:String(name||'Player').slice(0,24),ready:false});write(l);localStorage.setItem('lifegame:current-room',r.code);return r}
export function ready(c){const l=read(),r=l.find(x=>x.code===String(c||'').toUpperCase());if(!r)return null;const p=r.players.find(x=>x.id===ME);if(p)p.ready=!p.ready;write(l);return r}
export function start(c){const l=read(),r=l.find(x=>x.code===String(c||'').toUpperCase());if(!r||r.hostId!==ME||r.locked||!r.players.length||!r.players.every(p=>p.ready))return null;r.status='PLAYING';write(l);return r}
export function lock(c,value){const l=read(),r=l.find(x=>x.code===String(c||'').toUpperCase());if(!r||r.hostId!==ME)return null;r.locked=Boolean(value);write(l);return r}
export function kick(c,id){const l=read(),r=l.find(x=>x.code===String(c||'').toUpperCase());if(!r||r.hostId!==ME||id===ME)return null;r.players=r.players.filter(p=>p.id!==id);write(l);return r}
export function leave(c){const l=read(),r=l.find(x=>x.code===String(c||'').toUpperCase());if(!r)return;r.players=r.players.filter(p=>p.id!==ME);if(!r.players.length)r.status='CLOSED';else if(r.hostId===ME){r.hostId=r.players[0].id;r.players[0].host=true}write(l);localStorage.removeItem('lifegame:current-room')}
export function explanation(){return 'Mode local : rooms réelles entre onglets du même navigateur. Pour plusieurs navigateurs, configure le serveur WebSocket LifeGame.'}