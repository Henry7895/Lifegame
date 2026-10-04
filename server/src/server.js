import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {WebSocketServer} from "ws";

const PORT=Number(process.env.PORT||8787);
const DATA_DIR=path.join(process.cwd(),"data");
const SCORE_FILE=path.join(DATA_DIR,"leaderboards.json");
fs.mkdirSync(DATA_DIR,{recursive:true});
let scores={};
try{scores=JSON.parse(fs.readFileSync(SCORE_FILE,"utf8"))||{}}catch{scores={}};
const rooms=new Map();
const clients=new Map();
const limits=new Map();

function persistScores(){fs.writeFileSync(SCORE_FILE,JSON.stringify(scores,null,2))}
function cleanName(v){return String(v||"Player").replace(/[<>]/g,"").trim().slice(0,24)||"Player"}
function okRate(ip){const now=Date.now(),a=limits.get(ip)||[];const next=a.filter(t=>now-t<60000);if(next.length>=30){limits.set(ip,next);return false}next.push(now);limits.set(ip,next);return true}
function body(req){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>20000)req.destroy()});req.on("end",()=>{try{resolve(JSON.parse(raw||"{}"))}catch{resolve(null)}});req.on("error",reject)})}
function sendJson(res,status,data){res.writeHead(status,{"content-type":"application/json; charset=utf-8","access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"content-type"});res.end(JSON.stringify(data))}
function publicRooms(){return [...rooms.values()].filter(r=>!r.private&&r.status==="WAITING").map(snapshot)}
function snapshot(r){return{code:r.code,gameSlug:r.gameSlug,maxPlayers:r.maxPlayers,private:r.private,locked:r.locked,status:r.status,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,ready:p.ready,host:p.host}))}}
function broadcastRoom(r,type,p={}){for(const x of r.players.values())send(x.ws,type,p)}
function presence(){return[...clients.values()].map(c=>({id:c.id,name:c.name,room:c.room||null,gameSlug:c.room&&rooms.get(c.room)?.gameSlug||null}))}
function broadcastPresence(){for(const c of clients.values())send(c.ws,"presence",{players:presence(),count:clients.size})}
function send(ws,type,p={}){if(ws.readyState===1)ws.send(JSON.stringify({type,...p}))}

const server=http.createServer(async(req,res)=>{
 if(req.method==="OPTIONS")return sendJson(res,204,{});
 const url=new URL(req.url||"/","http://localhost");
 if(req.method==="GET"&&url.pathname==="/"){return sendJson(res,200,{service:"LifeGame multiplayer",status:"ok",rooms:rooms.size,online:clients.size})}
 if(req.method==="GET"&&url.pathname==="/api/online"){return sendJson(res,200,{players:presence(),count:clients.size})}
 if(req.method==="GET"&&url.pathname==="/api/rooms"){return sendJson(res,200,{rooms:publicRooms()})}
 if(req.method==="GET"&&url.pathname==="/api/leaderboards"){
   const game=url.searchParams.get("game")||"global";const rows=(scores[game]||[]).slice(0,100);return sendJson(res,200,{game,rows});
 }
 if(req.method==="POST"&&url.pathname==="/api/scores"){
   const ip=req.socket.remoteAddress||"unknown";if(!okRate(ip))return sendJson(res,429,{error:"rate_limited"});
   const b=await body(req);if(!b||typeof b.gameSlug!=="string"||!b.gameSlug||typeof b.name!=="string"||!Number.isFinite(Number(b.score)))return sendJson(res,400,{error:"invalid_score"});
   const game=b.gameSlug.replace(/[^a-z0-9-]/gi,"").slice(0,80);const row={name:cleanName(b.name),score:Math.max(0,Math.min(999999999,Math.round(Number(b.score)))),duration:Math.max(0,Math.min(86400000,Number(b.duration)||0)),at:new Date().toISOString()};
   scores[game]=[...(scores[game]||[]),row].sort((a,z)=>z.score-a.score).slice(0,100);persistScores();return sendJson(res,201,{ok:true,row});
 }
 sendJson(res,404,{error:"not_found"});
});

const wss=new WebSocketServer({server,maxPayload:65536});
wss.on("connection",ws=>{
 const client={id:crypto.randomUUID(),name:"Player",room:null,ws};clients.set(client.id,client);broadcastPresence();
 ws.on("message",raw=>{
   if(raw.length>65536)return send(ws,"error",{message:"Message too large"});
   let m;try{m=JSON.parse(raw.toString())}catch{return send(ws,"error",{message:"Invalid JSON"})}
   const type=String(m.type||"");
   if(type==="hello"){client.name=cleanName(m.name);broadcastPresence();return}
   if(type==="create"){
     let code;do{code=crypto.randomBytes(3).toString("hex").toUpperCase()}while(rooms.has(code));
     const r={code,gameSlug:String(m.gameSlug||"").replace(/[^a-z0-9-]/gi,"").slice(0,80),maxPlayers:Math.min(16,Math.max(1,Number(m.maxPlayers||8))),private:Boolean(m.private),locked:false,status:"WAITING",players:new Map()};
     client.room=code;client.name=cleanName(m.name);r.players.set(client.id,{id:client.id,name:client.name,ready:true,host:true,ws:client.ws});rooms.set(code,r);send(ws,"room",{room:snapshot(r)});broadcastPresence();return;
   }
   if(type==="join"){
     const r=rooms.get(String(m.code||"").toUpperCase());if(!r)return send(ws,"error",{message:"Room introuvable"});if(r.locked)return send(ws,"error",{message:"Room verrouillée"});if(r.status!=="WAITING")return send(ws,"error",{message:"Partie déjà commencée"});if(r.players.size>=r.maxPlayers)return send(ws,"error",{message:"Room pleine"});
     client.room=r.code;client.name=cleanName(m.name);r.players.set(client.id,{id:client.id,name:client.name,ready:false,host:false,ws});broadcastRoom(r,"room",{room:snapshot(r)});broadcastPresence();return;
   }
   if(!client.room||!rooms.has(client.room))return send(ws,"error",{message:"Aucune room active"});
   const r=rooms.get(client.room),me=r.players.get(client.id);
   if(type==="ready"){me.ready=!me.ready;broadcastRoom(r,"room",{room:snapshot(r)})}
   else if(type==="lock"){if(!me.host)return send(ws,"error",{message:"Hôte requis"});r.locked=Boolean(m.locked);broadcastRoom(r,"room",{room:snapshot(r)})}
   else if(type==="kick"){if(!me.host)return send(ws,"error",{message:"Hôte requis"});const id=String(m.playerId||"");const target=r.players.get(id);if(!target||id===client.id)return;send(target.ws,"kicked",{reason:"Retiré par l'hôte"});target.ws.close();r.players.delete(id);broadcastRoom(r,"room",{room:snapshot(r)});broadcastPresence()}
   else if(type==="start"){if(!me.host)return send(ws,"error",{message:"Hôte requis"});if(r.locked&&r.players.size===0)return; if(![...r.players.values()].every(p=>p.ready))return send(ws,"error",{message:"Tous les joueurs doivent être prêts"});r.status="PLAYING";broadcastRoom(r,"start",{room:snapshot(r)})}
   else if(type==="input"){broadcastRoom(r,"input",{from:client.id,input:m.input})}
   else if(type==="chat"){const msg=String(m.text||"").trim().slice(0,300);if(msg)broadcastRoom(r,"chat",{from:client.id,name:client.name,text:msg})}
   else if(type==="leave"){disconnectClient(client)}
   else if(type==="ping")send(ws,"pong",{t:Date.now()});
 });
 ws.on("close",()=>disconnectClient(client));
 function disconnectClient(c){
   if(c.room&&rooms.has(c.room)){const r=rooms.get(c.room);r.players.delete(c.id);if(!r.players.size)rooms.delete(r.code);else if(meHost(c,r)){const next=r.players.values().next().value;next.host=true}broadcastRoom(r,"room",{room:snapshot(r)})}c.room=null;clients.delete(c.id);broadcastPresence();
 }
});
function meHost(c,r){const p=r.players.get(c.id);return Boolean(p?.host)}
server.listen(PORT,()=>console.log("LifeGame multiplayer server listening on "+PORT));
