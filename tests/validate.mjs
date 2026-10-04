import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import games from "../games/all.js";

if(games.length!==60)throw new Error("Expected 60 games, got "+games.length);
const ids=new Set(games.map(g=>g.id)),slugs=new Set(games.map(g=>g.slug));
if(ids.size!==60||slugs.size!==60)throw new Error("Game ids/slugs must be unique");
for(const g of games){
  for(const key of ["id","slug","title","description","genre","mechanic","playersMin","playersMax","multiplayer","featured","difficulty","rating","playCount","gradient"]){
    if(g[key]===undefined)throw new Error("Missing "+key+" in "+g.slug);
  }
}
if(games.filter(g=>g.multiplayer).length<7)throw new Error("Expected multiplayer catalog");
if(!games.some(g=>g.slug==="beat-duel"&&g.mechanic==="rhythm"))throw new Error("Beat Duel missing");
if(!games.some(g=>g.slug==="snake-rush"&&g.mechanic==="snake"))throw new Error("Snake Rush missing");
if(!games.some(g=>g.slug==="2048-fusion"&&g.mechanic==="merge"))throw new Error("2048 Fusion missing");

const roots=[path.resolve("app.js"),path.resolve("platform"),path.resolve("games")];
const files=[];
for(const root of roots){
  const stat=fs.statSync(root);
  if(stat.isFile())files.push(root);
  else{
    const walk=(dir)=>{
      for(const name of fs.readdirSync(dir)){
        const p=path.join(dir,name),s=fs.statSync(p);
        if(s.isDirectory())walk(p);
        else if(p.endsWith(".js"))files.push(p);
      }
    };
    walk(root);
  }
}
for(const file of files)execFileSync(process.execPath,["--check",file],{stdio:"inherit"});
console.log("LifeGame validation OK: "+games.length+" games and "+files.length+" JavaScript files parsed.");
