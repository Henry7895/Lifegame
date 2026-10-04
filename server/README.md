# LifeGame Multiplayer Server

Ce serveur Node/WebSocket est séparé du frontend GitHub Pages afin de permettre de connecter plusieurs navigateurs.

## Lancer
cd server
npm install
npm start

## Protocole
create, join, ready, start, input, chat.

Le serveur contrôle la capacité des rooms, l'hôte, l'état ready et les connexions. GitHub Pages ne peut pas exécuter ce serveur Node directement : il faut le déployer sur une infrastructure compatible WebSocket puis utiliser son URL wss:// côté frontend.