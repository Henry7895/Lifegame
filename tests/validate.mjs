import games from "../games/all.js";
if(games.length!==50)throw new Error("Expected 50 games, got "+games.length);
const ids=new Set(games.map(g=>g.id)),slugs=new Set(games.map(g=>g.slug));
if(ids.size!==50||slugs.size!==50)throw new Error("Game ids/slugs must be unique");
for(const g of games){for(const key of ["id","slug","title","description","genre","mechanic","playersMin","playersMax","multiplayer","featured","difficulty","rating","playCount","gradient"]){if(g[key]===undefined)throw new Error("Missing "+key+" in "+g.slug)}} 
if(games.filter(g=>g.multiplayer).length<5)throw new Error("Expected multiplayer catalog");
console.log("LifeGame validation OK: 50 games");