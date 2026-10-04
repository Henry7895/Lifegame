import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import games from "../games/all.js";

const root=process.cwd();
const index=fs.readFileSync(path.join(root,"index.html"),"utf8");
if(!index.includes("./styles.css?v="))throw new Error("index.html missing versioned stylesheet");
if(!index.includes("./manifest.webmanifest?v="))throw new Error("index.html missing versioned manifest");
if(!index.includes("import('./app.js?v=7dab30c')"))throw new Error("index.html missing versioned app bootstrap");

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
for(const base of roots){
  const stat=fs.statSync(base);
  if(stat.isFile())files.push(base);
  else{
    const walk=(dir)=>{
      for(const name of fs.readdirSync(dir)){
        const file=path.join(dir,name),current=fs.statSync(file);
        if(current.isDirectory())walk(file);
        else if(file.endsWith(".js"))files.push(file);
      }
    };
    walk(base);
  }
}
for(const file of files)execFileSync(process.execPath,["--check",file],{stdio:"inherit"});

const allSource=fs.readFileSync(path.join(root,"games","all.js"),"utf8");
const importNames=[...allSource.matchAll(/from ["']\.\/([^"']+\.js)["']/g)].map(match=>match[1]);
for(const relative of importNames){
  if(!fs.existsSync(path.join(root,"games",relative)))throw new Error("Missing game module "+relative);
}

console.log("LifeGame validation OK: "+games.length+" games, "+files.length+" JavaScript files and GitHub Pages bootstrap verified.");
