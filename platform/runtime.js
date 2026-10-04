import * as sound from './audio.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const rand=(min,max)=>Math.random()*(max-min)+min;

export function play(host,game,done){
  host.innerHTML='';
  const wrap=document.createElement('div');
  wrap.className='game-stage';
  const tools=document.createElement('div');
  tools.className='runtime-tools';
  tools.innerHTML='<button data-pause>⏸ Pause</button><button data-fullscreen>⛶ Plein écran</button><button data-mute></button>';
  const canvas=document.createElement('canvas');
  canvas.width=1280;
  canvas.height=720;
  canvas.tabIndex=0;
  canvas.setAttribute('aria-label','Zone de jeu');
  wrap.append(tools,canvas);
  host.append(wrap);

  const c=canvas.getContext('2d',{alpha:false});
  const keys=new Set();
  const state={};
  let raf=0,last=performance.now(),start=performance.now(),score=0,ended=false,paused=false,muted=!sound.enabled();
  let particles=[];
  let submitted=false;

  const palette=Array.isArray(game.gradient)&&game.gradient.length>=2?game.gradient:['#7C5CFF','#00D4FF'];

  function updateMuteButton(){
    tools.querySelector('[data-mute]').textContent=muted?'🔇 Sons coupés':'🔊 Sons';
  }
  updateMuteButton();

  function text(value,x,y,size=24,alpha=1,weight=700){
    c.fillStyle='rgba(255,255,255,'+alpha+')';
    c.font=weight+' '+size+'px Inter,system-ui,Arial,sans-serif';
    c.fillText(value,x,y);
  }
  function rect(x,y,w,h,color,r=14){
    c.fillStyle=color;
    c.beginPath();
    if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);
    c.fill();
  }
  function strokeRect(x,y,w,h,color,r=14,line=2){
    c.strokeStyle=color;
    c.lineWidth=line;
    c.beginPath();
    if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h);
    c.stroke();
  }
  function circle(x,y,r,color){
    c.fillStyle=color;
    c.beginPath();
    c.arc(x,y,r,0,Math.PI*2);
    c.fill();
  }
  function glowCircle(x,y,r,color){
    c.save();
    c.shadowColor=color;
    c.shadowBlur=r*.9;
    circle(x,y,r,color);
    c.restore();
  }
  function emit(x,y,color,count=8,power=120){
    for(let i=0;i<count;i++){
      const a=Math.random()*Math.PI*2,v=rand(power*.35,power);
      particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(.35,.8),max:.8,color,size:rand(2,6)});
    }
  }
  function drawParticles(dt){
    particles=particles.filter(p=>p.life>0);
    for(const p of particles){
      p.life-=dt;
      p.x+=p.vx*dt;
      p.y+=p.vy*dt;
      p.vx*=.985;
      p.vy=p.vy*.985+70*dt;
      c.globalAlpha=Math.max(0,p.life/p.max);
      circle(p.x,p.y,p.size,p.color);
    }
    c.globalAlpha=1;
  }
  function background(){
    const g=c.createLinearGradient(0,0,1280,720);
    g.addColorStop(0,palette[0]);
    g.addColorStop(1,palette[1]);
    c.fillStyle=g;
    c.fillRect(0,0,1280,720);
    const glow=c.createRadialGradient(300,150,20,300,150,480);
    glow.addColorStop(0,'rgba(255,255,255,.10)');
    glow.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=glow;
    c.fillRect(0,0,1280,720);
    c.fillStyle='rgba(5,8,15,.72)';
    c.fillRect(0,0,1280,720);
    for(let i=0;i<26;i++){
      const x=(i*173+90)%1280,y=(i*97+60)%620;
      circle(x,y,(i%3)+1,'rgba(255,255,255,.13)');
    }
  }
  function hud(instruction){
    text(game.title,28,42,28,1,800);
    text('Score '+Math.round(score),1040,42,21,.86,800);
    if(instruction)text(instruction,28,684,16,.72,600);
    if(paused){
      rect(445,290,390,120,'rgba(8,12,22,.94)',24);
      strokeRect(445,290,390,120,'rgba(255,255,255,.10)',24,2);
      text('PAUSE',588,340,34,1,800);
      text('Clique sur Reprendre pour continuer',476,376,16,.65,500);
    }
  }

  function sfx(name,...args){
    if(muted)return;
    sound[name]?.(...args);
  }

  function finish(win,message){
    if(ended)return;
    ended=true;
    cancelAnimationFrame(raf);
    if(win){emit(640,330,palette[1],45,300);sfx('win')}else sfx('lose');
    if(!submitted){
      submitted=true;
      done({score:Math.max(0,Math.round(score)),won:win,duration:Math.max(0,performance.now()-start)});
    }

    const overlay=document.createElement('div');
    overlay.className='game-end';
    overlay.innerHTML=`
      <div class="game-end-card">
        <span class="game-result-icon">${win?'🏆':'💥'}</span>
        <small>${win?'PARTIE TERMINÉE':'ESSAI TERMINÉ'}</small>
        <strong>${win?'Victoire !':'Perdu !'}</strong>
        <p>${message}</p>
        <b>${Math.round(score).toLocaleString('fr-FR')} points</b>
        <div class="game-end-actions">
          <button class="btn primary" id="retry">↻ Rejouer</button>
          <button class="btn ghost" id="back">← Quitter</button>
        </div>
      </div>`;
    wrap.append(overlay);
    overlay.querySelector('#retry').onclick=resetGame;
    overlay.querySelector('#back').onclick=()=>location.hash='game/'+encodeURIComponent(game.slug);
  }

  function init(){
    submitted=false;
    score=0;
    ended=false;
    paused=false;
    particles=[];
    Object.keys(state).forEach(k=>delete state[k]);
    start=performance.now();
    last=start;

    switch(game.mechanic){
      case'reaction':
        state.phase='wait';state.next=start+rand(900,1800);state.round=0;break;
      case'target':
        state.targets=Array.from({length:18},()=>({x:rand(110,1170),y:rand(150,610),r:rand(24,38),vx:rand(-35,35),vy:rand(-25,25),hit:false}));
        break;
      case'dodge':
      case'collect':
        state.p={x:640,y:560};state.items=[];state.next=0;state.end=start+45000;state.good=game.mechanic==='collect';break;
      case'runner':
        state.p={x:150,y:555,vy:0,grounded:true};state.obs=[];state.next=start+500;state.end=start+45000;break;
      case'stack':
        state.blocks=[{x:420,w:440}];state.x=560;state.dir=1;break;
      case'memory':
        state.cards=[0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7].sort(()=>Math.random()-.5).map((v,i)=>({v,i,open:false,done:false}));
        state.sel=null;state.lockUntil=0;state.openPair=null;break;
      case'maze':
        state.maze=makeMaze(21,13);state.x=0;state.y=0;break;
      case'paddle':
        state.ball={x:640,y:360,vx:330,vy:230};state.px=640;state.ai=640;state.lives=3;break;
      case'typing':
        state.words=['pixel','rocket','shadow','portal','galaxy','forest','legend','speed','combo','neon','chaos','rhythm'];state.word=state.words[Math.floor(rand(0,state.words.length))];state.input='';state.count=0;state.end=start+45000;break;
      case'rhythm':
        if(game.slug==='beat-duel'){
          state.notes=Array.from({length:32},(_,i)=>({lane:i%4,time:start+1100+i*520,hit:false,miss:false}));
          state.nextNote=0;state.hitNotes=0;state.misses=0;state.combo=0;
        }else{state.beat=start+900;state.n=0;}
        break;
      case'fishing':
        state.px=160;state.dir=1;state.zone=rand(250,900);state.hits=0;state.end=start+35000;break;
      case'survival':
        state.p={x:640,y:360};state.en=[];state.next=start;state.end=start+60000;break;
      case'lanes':
        state.lane=1;state.obs=[];state.next=start+500;state.passed=0;break;
      case'penalty':
        state.shots=0;state.targets=Array.from({length:5},()=>({x:rand(520,760),y:rand(210,510),r:52}));break;
      case'defense':
        state.hp=100;state.en=[];state.next=start+500;break;
      case'puzzle':
        state.pz=[0,1,2,3,4,5,6,7,8].sort(()=>Math.random()-.5);state.sel=null;state.moves=0;break;
      case'snake':
        state.gridW=24;state.gridH=16;state.snake=[{x:12,y:8},{x:11,y:8},{x:10,y:8}];state.sdir={x:1,y:0};state.snext={x:1,y:0};state.food=snakeFood();state.acc=0;state.step=.09;state.end=start+90000;break;
      case'merge':
        state.mg=Array.from({length:4},()=>Array(4).fill(0));state.moves=0;state.end=start+90000;addTile();addTile();break;
      case'flappy':
        state.f={x:220,y:360,vy:0};state.pipes=[];state.next=0;state.passed=0;state.end=start+60000;break;
    }
  }

  function makeMaze(w,h){
    const cells=Array.from({length:h},()=>Array(w).fill(0));
    const stack=[[0,0]];
    cells[0][0]=1;
    while(stack.length){
      const [x,y]=stack[stack.length-1];
      const choices=[];
      for(const [dx,dy] of [[2,0],[-2,0],[0,2],[0,-2]]){
        const nx=x+dx,ny=y+dy;
        if(nx>=0&&ny>=0&&nx<w&&ny<h&&!cells[ny][nx])choices.push([nx,ny,dx,dy]);
      }
      if(!choices.length){stack.pop();continue}
      const [nx,ny,dx,dy]=choices[Math.floor(Math.random()*choices.length)];
      cells[y+dy/2][x+dx/2]=1;
      cells[ny][nx]=1;
      stack.push([nx,ny]);
    }
    return{w,h,cells};
  }

  function movePlayer(speed,dt){
    const dx=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0);
    const dy=(keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0);
    state.p.x=clamp(state.p.x+dx*speed*dt,40,1240);
    state.p.y=clamp(state.p.y+dy*speed*dt,90,650);
  }

  function update(t){
    const dt=Math.min(.034,(t-last)/1000);
    last=t;
    if(paused)return;

    switch(game.mechanic){
      case'reaction':
        if(state.phase==='wait'&&t>=state.next){state.phase='go';state.go=t;state.tx=rand(140,1140);state.ty=rand(160,600);sfx('tick')}
        break;

      case'target':
        for(const target of state.targets){
          if(target.hit)continue;
          target.x+=target.vx*dt;target.y+=target.vy*dt;
          if(target.x<80||target.x>1200)target.vx*=-1;
          if(target.y<120||target.y>650)target.vy*=-1;
        }
        if(state.targets.every(x=>x.hit))finish(true,'Toutes les cibles ont été touchées.');
        break;

      case'dodge':
      case'collect':
        movePlayer(360,dt);
        if(t>state.next){state.next=t+rand(220,560);state.items.push({x:rand(60,1220),y:-30,r:rand(14,25),vy:rand(190,350)})}
        for(const item of state.items){
          item.y+=item.vy*dt;
          if(Math.hypot(item.x-state.p.x,item.y-state.p.y)<32){
            item.hit=true;
            if(state.good){score+=80;emit(item.x,item.y,'#FFC857',10,160);sfx('good')}
            else{emit(item.x,item.y,'#FF4D67',12,180);sfx('miss');return finish(false,'Tu as touché une zone brûlante.')}
          }
        }
        state.items=state.items.filter(x=>!x.hit&&x.y<760);
        score+=dt*(state.good?7:10);
        if(t>state.end)finish(true,state.good?'Collecte réussie.':'Tu as tenu 45 secondes.');
        break;

      case'runner':
        state.p.vy+=1450*dt;state.p.y+=state.p.vy*dt;
        if(state.p.y>=555){state.p.y=555;state.p.vy=0;state.p.grounded=true}
        if(t>state.next){state.next=t+rand(600,1050);state.obs.push({x:1320,w:rand(32,60),h:rand(45,110)})}
        for(const ob of state.obs){
          ob.x-=430*dt;
          if(ob.x<190&&ob.x+ob.w>120&&state.p.y+28>555-ob.h)return finish(false,'Obstacle percuté.');
        }
        state.obs=state.obs.filter(x=>x.x>-100);
        score+=dt*15;
        if(t>state.end)finish(true,'Course terminée.');
        break;

      case'stack':
        state.x+=state.dir*330*dt;
        if(state.x<80||state.x>1130-state.blocks.at(-1).w)state.dir*=-1;
        break;

      case'memory':
        if(state.lockUntil&&t>state.lockUntil){
          const [a,b]=state.openPair||[];
          if(a!==undefined&&b!==undefined&&state.cards[a].v!==state.cards[b].v){state.cards[a].open=false;state.cards[b].open=false;sfx('miss')}
          state.openPair=null;state.lockUntil=0;
        }
        if(!state.lockUntil&&state.cards.every(x=>x.done))finish(true,'Toutes les paires sont trouvées.');
        break;

      case'maze':{
        const dir=keys.has('ArrowLeft')?[-1,0]:keys.has('ArrowRight')?[1,0]:keys.has('ArrowUp')?[0,-1]:keys.has('ArrowDown')?[0,1]:[0,0];
        const nx=state.x+dir[0],ny=state.y+dir[1];
        if(dir[0]||dir[1]){const key=dir.join(',');if(state.lastMove!==key){state.lastMove=key;if(nx>=0&&ny>=0&&nx<state.maze.w&&ny<state.maze.h&&state.maze.cells[ny][nx]){state.x=nx;state.y=ny;sfx('click')}}}else state.lastMove='';
        if(state.x===state.maze.w-1&&state.y===state.maze.h-1)finish(true,'Sortie trouvée.');
        break;
      }

      case'paddle':paddle(dt,t);break;
      case'typing':if(t>state.end)finish(state.count>=8,state.count+' mots corrects.');break;

      case'rhythm':
        if(game.slug==='beat-duel')beatUpdate(t);else if(t>state.beat+430)finish(false,'Le tempo est perdu.');
        break;

      case'fishing':
        state.px+=state.dir*340*dt;
        if(state.px>1080||state.px<160)state.dir*=-1;
        if(state.hits>=8)finish(true,'Quota de poissons atteint.');
        if(t>state.end)finish(false,'Temps écoulé.');
        break;

      case'survival':survive(dt,t);break;
      case'lanes':lanes(dt);break;
      case'penalty':break;
      case'defense':defense(dt,t);break;
      case'puzzle':if(state.pz.every((v,i)=>v===i))finish(true,'Puzzle résolu en '+state.moves+' mouvements.');break;
      case'snake':snakeUpdate(dt,t);break;
      case'merge':if(mgMax()>=2048)finish(true,'Tu as atteint 2048 !');else if(t>state.end)finish(false,'Temps écoulé.');break;
      case'flappy':flappyUpdate(dt,t);break;
    }
  }

  function paddle(dt,t){
    if(keys.has('ArrowLeft')||keys.has('a'))state.px-=460*dt;
    if(keys.has('ArrowRight')||keys.has('d'))state.px+=460*dt;
    state.px=clamp(state.px,110,1170);
    state.ai+=Math.sign(state.ball.x-state.ai)*240*dt;
    state.ball.x+=state.ball.vx*dt;state.ball.y+=state.ball.vy*dt;
    if(state.ball.x<40||state.ball.x>1240){state.ball.vx*=-1;sfx('hit')}
    if(state.ball.y<105){
      if(Math.abs(state.ball.x-state.ai)<105){state.ball.vy=Math.abs(state.ball.vy);score+=20;sfx('hit')}
      else{state.lives--;state.ball={x:640,y:360,vx:330,vy:230};sfx('miss');if(state.lives<=0)finish(false,'Plus de vies.')}
    }
    if(state.ball.y>625){
      if(Math.abs(state.ball.x-state.px)<115){state.ball.vy=-Math.abs(state.ball.vy);score+=35;sfx('hit');emit(state.ball.x,625,'#FFC857',8,150)}
      else{state.lives--;state.ball={x:640,y:360,vx:330,vy:230};sfx('miss');if(state.lives<=0)finish(false,'La balle est passée.')}
    }
    score+=dt*6;
    if(t-start>60000)finish(true,'Une minute de jeu tenue.');
  }

  function survive(dt,t){
    movePlayer(320,dt);
    if(t>state.next){state.next=t+rand(240,620);state.en.push({x:rand(60,1220),y:rand(110,650),r:rand(14,22),speed:rand(70,125)})}
    for(const enemy of state.en){
      const d=Math.hypot(state.p.x-enemy.x,state.p.y-enemy.y)||1;
      enemy.x+=(state.p.x-enemy.x)/d*enemy.speed*dt;
      enemy.y+=(state.p.y-enemy.y)/d*enemy.speed*dt;
      if(d<35){sfx('miss');return finish(false,'Un ennemi t’a rattrapé.')}
    }
    score+=dt*10;
    if(t>state.end)finish(true,'Vague terminée.');
  }

  function lanes(dt){
    if(keys.has('ArrowLeft')&&!state.ll){state.lane=clamp(state.lane-1,0,2);state.ll=true;sfx('click')}
    if(!keys.has('ArrowLeft'))state.ll=false;
    if(keys.has('ArrowRight')&&!state.rr){state.lane=clamp(state.lane+1,0,2);state.rr=true;sfx('click')}
    if(!keys.has('ArrowRight'))state.rr=false;
    if(performance.now()>state.next){state.next=performance.now()+rand(450,800);state.obs.push({lane:Math.floor(rand(0,3)),y:-80})}
    for(const ob of state.obs){ob.y+=390*dt;if(ob.lane===state.lane&&ob.y>500&&ob.y<620)return finish(false,'Collision.');if(ob.y>700){state.passed++;score+=45}}
    state.obs=state.obs.filter(x=>x.y<700);
    if(state.passed>=25)finish(true,'Course terminée.');
  }

  function defense(dt,t){
    if(t>state.next){state.next=t+rand(350,800);state.en.push({x:rand(80,1200),y:100,r:18,speed:rand(90,160)})}
    for(const enemy of state.en)enemy.y+=enemy.speed*dt;
    state.en=state.en.filter(enemy=>{if(enemy.y>620){state.hp-=20;sfx('miss');return false}return true});
    score+=dt*7;
    if(state.hp<=0)finish(false,'Base détruite.');
    if(t-start>60000)finish(true,'Base défendue.');
  }

  function snakeFood(){
    let food;
    do{food={x:Math.floor(Math.random()*state.gridW),y:Math.floor(Math.random()*state.gridH)}}while(state.snake?.some(q=>q.x===food.x&&q.y===food.y));
    return food;
  }
  function snakeUpdate(dt,t){
    state.acc+=dt;
    if(keys.has('ArrowUp')||keys.has('w'))if(state.sdir.y!==1)state.snext={x:0,y:-1};
    if(keys.has('ArrowDown')||keys.has('s'))if(state.sdir.y!==-1)state.snext={x:0,y:1};
    if(keys.has('ArrowLeft')||keys.has('a'))if(state.sdir.x!==1)state.snext={x:-1,y:0};
    if(keys.has('ArrowRight')||keys.has('d'))if(state.sdir.x!==-1)state.snext={x:1,y:0};
    if(state.acc<state.step)return;
    state.acc=0;state.sdir=state.snext;
    const head={x:state.snake[0].x+state.sdir.x,y:state.snake[0].y+state.sdir.y};
    if(head.x<0||head.x>=state.gridW||head.y<0||head.y>=state.gridH||state.snake.some(q=>q.x===head.x&&q.y===head.y))return finish(false,'Le serpent s’est mordu ou a touché le bord.');
    state.snake.unshift(head);
    if(head.x===state.food.x&&head.y===state.food.y){score+=120;emit(120+head.x*40,120+head.y*30,'#FFC857',12,160);sfx('good');state.food=snakeFood();if(state.snake.length>=24)return finish(true,'Snake master !')}else state.snake.pop();
    if(t>state.end)finish(true,'Temps écoulé, tu as survécu.');
  }

  function mergeRow(row){
    const values=row.filter(Boolean),out=[];
    for(let i=0;i<values.length;i++){
      if(values[i]===values[i+1]){values[i]*=2;score+=values[i];sfx('score');i++}
      out.push(values[i]);
    }
    while(out.length<4)out.push(0);
    return out;
  }
  function transpose(grid){return Array.from({length:4},(_,y)=>Array.from({length:4},(_,x)=>grid[x][y]))}
  function moveGrid(dir){
    const before=JSON.stringify(state.mg);
    let g=state.mg.map(row=>row.slice());
    if(dir==='left')g=g.map(mergeRow);
    if(dir==='right')g=g.map(row=>mergeRow(row.reverse()).reverse());
    if(dir==='up'){g=transpose(g).map(mergeRow);g=transpose(g)}
    if(dir==='down'){g=transpose(g).map(row=>mergeRow(row.reverse()).reverse());g=transpose(g)}
    state.mg=g;
    if(before!==JSON.stringify(g)){state.moves++;addTile();sfx('click');if(state.moves>=140)finish(false,'Plus de coups.');}
    else sfx('miss');
  }
  function addTile(){
    const empty=[];for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(!state.mg[y][x])empty.push([x,y]);
    if(!empty.length)return;
    const [x,y]=empty[Math.floor(Math.random()*empty.length)];
    state.mg[y][x]=Math.random()<.9?2:4;
  }
  function mgMax(){return Math.max(...state.mg.flat())}

  function flappyUpdate(dt,t){
    state.f.vy+=980*dt;state.f.y+=state.f.vy*dt;
    if(t>state.next){state.next=t+rand(1100,1500);state.pipes.push({x:1320,gapY:rand(260,470),gap:220,passed:false})}
    for(const pipe of state.pipes){
      pipe.x-=330*dt;
      const hitX=state.f.x+28>pipe.x&&state.f.x-28<pipe.x+92;
      const hitY=state.f.y-24<pipe.gapY-pipe.gap/2||state.f.y+24>pipe.gapY+pipe.gap/2;
      if(hitX&&hitY)return finish(false,'Obstacle touché.');
      if(!pipe.passed&&pipe.x<state.f.x){pipe.passed=true;state.passed++;score+=100;sfx('good')}
    }
    state.pipes=state.pipes.filter(p=>p.x>-120);
    if(state.f.y<90||state.f.y>650)return finish(false,'Tu es tombé.');
    if(t-start>60000)finish(true,'Une minute dans les airs.');
  }

  function beatUpdate(t){
    const active=state.notes[state.nextNote];
    if(active&&!active.hit&&!active.miss&&t>active.time+300){
      active.miss=true;state.nextNote++;state.misses++;state.combo=0;sfx('miss');
      if(state.misses>=4)return finish(false,'Trop de notes ratées.');
    }
    if(state.hitNotes>=state.notes.length)finish(true,'Combo parfait sur 32 notes !');
  }

  function beatArrow(key){
    const lane={ArrowLeft:0,ArrowDown:1,ArrowUp:2,ArrowRight:3}[key];
    const t=performance.now();
    let best=null,bestDistance=Infinity;
    for(const note of state.notes){
      if(note.hit||note.miss||note.lane!==lane)continue;
      const d=Math.abs(t-note.time);
      if(d<bestDistance){best=note;bestDistance=d}
    }
    if(best&&bestDistance<=260){
      best.hit=true;state.hitNotes++;state.nextNote=Math.min(state.notes.length,state.nextNote+1);state.combo++;score+=Math.round(Math.max(60,300-bestDistance)+state.combo*5);emit(250+lane*220,600,'#FFC857',7,130);sfx('note',lane);
    }else{sfx('miss');state.combo=0;score=Math.max(0,score-35)}
  }

  function fish(){
    if(state.px>=state.zone&&state.px<=state.zone+140){state.hits++;score+=120;state.zone=rand(220,980);sfx('good');emit(state.px,270,'#00D4FF',9,120)}else{sfx('miss')}
  }

  function submitWord(){
    if(state.input.trim().toLowerCase()===state.word.toLowerCase()){state.count++;score+=140;sfx('good');state.word=state.words[Math.floor(rand(0,state.words.length))]}
    else{score=Math.max(0,score-45);sfx('miss')}
    state.input='';
  }

  function dropBlock(){
    const top=state.blocks.at(-1);
    const overlap=Math.min(top.x+top.w,state.x+top.w)-Math.max(top.x,state.x);
    if(overlap<=18)return finish(false,'Bloc manqué.');
    state.blocks.push({x:Math.max(top.x,state.x),w:overlap});
    score+=Math.round(overlap);
    sfx('hit');emit(state.x+overlap/2,560-state.blocks.length*50,palette[state.blocks.length%palette.length],8,130);
    if(state.blocks.length>=14)finish(true,'Tour parfaite !');
  }

  function openMemory(x,y){
    if(state.lockUntil)return;
    const col=Math.floor((x-360)/130),row=Math.floor((y-120)/130);
    if(col<0||col>3||row<0||row>3)return;
    const index=row*4+col,item=state.cards[index];
    if(!item||item.done||item.open)return;
    item.open=true;sfx('click');
    if(state.sel===null){state.sel=index;return}
    const first=state.sel;state.sel=null;state.openPair=[first,index];
    if(state.cards[first].v===item.v){state.cards[first].done=item.done=true;score+=160;sfx('good');emit(560+col*130,180+row*130,palette[item.v%palette.length],12,110)}
    else{state.lockUntil=performance.now()+650;sfx('miss')}
  }

  function puzzleClick(x,y){
    const col=Math.floor((x-445)/130),row=Math.floor((y-145)/130),index=row*3+col;
    if(index<0||index>8)return;
    if(state.sel===null){state.sel=index;sfx('click');return}
    [state.pz[state.sel],state.pz[index]]=[state.pz[index],state.pz[state.sel]];
    state.sel=null;state.moves++;score+=12;sfx('click');
  }

  function pointer(x,y){
    sfx('resume');
    if(game.mechanic==='reaction'){
      if(state.phase==='go'){
        score+=Math.round(Math.max(50,950-(performance.now()-state.go)));
        state.round++;state.phase='wait';sfx('good');emit(state.tx,state.ty,palette[1],10,160);
        if(state.round>=5)finish(true,'Réflexes validés en 5 manches.');else state.next=performance.now()+rand(800,1600);
      }else{score=Math.max(0,score-120);sfx('miss')}
    }
    if(game.mechanic==='target'){
      for(const target of state.targets){if(!target.hit&&Math.hypot(target.x-x,target.y-y)<target.r){target.hit=true;score+=110;sfx('hit');emit(target.x,target.y,palette[1],10,150);}}
    }
    if(game.mechanic==='stack')dropBlock();
    if(game.mechanic==='memory')openMemory(x,y);
    if(game.mechanic==='penalty'){
      for(const target of state.targets){
        if(Math.hypot(target.x-x,target.y-y)<target.r){state.shots++;score+=220;sfx('hit');emit(target.x,target.y,'#FFC857',8,140);if(state.shots>=5)finish(true,'Penalty réussi !');}
      }
    }
    if(game.mechanic==='defense'){
      state.en=state.en.filter(enemy=>{
        if(Math.hypot(enemy.x-x,enemy.y-y)<34){score+=100;sfx('hit');emit(enemy.x,enemy.y,'#FF4D67',12,150);return false}
        return true;
      });
    }
    if(game.mechanic==='puzzle')puzzleClick(x,y);
  }

  function draw(){
    background();

    switch(game.mechanic){
      case'reaction':
        rect(210,110,860,500,'rgba(255,255,255,.05)',30);
        strokeRect(210,110,860,500,'rgba(255,255,255,.10)',30,2);
        text(state.phase==='go'?'CLIQUE !':'ATTENDS LE SIGNAL',450,355,42,1,800);
        if(state.phase==='go')glowCircle(state.tx,state.ty,42,'#35D07F');
        text('Manche '+Math.min(5,state.round+1)+'/5',570,490,18,.55,600);
        hud('Clique au bon moment. Un faux départ fait perdre des points.');
        break;

      case'target':
        for(const target of state.targets){
          if(target.hit)continue;
          glowCircle(target.x,target.y,target.r,'#00D4FF');
          circle(target.x,target.y,target.r*.45,'rgba(255,255,255,.88)');
          circle(target.x,target.y,target.r*.18,palette[0]);
        }
        hud('Clique les 18 cibles avant qu’elles ne s’échappent.');
        break;

      case'dodge':
      case'collect':
        rect(50,90,1180,560,'rgba(255,255,255,.045)',26);
        circle(state.p.x,state.p.y,22,'#fff');
        glowCircle(state.p.x,state.p.y,10,'#00D4FF');
        for(const item of state.items)glowCircle(item.x,item.y,item.r,state.good?'#FFC857':'#FF4D67');
        hud(state.good?'Ramasse les orbes dorées.':'Évite les zones rouges pendant 45 secondes.');
        break;

      case'runner':
        rect(0,585,1280,135,'rgba(0,0,0,.28)');
        text('SPACE',590,670,16,.45,800);
        circle(state.p.x,state.p.y,26,'#fff');
        for(const ob of state.obs)rect(ob.x,555-ob.h,ob.w,ob.h,'#FF4D67',10);
        hud('SPACE pour sauter. La vitesse augmente progressivement.');
        break;

      case'stack':
        rect(100,110,1080,510,'rgba(255,255,255,.04)',26);
        state.blocks.forEach((block,i)=>rect(block.x,600-i*49,block.w,38,palette[i%palette.length],12));
        rect(state.x,600,Math.max(30,state.blocks.at(-1).w),38,'#fff',12);
        hud('Clique ou appuie sur ESPACE pour empiler. Vise le centre.');
        break;

      case'memory':
        state.cards.forEach((card,i)=>{
          const x=360+(i%4)*130,y=120+Math.floor(i/4)*130;
          rect(x,y,108,108,card.open||card.done?palette[card.v%palette.length]:'rgba(255,255,255,.065)',18);
          strokeRect(x,y,108,108,card.open||card.done?'rgba(255,255,255,.28)':'rgba(255,255,255,.08)',18,2);
          if(card.open||card.done)text(['◆','●','★','▲','■','✦','⬟','◈'][card.v],x+42,y+69,34,1,800);
          else text('?',x+44,y+67,30,.30,800);
        });
        hud('Trouve les 8 paires.');
        break;

      case'maze':{
        const cw=960/state.maze.w,ch=500/state.maze.h;
        for(let y=0;y<state.maze.h;y++)for(let x=0;x<state.maze.w;x++)rect(160+x*cw,95+y*ch,cw-2,ch-2,state.maze.cells[y][x]?'rgba(124,92,255,.20)':'rgba(255,255,255,.035)',4);
        glowCircle(160+state.x*cw+cw/2,95+state.y*ch+ch/2,Math.min(cw,ch)*.27,'#fff');
        glowCircle(160+(state.maze.w-1)*cw+cw/2,95+(state.maze.h-1)*ch+ch/2,Math.min(cw,ch)*.22,'#35D07F');
        hud('Flèches / WASD pour rejoindre la sortie verte.');
        break;
      }

      case'paddle':
        rect(80,80,1200,580,'rgba(0,0,0,.20)',28);
        rect(state.ai-105,105,210,18,'#00D4FF',9);
        rect(state.px-120,620,240,20,'#fff',10);
        glowCircle(state.ball.x,state.ball.y,15,'#FFC857');
        text('Vies '+state.lives,1020,90,17,.70,700);
        hud('← → pour déplacer ta raquette. Garde la balle en jeu.');
        break;

      case'typing':
        rect(230,150,820,330,'rgba(255,255,255,.045)',30);
        text('TAPE LE MOT',510,230,16,.45,800);
        text(state.word,420,315,58,1,800);
        rect(320,360,640,80,'rgba(255,255,255,.07)',16);
        text(state.input||'…',350,411,26,state.input?.length?1:.30,600);
        text('Mots : '+state.count+'/8',530,530,18,.65,700);
        hud('Tape le mot puis Entrée. 45 secondes.');
        break;

      case'rhythm':
        if(game.slug==='beat-duel'){
          const labels=['←','↓','↑','→'];
          for(let i=0;i<4;i++){const x=210+i*220;rect(x,110,180,500,'rgba(255,255,255,.04)',22);strokeRect(x,110,180,500,'rgba(255,255,255,.07)',22,2);text(labels[i],278+i*220,565,32,.50,800)}
          const now=performance.now();
          for(const note of state.notes){
            if(note.hit||note.miss)continue;
            const y=135+((now-note.time+900)/900)*450;
            if(y>90&&y<650){const x=280+note.lane*220;glowCircle(x,y,20,'#FFC857');text(labels[note.lane],x-10,y+9,18,1,800);}
          }
          for(let i=0;i<4;i++)rect(215+i*220,585,170,6,'#35D07F',3);
          text('Combo '+state.combo,80,125,21,.86,800);
          text('Ratés '+state.misses+'/4',1030,125,18,.68,700);
          hud('← ↓ ↑ → au contact de la ligne. 4 ratés = élimination.');
        }else{
          rect(150,315,980,18,'rgba(255,255,255,.11)',9);
          rect(930,275,145,98,'rgba(53,208,127,.16)',20);
          glowCircle(250+((performance.now()/2.8)%880),324,17,'#fff');
          text('Beat '+Math.min(state.n+1,16)+'/16',535,430,28,1,800);
          hud('Espace sur le beat.');
        }
        break;

      case'fishing':
        rect(160,280,960,34,'rgba(255,255,255,.10)',17);
        rect(state.zone,260,140,74,'rgba(53,208,127,.30)',24);
        glowCircle(state.px,297,17,'#FFC857');
        text('Poissons '+state.hits+'/8',515,405,23,.78,700);
        hud('Espace quand le flotteur entre dans la zone verte.');
        break;

      case'survival':
        rect(60,80,1160,560,'rgba(0,0,0,.14)',28);
        glowCircle(state.p.x,state.p.y,22,'#fff');
        for(const enemy of state.en)glowCircle(enemy.x,enemy.y,enemy.r,'#FF4D67');
        hud('WASD / flèches. Tiens jusqu’à la fin de la vague.');
        break;

      case'lanes':
        [0,1,2].forEach(i=>rect(310+i*220,100,5,530,'rgba(255,255,255,.18)',2));
        rect(278+state.lane*220,540,64,90,'#FFC857',14);
        for(const ob of state.obs)rect(278+ob.lane*220,ob.y,64,72,'#FF4D67',14);
        hud('← → pour changer de voie. Évite 25 obstacles.');
        break;

      case'penalty':
        rect(410,115,460,470,'rgba(255,255,255,.045)',22);
        strokeRect(410,115,460,470,'rgba(255,255,255,.12)',22,3);
        rect(590,165,100,370,'rgba(255,255,255,.045)',16);
        for(const target of state.targets)glowCircle(target.x,target.y,target.r,'#00D4FF');
        text('Tirs '+state.shots+'/5',540,625,22,.78,800);
        hud('Clique les cibles bleues.');
        break;

      case'defense':
        rect(470,530,340,70,'#7C5CFF',18);
        for(const enemy of state.en)glowCircle(enemy.x,enemy.y,enemy.r,'#FF4D67');
        rect(100,110,300,18,'rgba(255,255,255,.10)',9);
        rect(100,110,300*state.hp/100,18,'#35D07F',9);
        hud('Clique les ennemis avant qu’ils atteignent ta base.');
        break;

      case'puzzle':
        state.pz.forEach((value,i)=>{
          const x=445+(i%3)*130,y=145+Math.floor(i/3)*130;
          rect(x,y,108,108,palette[value%palette.length],18);
          text(String(value+1),x+42,y+68,28,1,800);
          if(state.sel===i)strokeRect(x-4,y-4,116,116,'#fff',22,4);
        });
        text('Coups '+state.moves,540,590,19,.70,700);
        hud('Clique deux tuiles pour les échanger.');
        break;

      case'snake':{
        const cw=42,ch=33,ox=132,oy=145;
        rect(ox-12,oy-12,state.gridW*cw+24,state.gridH*ch+24,'rgba(0,0,0,.22)',22);
        state.snake.forEach((part,i)=>rect(ox+part.x*cw,oy+part.y*ch,cw-3,ch-3,i?'#35D07F':'#fff',8));
        glowCircle(ox+state.food.x*cw+cw/2,oy+state.food.y*ch+ch/2,12,'#FFC857');
        text('Longueur '+state.snake.length,510,105,20,.75,800);
        hud('Flèches / WASD. Mange les bonus et grandis.');
        break;
      }

      case'merge':
        for(let y=0;y<4;y++)for(let x=0;x<4;x++){
          const value=state.mg[y][x],cx=450+x*125,cy=150+y*112;
          rect(cx,cy,105,92,value?'rgba(124,92,255,.28)':'rgba(255,255,255,.055)',18);
          if(value)text(String(value),cx+(value>99?22:35),cy+58,26,1,800);
        }
        text('Meilleure tuile '+mgMax(),505,650,21,.75,800);
        hud('Flèches / WASD. Fusionne les nombres jusqu’à 2048.');
        break;

      case'flappy':
        rect(0,585,1280,135,'rgba(0,0,0,.25)');
        for(const pipe of state.pipes){
          rect(pipe.x,0,92,pipe.gapY-pipe.gap/2,'#35D07F',10);
          rect(pipe.x,pipe.gapY+pipe.gap/2,92,720,'#35D07F',10);
        }
        glowCircle(state.f.x,state.f.y,26,'#FFC857');
        text('Points '+state.passed,1070,90,20,.75,800);
        hud('Espace / clic pour voler.');
        break;
    }

    drawParticles(Math.min(.034,(performance.now()-last)/1000));
    if(paused){
      rect(445,290,390,120,'rgba(8,12,22,.95)',24);
      text('PAUSE',592,340,34,1,800);
    }
  }

  function resetGame(){
    const existing=wrap.querySelector('.game-end');
    existing?.remove();
    ended=false;
    submitted=false;
    sound.resume();
    init();
    raf=requestAnimationFrame(frame);
    canvas.focus();
  }

  function keydown(event){
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','w','a','s','d'].includes(event.key))event.preventDefault();
    keys.add(event.key);
    sound.resume();

    if(event.key==='Escape'&&!event.repeat){paused=!paused;return}
    if(event.key==='p'&&!event.repeat){paused=!paused;return}
    if(event.key===' '&&!event.repeat){
      if(game.mechanic==='runner'&&state.p.grounded){state.p.vy=-620;state.p.grounded=false;sfx('hit')}
      if(game.mechanic==='stack')dropBlock();
      if(game.mechanic==='rhythm'&&game.slug!=='beat-duel'){
        const delta=Math.abs(performance.now()-state.beat);
        if(delta<450){score+=Math.max(30,420-delta);state.n++;state.beat+=1800;sfx('note',state.n);if(state.n>=16)finish(true,'Combo de 16 beats.')}else{sfx('miss');score=Math.max(0,score-90)}
      }
      if(game.mechanic==='fishing')fish();
      if(game.mechanic==='flappy'){state.f.vy=-390;sfx('hit')}
    }
    if(game.slug==='beat-duel'&&['ArrowLeft','ArrowDown','ArrowUp','ArrowRight'].includes(event.key))beatArrow(event.key);
    if(game.mechanic==='typing'&&event.key==='Enter')submitWord();
  }
  function keyup(event){keys.delete(event.key)}
  function typeInput(event){
    if(game.mechanic!=='typing'||event.ctrlKey||event.metaKey||event.altKey)return;
    if(event.key.length===1){state.input=(state.input||'')+event.key;sfx('tick')}
  }

  function frame(t){
    if(ended)return;
    update(t);
    draw();
    if(!ended)raf=requestAnimationFrame(frame);
  }

  tools.querySelector('[data-pause]').onclick=()=>{paused=!paused;sound.resume()};
  tools.querySelector('[data-fullscreen]').onclick=async()=>{
    try{
      if(document.fullscreenElement===wrap)await document.exitFullscreen();
      else await wrap.requestFullscreen?.();
      canvas.focus();
    }catch{}
  };
  tools.querySelector('[data-mute]').onclick=()=>{
    muted=!muted;sound.setEnabled(!muted);updateMuteButton();
    if(!muted)sound.resume();
  };
  canvas.addEventListener('pointerdown',(event)=>{
    const rect=canvas.getBoundingClientRect();
    pointer((event.clientX-rect.left)/rect.width*1280,(event.clientY-rect.top)/rect.height*720);
    canvas.focus();
  });
  window.addEventListener('keydown',keydown);
  window.addEventListener('keyup',keyup);
  window.addEventListener('keydown',typeInput);

  sound.resume();
  init();
  raf=requestAnimationFrame(frame);

  return{
    destroy(){
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown',keydown);
      window.removeEventListener('keyup',keyup);
      window.removeEventListener('keydown',typeInput);
    }
  };
}
