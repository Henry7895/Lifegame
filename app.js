import { games, bySlug } from './games/registry.js';
import { route, go } from './platform/router.js';
import * as profile from './platform/profile.js';
import * as localRooms from './platform/rooms.js';
import { serverUrl, setServerUrl, globalScores, submitScore, onlinePlayers } from './platform/leaderboard.js';
import { RoomClient } from './platform/room-client.js';

const app = document.querySelector('#app');

const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
}[char]));

const initials = (value) => String(value || 'Player')
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .map((part) => part[0])
  .join('')
  .slice(0, 2)
  .toUpperCase() || 'LG';

let remoteClient = null;
let remoteRoom = null;
let remoteOnline = [];
let remoteChat = [];
let contentRoot = null;

function art(game) {
  const palette = Array.isArray(game.gradient) && game.gradient.length >= 2 ? game.gradient : ['#7C5CFF', '#00D4FF'];
  const genre = String(game.genre || '').toLowerCase();
  const mechanic = String(game.mechanic || '').toLowerCase();
  let scene = '';
  if (genre.includes('horror')) {
    scene += '<circle cx="720" cy="105" r="66" fill="#fff" opacity=".18"/>' + '<path d="M545 438V285l120-104 120 104v153Z" fill="#080A12" opacity=".82"/>' + '<circle cx="628" cy="315" r="9" fill="#FF4D67"/><circle cx="705" cy="315" r="9" fill="#FF4D67"/>' + '<path d="M620 350q46 35 92 0" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="8"/>';
  } else if (genre.includes('racing') || genre.includes('action')) {
    scene += '<path d="M545 500C615 380 695 225 870 120c24 83 10 167-43 239-74 102-165 156-282 141Z" fill="#080A12" opacity=".82"/>' + '<path d="M605 495Q720 292 875 168" stroke="#fff" stroke-opacity=".23" stroke-width="12" stroke-dasharray="30 22" fill="none"/>' + '<path d="M670 404l92-44 79 35-95 47z" fill="'+palette[1]+'"/>' + '<circle cx="700" cy="447" r="20" fill="#090B11"/><circle cx="820" cy="394" r="20" fill="#090B11"/>';
  } else if (genre.includes('sports')) {
    scene += '<rect x="550" y="165" width="300" height="300" rx="28" fill="#080A12" opacity=".48"/>' + '<path d="M570 445V190h260v255M700 445V320m-70 0h140" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="8"/>' + '<circle cx="700" cy="320" r="62" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="7"/>' + '<circle cx="764" cy="250" r="31" fill="'+palette[1]+'"/>';
  } else if (genre.includes('challenge') || ['rhythm','reaction','target','typing','stack','merge'].includes(mechanic)) {
    scene += '<rect x="545" y="155" width="310" height="325" rx="34" fill="#080A12" opacity=".54"/>' + '<circle cx="700" cy="317" r="108" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="22"/>' + '<circle cx="700" cy="317" r="74" fill="none" stroke="'+palette[1]+'" stroke-opacity=".82" stroke-width="16"/>' + '<circle cx="700" cy="317" r="38" fill="'+palette[0]+'"/>' + '<path d="M575 510h250" stroke="#fff" stroke-opacity=".25" stroke-width="10"/>';
  } else if (genre.includes('adventure')) {
    scene += '<path d="M520 490 630 292 705 390 790 215 890 490Z" fill="#080A12" opacity=".82"/>' + '<path d="M630 292 675 368 710 322 784 490H585Z" fill="'+palette[1]+'" opacity=".48"/>' + '<circle cx="775" cy="120" r="42" fill="#fff" opacity=".22"/>';
  } else if (genre.includes('simulation')) {
    scene += '<path d="M535 465V290l74-52 74 52v175Z" fill="#080A12" opacity=".8"/>' + '<path d="m610 290 82-58 82 58v175H610Z" fill="'+palette[0]+'" opacity=".48"/>' + '<path d="M558 328h40v40h-40zm90 0h40v40h-40zm90 0h40v40h-40z" fill="#fff" opacity=".28"/>';
  } else {
    scene += '<rect x="555" y="170" width="300" height="290" rx="36" fill="#080A12" opacity=".46"/>' + '<rect x="590" y="210" width="92" height="92" rx="20" fill="'+palette[0]+'"/>' + '<rect x="728" y="210" width="92" height="92" rx="20" fill="'+palette[1]+'"/>' + '<rect x="590" y="340" width="92" height="92" rx="20" fill="'+palette[1]+'" opacity=".65"/>' + '<rect x="728" y="340" width="92" height="92" rx="20" fill="'+palette[0]+'" opacity=".8"/>';
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560">' +
    '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+palette[0]+'"/><stop offset="1" stop-color="'+palette[1]+'"/></linearGradient></defs>' +
    '<rect width="900" height="560" rx="36" fill="url(#bg)"/>' +
    '<circle cx="780" cy="90" r="190" fill="#fff" opacity=".08"/>' + scene +
    '<rect x="30" y="30" width="840" height="500" rx="30" fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="2"/>' +
    '<text x="56" y="112" fill="#fff" font-family="Arial,sans-serif" font-size="42" font-weight="800">'+esc(game.title)+'</text>' +
    '<text x="58" y="149" fill="#fff" font-family="Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="2" opacity=".7">'+esc(game.genre)+' · '+esc(game.difficulty)+'</text>' +
  '</svg>';
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}
function gameCard(game) {
  const favorite = profile.get().favorites?.includes(game.slug);
  const badge = game.challenge ? '⚡ DÉFI' : game.multiplayer ? '● MULTI' : game.featured ? '★ TENDANCE' : 'JEU';

  return `
    <article class="game-card" data-slug="${esc(game.slug)}">
      <button class="fav ${favorite ? 'active' : ''}" data-fav="${esc(game.slug)}" aria-label="Favori" title="Favori">★</button>
      <div class="card-art">
        <img loading="lazy" src="${art(game)}" alt="${esc(game.title)}">
        <span class="card-badge">${badge}</span>
      </div>
      <div class="game-card-body">
        <div class="eyebrow">${esc(game.genre)} · ${esc(game.difficulty)}</div>
        <h3>${esc(game.title)}</h3>
        <p>${esc(game.description)}</p>
        <div class="meta">
          <span>★ ${esc(game.rating)}</span>
          <span>👤 ${game.playersMin}-${game.playersMax}</span>
          <span>${Number(game.playCount || 0).toLocaleString('fr-FR')}</span>
        </div>
      </div>
    </article>`;
}

function bindGameCards(root) {
  root.querySelectorAll('.game-card').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('[data-fav]')) return;
      go('game/' + encodeURIComponent(card.dataset.slug));
    });
  });

  root.querySelectorAll('[data-fav]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      profile.favorite(button.dataset.fav);
      render();
    });
  });
}

function mountShell() {
  if (contentRoot) return contentRoot;

  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <a class="brand" href="#home" aria-label="LifeGame accueil">
          <span class="brand-mark">L</span>
          <span>Life<span>Game</span></span>
        </a>
        <button class="mobile-menu" id="menu" aria-label="Ouvrir le menu">☰</button>
        <nav id="nav" aria-label="Navigation principale">
          <a href="#home">Accueil</a>
          <a href="#games">Jeux</a>
          <a href="#leaderboards">Classements</a>
          <a href="#rooms">Rooms</a>
          <a href="#friends">Amis</a>
        </nav>
        <div class="top-actions">
          <label class="search">
            <span aria-hidden="true">⌕</span>
            <input id="search" type="search" placeholder="Rechercher un jeu…" aria-label="Rechercher un jeu">
          </label>
          <button class="icon-btn" id="settings" aria-label="Configurer le serveur" title="Serveur">⚙</button>
          <a class="avatar" href="#profile" aria-label="Profil">${initials(profile.get().name)}</a>
        </div>
      </header>
      <main id="content" tabindex="-1"></main>
    </div>`;

  contentRoot = document.querySelector('#content');

  document.querySelector('#menu').addEventListener('click', () => {
    document.querySelector('#nav').classList.toggle('open');
  });

  document.querySelector('#search').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const value = event.currentTarget.value.trim();
    go(value ? 'games?search=' + encodeURIComponent(value) : 'games');
  });

  document.querySelectorAll('#nav a').forEach((link) => link.addEventListener('click', () => document.querySelector('#nav').classList.remove('open')));
  document.querySelector('#settings').addEventListener('click', openSettings);
  return contentRoot;
}

function section(title, subtitle, list) {
  if (!list.length) return '';
  return `
    <section class="section">
      <div class="section-head">
        <div>
          <span class="kicker">LIFEGAME</span>
          <h2>${title}</h2>
          ${subtitle ? `<p>${subtitle}</p>` : ''}
        </div>
        <a href="#games">Tout voir →</a>
      </div>
      <div class="game-grid">${list.map(gameCard).join('')}</div>
    </section>`;
}

function home(root) {
  const multiplayer = games.filter((game) => game.multiplayer);
  const challenges = games.filter((game) => game.challenge);
  const trends = games.filter((game) => game.featured).slice(0, 8);
  const popular = [...games].sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, 8);
  const recent = games.slice(-8).reverse();
  const heroGame = challenges[0] || trends[0] || games[0];

  root.innerHTML = `
    <section class="hero-new">
      <div class="hero-copy">
        <span class="live-pill"><i></i> ${serverUrl() ? 'SERVEUR CONNECTÉ' : 'PLATEFORME ACTIVE'}</span>
        <span class="kicker">PLAY. CREATE. CONNECT.</span>
        <h1>Des jeux courts.<br><span>Des défis mémorables.</span></h1>
        <p>Des parties rapides, des défis express, du rythme à flèches, des casse-têtes et des rooms pour jouer ensemble.</p>
        <div class="hero-actions">
          <a class="btn primary" href="#games">▶ Jouer maintenant</a>
          <a class="btn ghost" href="#rooms">＋ Créer une room</a>
        </div>
        <div class="hero-metrics">
          <div><b>${games.length}</b><span>jeux</span></div>
          <div><b>${multiplayer.length}</b><span>multijoueurs</span></div>
          <div><b>${challenges.length}</b><span>défis express</span></div>
        </div>
      </div>

      <div class="hero-showcase">
        <div class="showcase-main">
          <img src="${art(heroGame)}" alt="">
          <div>
            <span>⚡ DÉFI EN VEDETTE</span>
            <b>${esc(heroGame.title)}</b>
            <a href="#play/${encodeURIComponent(heroGame.slug)}">Lancer →</a>
          </div>
        </div>
        <div class="mini-stack">
          ${challenges.slice(1, 4).map((game) => `
            <a class="mini-game" href="#game/${encodeURIComponent(game.slug)}">
              <img src="${art(game)}" alt="">
              <div><b>${esc(game.title)}</b><span>${esc(game.genre)}</span></div>
            </a>`).join('')}
        </div>
      </div>
    </section>

    ${section('Défis express', 'Des manches de quelques secondes pour battre ton record.', challenges)}
    ${section('Tendances', 'Des jeux que tu relances encore et encore.', trends)}
    ${section('Multijoueur', 'Prépare une room et invite tes amis.', multiplayer)}
    ${section('Les plus joués', 'Les classiques LifeGame les plus lancés.', popular)}
    ${section('Nouveautés', 'Les derniers ajouts au catalogue.', recent)}

    <section class="section">
      <div class="section-head">
        <div>
          <span class="kicker">WORLD</span>
          <h2>Classement mondial</h2>
          <p>Uniquement les vrais scores envoyés au serveur.</p>
        </div>
        <a href="#leaderboards">Voir tout →</a>
      </div>
      <div class="leaderboard-card" id="home-leaderboard">
        <div class="loading">Chargement…</div>
      </div>
    </section>`;

  bindGameCards(root);
  loadLeaderboard('global', document.querySelector('#home-leaderboard'), 7);
}

function leaderRows(rows) {
  if (!rows.length) return '<div class="empty">Aucun score enregistré.</div>';

  return `
    <div class="leader-head"><span>#</span><span>Joueur</span><span>Score</span><span>Date</span></div>
    ${rows.map((row, index) => `
      <div class="leader-row">
        <b class="rank r${index + 1}">${index + 1}</b>
        <span class="leader-user"><i class="avatar mini">${initials(row.name)}</i><strong>${esc(row.name)}</strong></span>
        <strong>${Number(row.score || 0).toLocaleString('fr-FR')}</strong>
        <time>${row.at ? new Date(row.at).toLocaleDateString('fr-FR') : '—'}</time>
      </div>`).join('')}`;
}

async function loadLeaderboard(game, target, limit = 20) {
  if (!target) return;
  target.innerHTML = '<div class="loading">Chargement…</div>';

  const result = await globalScores(game);
  if (!result.connected) {
    target.innerHTML = '<div class="leaderboard-offline"><strong>Classement mondial non connecté</strong><span>Configure le serveur avec ⚙ pour afficher les vrais scores de tous les joueurs.</span></div>';
    return;
  }

  target.innerHTML = leaderRows(result.rows.slice(0, limit));
}

function leaderboardsPage(root) {
  root.innerHTML = `
    <section class="page-head big-head">
      <div>
        <span class="kicker">WORLD LEADERBOARDS</span>
        <h1>Classements</h1>
        <p>Le top mondial global ou par jeu, sans faux joueurs ni faux scores.</p>
      </div>
    </section>

    <div class="rank-toolbar">
      <select id="rank-game" aria-label="Jeu du classement">
        <option value="global">🌍 Tous les jeux</option>
        ${games.map((game) => `<option value="${esc(game.slug)}">${esc(game.title)}</option>`).join('')}
      </select>
      <div class="rank-pills" aria-hidden="true">
        <button class="active" type="button">Global</button>
        <button type="button">Cette semaine</button>
        <button type="button">Ce mois</button>
      </div>
    </div>

    <section class="leaderboard-card full" id="leaderboard-page">
      <div class="loading">Chargement…</div>
    </section>`;

  const target = root.querySelector('#leaderboard-page');
  root.querySelector('#rank-game').addEventListener('change', (event) => {
    loadLeaderboard(event.currentTarget.value, target, 50);
  });
  loadLeaderboard('global', target, 50);
}

function gamesPage(root, category, search) {
  const normalizedCategory = category ? decodeURIComponent(category) : '';
  const query = String(search || '').trim().toLowerCase();
  let list = games.slice();

  if (normalizedCategory) {
    list = list.filter((game) => game.genre.toLowerCase() === normalizedCategory.toLowerCase());
  }
  if (query) {
    list = list.filter((game) => (
      game.title + ' ' + game.description + ' ' + game.genre + ' ' + game.tags.join(' ')
    ).toLowerCase().includes(query));
  }

  const categories = ['Horror', 'Action', 'Racing', 'Adventure', 'Survival', 'Simulation', 'Casual', 'Sports', 'Multiplayer', 'Challenges'];

  root.innerHTML = `
    <section class="page-head">
      <div>
        <span class="kicker">CATALOGUE</span>
        <h1>${esc(normalizedCategory || 'Tous les jeux')}</h1>
        <p>${list.length} jeu${list.length > 1 ? 'x' : ''} affiché${list.length > 1 ? 's' : ''}.</p>
      </div>
      <input id="filter" value="${esc(search || '')}" placeholder="Rechercher dans le catalogue…" aria-label="Filtrer les jeux">
    </section>
    <div class="chips">
      ${categories.map((item) => `<a class="chip ${normalizedCategory.toLowerCase() === item.toLowerCase() ? 'active' : ''}" href="#games/${encodeURIComponent(item)}">${item}</a>`).join('')}
    </div>
    <div class="game-grid catalog">${list.map(gameCard).join('')}</div>`;

  bindGameCards(root);

  root.querySelector('#filter').addEventListener('input', (event) => {
    const q = event.currentTarget.value.toLowerCase();
    const shown = games.filter((game) => (
      game.title + ' ' + game.description + ' ' + game.genre + ' ' + game.tags.join(' ')
    ).toLowerCase().includes(q));
    const grid = root.querySelector('.game-grid');
    grid.innerHTML = shown.map(gameCard).join('');
    bindGameCards(root);
  });
}

async function gamePage(root, game) {
  root.innerHTML = `
    <div class="back"><a href="#games">← Retour au catalogue</a></div>
    <section class="game-hero">
      <img src="${art(game)}" alt="">
      <div class="game-hero-overlay">
        <div>
          <span class="kicker">${esc(game.genre)} · ${esc(game.difficulty)}</span>
          <h1>${esc(game.title)}</h1>
          <p>${esc(game.description)}</p>
          <div class="hero-actions">
            <a class="btn primary" href="#play/${encodeURIComponent(game.slug)}">▶ Jouer</a>
            ${game.multiplayer ? `<a class="btn ghost" href="#rooms?game=${encodeURIComponent(game.slug)}">Créer une room</a>` : ''}
          </div>
          <div class="game-facts">
            <span>★ ${esc(game.rating)}</span>
            <span>👤 ${game.playersMin}-${game.playersMax}</span>
            <span>${Number(game.playCount || 0).toLocaleString('fr-FR')} parties</span>
          </div>
        </div>
      </div>
    </section>

    <div class="detail-grid">
      <section class="panel">
        <span class="kicker">GAMEPLAY</span>
        <h2>À propos</h2>
        <p>${esc(game.description)}</p>
        <div class="stat-row">
          <span>⚡ ${esc(game.mechanic)}</span>
          <span>🏷 ${esc(game.tags.join(' · '))}</span>
          <button class="link-btn" id="fav">${profile.get().favorites?.includes(game.slug) ? '★ Retirer des favoris' : '☆ Ajouter aux favoris'}</button>
        </div>
      </section>
      <section class="leaderboard-card compact">
        <div class="section-head">
          <div><span class="kicker">TOP SCORES</span><h2>Mondial</h2></div>
          <a href="#leaderboards">Tous →</a>
        </div>
        <div id="game-leaderboard"><div class="loading">Chargement…</div></div>
      </section>
    </div>`;

  root.querySelector('#fav').addEventListener('click', () => {
    profile.favorite(game.slug);
    render();
  });

  await loadLeaderboard(game.slug, root.querySelector('#game-leaderboard'), 5);
}

async function playPage(root, game) {
  root.innerHTML = `
    <div class="play-head">
      <a href="#game/${encodeURIComponent(game.slug)}">← ${esc(game.title)}</a>
      <div><span class="server-dot ${serverUrl() ? 'on' : ''}"></span>${serverUrl() ? 'Online prêt' : 'Mode local'}</div>
    </div>
    <div id="gameHost"></div>`;

  try {
    const module = await import('./platform/runtime.js');
    const play = module.play;
    const gameHost = root.querySelector('#gameHost');
    const session = play(gameHost, game, (result) => {
      profile.result(result);
      submitScore(game.slug, profile.get().name, result.score, result.duration);
    });

    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      session.destroy();
      go('game/' + encodeURIComponent(game.slug));
    };

    window.addEventListener('keydown', onKey, { once: true });
  } catch (error) {
    console.error('LifeGame runtime error:', error);
    root.querySelector('#gameHost').innerHTML = `
      <section class="panel error-panel">
        <span class="kicker">ERREUR DU JEU</span>
        <h2>Le moteur du jeu n’a pas pu être chargé.</h2>
        <p>Le reste de LifeGame reste disponible. Recharge la page ou retourne au catalogue.</p>
        <div class="hero-actions"><a class="btn primary" href="#games">Retour aux jeux</a><a class="btn ghost" href="#home">Accueil</a></div>
      </section>`;
  }
}

function createRoomForm(root) {
  const publicRooms = localRooms.list();
  const params = new URLSearchParams(location.hash.includes('?') ? location.hash.slice(location.hash.indexOf('?') + 1) : '');
  const requestedGame = params.get('game') || '';

  root.innerHTML = `
    <section class="page-head big-head">
      <div>
        <span class="kicker">MULTIPLAYER</span>
        <h1>Créer ou rejoindre</h1>
        <p>Une vraie salle d’attente, un code partageable et une liste de joueurs présents.</p>
      </div>
      <div class="mode-card"><span>Connexion</span><strong class="${serverUrl() ? 'good' : 'muted'}">${serverUrl() ? 'ONLINE' : 'LOCAL'}</strong></div>
    </section>

    <section class="create-room-layout">
      <section class="panel create-room-card">
        <span class="kicker">NOUVELLE ROOM</span>
        <h2>Créer une partie</h2>
        <div class="room-form">
          <label>Jeu
            <select id="room-game">${games.filter((game) => game.multiplayer).map((game) => `<option value="${esc(game.slug)}" ${game.slug === requestedGame ? 'selected' : ''}>${esc(game.title)}</option>`).join('')}</select>
          </label>
          <label>Pseudo<input id="room-name" value="${esc(profile.get().name)}" maxlength="24" autocomplete="nickname"></label>
          <label>Joueurs
            <select id="room-max">
              <option>2</option><option>4</option><option selected>6</option><option>8</option><option>10</option><option>12</option>
            </select>
          </label>
          <label class="checkline"><input id="room-private" type="checkbox"> Privée</label>
          <button class="btn primary create-big" id="create">Créer la room</button>
        </div>
      </section>

      <section class="panel quick-room">
        <span class="kicker">J’AI UN CODE</span>
        <h2>Rejoindre</h2>
        <p>Entre le code transmis par ton ami.</p>
        <div class="join-inline">
          <input id="join-code" maxlength="5" placeholder="A8F4K" autocomplete="off">
          <button class="btn ghost" id="join">Rejoindre</button>
        </div>
        <div class="helper">Un lien d’invitation ouvre directement cette room.</div>
      </section>
    </section>

    <section class="section">
      <div class="section-head"><div><span class="kicker">PUBLIC</span><h2>Rooms ouvertes</h2></div></div>
      <div class="room-table">
        ${publicRooms.length ? publicRooms.map((room) => `
          <div class="room-row">
            <b>${esc(room.code)}</b>
            <span>${esc(bySlug(room.gameSlug)?.title || room.gameSlug)}</span>
            <span>${room.players.length}/${room.maxPlayers}</span>
            <button class="btn small" data-join-room="${esc(room.code)}">Rejoindre</button>
          </div>`).join('') : '<div class="empty">Aucune room locale publique.</div>'}
      </div>
    </section>

    <section class="info-strip">
      <div><strong>Connecter plusieurs navigateurs</strong><span>${serverUrl() ? 'Le serveur WebSocket est configuré.' : 'Configure l’URL du serveur avec ⚙ pour passer du mode local au vrai online.'}</span></div>
      <button class="btn small" id="room-settings">⚙ Configurer</button>
    </section>`;

  root.querySelector('#create').addEventListener('click', createRoom);
  root.querySelector('#join').addEventListener('click', () => joinByCode());
  root.querySelector('#join-code').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') joinByCode();
  });
  root.querySelector('#room-settings').addEventListener('click', openSettings);

  root.querySelectorAll('[data-join-room]').forEach((button) => {
    button.addEventListener('click', () => joinByCode(button.dataset.joinRoom));
  });
}

async function roomsPage(root) {
  const hashQuery = location.hash.includes('?') ? location.hash.slice(location.hash.indexOf('?') + 1) : '';
  const query = new URLSearchParams(hashQuery);
  const joinCode = query.get('join');

  if (joinCode && !remoteRoom) {
    const localInvitation = localRooms.get(joinCode);
    if (localInvitation) {
      localRooms.join(joinCode, profile.get().name);
    } else if (serverUrl()) {
      await connectRemote('join', joinCode);
    }
  }

  const active = remoteRoom || localRooms.get(localRooms.current());
  if (!active) {
    createRoomForm(root);
    return;
  }

  const game = bySlug(active.gameSlug);
  const players = active.players || [];

  root.innerHTML = `
    <section class="room-top">
      <div>
        <span class="kicker">ROOM · ${esc(active.code)}</span>
        <h1>${esc(game?.title || active.gameSlug)}</h1>
        <p>Invite tes amis et vois les joueurs présents en direct.</p>
      </div>
      <div class="room-actions">
        <span class="status live">${remoteRoom ? 'ONLINE' : 'LOCAL'}</span>
        <button class="btn primary" id="invite">↗ Inviter</button>
      </div>
    </section>

    <div class="room-command">
      <div class="room-code-xl">${esc(active.code)}</div>
      <div class="room-command-copy"><strong>Code d’invitation</strong><span>Tu peux partager le code ou le lien.</span></div>
      <button class="btn ghost" id="copy">Copier</button>
    </div>

    <div class="room-dashboard">
      <section class="panel">
        <div class="section-head">
          <div><span class="kicker">LOBBY</span><h2>Joueurs <em>${players.length}/${active.maxPlayers}</em></h2></div>
          <span class="room-state">${esc(active.status)}</span>
        </div>

        <div class="connected-list">
          ${players.map((player) => `
            <div class="connected-player">
              <i class="avatar mini">${initials(player.name)}</i>
              <div><strong>${esc(player.name)}</strong><span>${player.host ? '👑 Hôte · ' : ''}${player.ready ? '🟢 Prêt' : '⚪ En attente'}</span></div>
              ${player.name !== profile.get().name && (remoteRoom || active.hostId) ? `<button class="mini-action" data-kick="${esc(player.id)}" aria-label="Retirer">✕</button>` : ''}
            </div>`).join('')}
        </div>

        <div class="hero-actions">
          <button class="btn primary" id="ready">✓ Prêt / Pas prêt</button>
          <button class="btn ghost" id="lock">${active.locked ? '🔓 Déverrouiller' : '🔒 Verrouiller'}</button>
          <button class="btn ghost" id="start">▶ Démarrer</button>
          <button class="btn ghost" id="leave">Quitter</button>
        </div>
      </section>

      <aside class="room-side">
        <section class="panel">
          <div class="section-head">
            <div><span class="kicker">EN DIRECT</span><h2>Joueurs dans la room <em>${players.length}</em></h2></div>
            <button class="link-btn" id="refresh-online">Actualiser</button>
          </div>
          <div class="online-list room-presence">
            ${players.length ? players.map((player) => `<div class="online-row"><i class="online-dot"></i><span>${esc(player.name)}</span><small>${player.host ? 'Hôte' : player.ready ? 'Prêt' : 'En attente'}</small></div>`).join('') : '<div class="empty">Aucun joueur dans cette room.</div>'}
          </div>
        </section>

        <section class="panel chat-panel">
          <div class="section-head"><div><span class="kicker">CHAT</span><h2>Salon</h2></div></div>
          <div class="chat-log">
            ${remoteChat.length ? remoteChat.map((message) => `<div><b>${esc(message.name)}</b><span>${esc(message.text)}</span></div>`).join('') : '<div class="empty">Le chat apparaît quand le serveur est connecté.</div>'}
          </div>
          <div class="chat-send"><input id="chat" maxlength="300" placeholder="Message…" autocomplete="off"><button class="btn small" id="send-chat">Envoyer</button></div>
        </section>
      </aside>
    </div>`;

  const remote = Boolean(remoteRoom);

  root.querySelector('#ready').addEventListener('click', () => {
    if (remote) remoteClient?.ready();
    else { localRooms.ready(active.code); render(); }
  });

  root.querySelector('#lock').addEventListener('click', () => {
    if (remote) remoteClient?.lock(!active.locked);
    else { localRooms.lock(active.code, !active.locked); render(); }
  });

  root.querySelector('#start').addEventListener('click', () => {
    if (remote) {
      remoteClient?.start();
      return;
    }
    const started = localRooms.start(active.code);
    if (started) go('play/' + encodeURIComponent(started.gameSlug));
    else alert('Tous les joueurs doivent être prêts.');
  });

  root.querySelector('#leave').addEventListener('click', () => {
    if (remote) {
      remoteClient?.leave();
      remoteClient = null;
      remoteRoom = null;
      remoteChat = [];
    } else {
      localRooms.leave(active.code);
    }
    render();
  });

  root.querySelector('#invite').addEventListener('click', inviteRoom);
  root.querySelector('#copy').addEventListener('click', () => copyText(active.code));
  root.querySelector('#refresh-online').addEventListener('click', () => refreshOnline(true));
  root.querySelector('#send-chat').addEventListener('click', sendChat);
  root.querySelector('#chat').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') sendChat();
  });

  root.querySelectorAll('[data-kick]').forEach((button) => {
    button.addEventListener('click', () => {
      if (remote) remoteClient?.kick(button.dataset.kick);
      else { localRooms.kick(active.code, button.dataset.kick); render(); }
    });
  });

  refreshOnline(false);
}

function profilePage(root) {
  const player = profile.get();
  const xp = player.xp % 500;
  const achievements = [
    ['first-game', 'Premier jeu'],
    ['first-win', 'Première victoire'],
    ['centurion', 'Centurion'],
    ['high-score', 'High score']
  ];

  root.innerHTML = `
    <section class="profile-hero">
      <div class="avatar huge">${initials(player.name)}</div>
      <div><span class="kicker">PROFIL</span><h1>${esc(player.name)}</h1><p>${esc(player.bio)}</p></div>
      <button class="btn ghost" id="edit">Modifier</button>
    </section>
    <div class="stats-grid">
      <div><b>Niveau ${player.level}</b><span>${xp}/500 XP</span><div class="xp"><i style="width:${Math.min(100, xp / 5)}%"></i></div></div>
      <div><b>${player.gamesPlayed}</b><span>Parties</span></div>
      <div><b>${player.wins}</b><span>Victoires</span></div>
      <div><b>${player.hoursPlayed.toFixed(1)} h</b><span>Temps</span></div>
    </div>
    <section class="section">
      <h2>Achievements</h2>
      <div class="achievement-grid">
        ${achievements.map(([id, label]) => `<div class="achievement ${player.achievements.includes(id) ? 'unlocked' : ''}"><b>${label}</b></div>`).join('')}
      </div>
    </section>`;

  root.querySelector('#edit').addEventListener('click', () => {
    const name = prompt('Pseudo', player.name);
    if (name?.trim()) profile.update({ name: name.trim().slice(0, 24) });
    render();
  });
}

function friendsPage(root) {
  let friends = [];
  try { friends = JSON.parse(localStorage.getItem('lifegame:friends') || '[]'); } catch {}

  root.innerHTML = `
    <section class="page-head">
      <div><span class="kicker">SOCIAL</span><h1>Amis</h1><p>Ajoute tes amis et retrouve leur présence quand le serveur est connecté.</p></div>
      <button class="btn primary" id="add">＋ Ajouter</button>
    </section>
    <section class="panel">
      <div class="player-list">
        ${friends.length ? friends.map((friend) => `<div class="player"><span class="avatar mini">${initials(friend.name)}</span><div><b>${esc(friend.name)}</b><span>${esc(friend.status || 'Hors ligne')}</span></div></div>`).join('') : '<div class="empty">Aucun ami enregistré.</div>'}
      </div>
    </section>
    ${remoteOnline.length ? `<section class="section"><h2>Présence globale</h2><div class="panel"><div class="online-list">${remoteOnline.map((player) => `<div class="online-row"><i class="online-dot"></i><span>${esc(player.name)}</span><small>${player.room ? 'Dans une room' : 'En ligne'}</small></div>`).join('')}</div></div></section>` : ''}`;

  root.querySelector('#add').addEventListener('click', () => {
    const name = prompt('Pseudo');
    if (!name?.trim()) return;
    friends.push({ name: name.trim().slice(0, 24), status: 'Hors ligne' });
    localStorage.setItem('lifegame:friends', JSON.stringify(friends));
    render();
  });
}

async function createRoom() {
  const game = document.querySelector('#room-game')?.value;
  const name = document.querySelector('#room-name')?.value?.trim() || profile.get().name;
  const max = Number(document.querySelector('#room-max')?.value || 6);
  const privateRoom = Boolean(document.querySelector('#room-private')?.checked);

  if (!game) return;

  profile.update({ name: name.slice(0, 24) });

  if (serverUrl()) {
    const connected = await connectRemote('create', { game, name: name.slice(0, 24), max, privateRoom });
    if (!connected) {
      localRooms.create(game, name, max, privateRoom);
      render();
    }
  } else {
    localRooms.create(game, name, max, privateRoom);
    render();
  }
}

async function joinByCode(forcedCode) {
  const input = document.querySelector('#join-code');
  const code = String(forcedCode || input?.value || '').trim().toUpperCase();
  if (!code) return;

  const localRoom = localRooms.get(code);
  if (localRoom && localRoom.status === 'WAITING') {
    if (localRooms.join(code, profile.get().name)) render();
    else alert('Impossible de rejoindre cette room.');
    return;
  }
  if (serverUrl()) {
    const connected = await connectRemote('join', code);
    if (!connected) alert('Room introuvable ou serveur multiplayer indisponible.');
  } else {
    alert('Room introuvable, verrouillée ou pleine.');
  }
}

async function connectRemote(action, payload) {
  try {
    remoteClient?.close();
    remoteRoom = null;
    remoteChat = [];

    const client = new RoomClient(serverUrl(), (message) => {
      if (message.type === 'room') {
        remoteRoom = message.room;
        render();
      } else if (message.type === 'presence') {
        remoteOnline = message.players || [];
        if (route().name === 'rooms') render();
      } else if (message.type === 'chat') {
        remoteChat.push({ name: message.name, text: message.text });
        if (route().name === 'rooms') render();
      } else if (message.type === 'start') {
        remoteRoom = message.room;
        go('play/' + encodeURIComponent(message.room.gameSlug));
      } else if (message.type === 'kicked') {
        alert(message.reason || 'Tu as été retiré de la room.');
        remoteRoom = null;
        client.close();
        if (remoteClient === client) remoteClient = null;
        render();
      } else if (message.type === 'error') {
        alert(message.message || 'Erreur multiplayer.');
      } else if (message.type === 'disconnected' && route().name === 'rooms') {
        render();
      }
    });

    remoteClient = client;
    await client.connect();

    if (action === 'create') {
      client.create(payload.game, payload.name, payload.max, payload.privateRoom);
    } else {
      client.join(payload, profile.get().name);
    }
    return true;
  } catch (error) {
    console.error('LifeGame remote connection error:', error);
    remoteClient?.close();
    remoteClient = null;
    return false;
  }
}

async function inviteRoom() {
  const code = remoteRoom?.code || localRooms.current();
  if (!code) return;
  const url = location.href.split('#')[0] + '#rooms?join=' + encodeURIComponent(code);
  await copyText(code);
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Rejoins ma room LifeGame', text: 'Room ' + code, url });
    } catch {}
  }
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    alert('Copié : ' + value);
  } catch {
    prompt('Copie le code', value);
  }
}

async function sendChat() {
  const input = document.querySelector('#chat');
  const message = input?.value?.trim();
  if (!message) return;
  if (remoteClient) remoteClient.chat(message);
  else alert('Le chat en direct nécessite le serveur multiplayer.');
  if (input) input.value = '';
}

async function refreshOnline(shouldRender) {
  const result = await onlinePlayers();
  remoteOnline = result.players || [];
  if (shouldRender) render();
}

function openSettings() {
  const current = serverUrl();
  const value = prompt('URL WebSocket LifeGame (ex. wss://ton-serveur.example)', current);
  if (value === null) return;

  setServerUrl(value);
  alert(value.trim() ? 'Serveur enregistré.' : 'Mode local rétabli.');
  render();
}

function render() {
  const root = mountShell();
  const currentRoute = route();

  const routeLinks = root.querySelectorAll('#nav a');
  const navTarget = currentRoute.name === 'home' ? '#home' : (currentRoute.name === 'games' || currentRoute.name === 'game' || currentRoute.name === 'play') ? '#games' : '#'+currentRoute.name;
  routeLinks.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === navTarget));

  switch (currentRoute.name) {
    case 'home':
      home(root);
      break;
    case 'games':
      gamesPage(root, currentRoute.category, currentRoute.search);
      break;
    case 'leaderboards':
      leaderboardsPage(root);
      break;
    case 'game': {
      const game = bySlug(currentRoute.slug);
      if (game) gamePage(root, game);
      else root.innerHTML = '<div class="empty-page"><h1>Jeu introuvable</h1><p>Ce jeu n’existe pas dans le catalogue.</p><a class="btn primary" href="#games">Retour aux jeux</a></div>';
      break;
    }
    case 'play': {
      const game = bySlug(currentRoute.slug);
      if (game) playPage(root, game);
      else root.innerHTML = '<div class="empty-page"><h1>Jeu introuvable</h1><a class="btn primary" href="#games">Retour aux jeux</a></div>';
      break;
    }
    case 'rooms':
      roomsPage(root);
      break;
    case 'profile':
      profilePage(root);
      break;
    case 'friends':
      friendsPage(root);
      break;
    default:
      root.innerHTML = '<div class="empty-page"><h1>404</h1><p>Cette page n’existe pas.</p><a class="btn primary" href="#home">Accueil</a></div>';
  }

  requestAnimationFrame(() => root.focus?.());
}

window.addEventListener('hashchange', render);
window.addEventListener('storage', (event) => {
  if (event.key?.startsWith('lifegame:')) render();
});
window.addEventListener('lifegame:profile', () => {
  if (route().name !== 'play') render();
});
window.addEventListener('lifegame:rooms', () => {
  if (route().name === 'rooms' && !remoteRoom) render();
});

render();
