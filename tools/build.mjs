import fs from 'node:fs';import path from 'node:path';
const root=process.cwd(),out=path.join(root,'dist');fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const f of ['index.html','app.js','styles.css','sw.js','manifest.webmanifest'])fs.copyFileSync(path.join(root,f),path.join(out,f));
for(const d of ['platform','games'])fs.cpSync(path.join(root,d),path.join(out,d),{recursive:true});console.log('LifeGame build complete');