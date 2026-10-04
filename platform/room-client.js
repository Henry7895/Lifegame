export class RoomClient{
constructor(url,onMessage){this.url=url;this.onMessage=onMessage;this.ws=null;this.closed=false;this.lastAction=null}
connect(){return new Promise((resolve,reject)=>{if(!this.url)return reject(new Error('Serveur non configuré'));this.ws=new WebSocket(this.url);this.ws.onopen=()=>{this.onMessage({type:'connected'});resolve()};this.ws.onmessage=e=>{try{this.onMessage(JSON.parse(e.data))}catch{}};this.ws.onerror=()=>{this.onMessage({type:'error',message:'Connexion impossible'});reject(new Error('WebSocket error'))};this.ws.onclose=()=>{if(!this.closed)this.onMessage({type:'disconnected'})}})}
send(type,p={}){if(this.ws?.readyState===1)this.ws.send(JSON.stringify({type,...p}))}
create(gameSlug,name,maxPlayers,isPrivate){this.lastAction={type:'create',gameSlug,name,maxPlayers,private:isPrivate};this.send('create',this.lastAction)}
join(code,name){this.lastAction={type:'join',code,name};this.send('join',this.lastAction)}
ready(){this.send('ready')}start(){this.send('start')}kick(playerId){this.send('kick',{playerId})}lock(value){this.send('lock',{locked:value})}chat(text){this.send('chat',{text})}
leave(){this.send('leave');this.close()}close(){this.closed=true;try{this.ws?.close()}catch{}}
}
