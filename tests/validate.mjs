import games from "../games/all.js";
if(games.length!==60)throw new Error("Expected 55 games, got "+games.length);
const ids=new Set(games.map(g=>g.id)),slugs=new Set(games.map(g=>g.slug));
if(ids.size!==60||slugs.size!==60)throw new Error("Game ids/slugs must be unique");
for(const g of games){for(const key of ["id","slug","title","description","genre","mechanic","playersMin","playersMax","multiplayer","featured","difficulty","rating","playCount","gradient"]){if(g[key]===undefined)throw new Error("Missing "+key+" in "+g.slug)}}
if(games.filter(g=>g.multiplayer).length<7)throw new Error("Expected multiplayer catalog");
if(!games.some(g=>g.slug==="beat-duel"&&g.mechanic==="rhythm"))throw new Error("Beat Duel missing");
if(!games.some(g=>g.slug==="snake-rush"&&g.mechanic==="snake"))throw new Error("Snake Rush missing");
if(!games.some(g=>g.slug==="2048-fusion"&&g.mechanic==="merge"))throw new Error("2048 Fusion missing");
console.log("LifeGame validation OK: "+games.length+" games.");