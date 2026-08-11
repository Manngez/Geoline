function updateSuggestions() {
  const q = normalizeText(els.cityInput.value);
  if (q.length < 2 || els.cityInput.disabled) return hideSuggestions();
  const starts = COMMON_PLACES.filter(p => normalizeText(p).startsWith(q));
  const contains = COMMON_PLACES.filter(p => !normalizeText(p).startsWith(q) && normalizeText(p).includes(q));
  const matches = [...starts,...contains].slice(0,7);
  if (!matches.length) return hideSuggestions();
  els.suggestions.innerHTML='';
  matches.forEach(name => {
    const b=document.createElement('button'); b.type='button'; b.className='suggestion-button'; b.textContent=name;
    b.addEventListener('click', () => { els.cityInput.value=name; hideSuggestions(); els.cityInput.focus(); });
    els.suggestions.appendChild(b);
  });
  els.suggestions.classList.remove('hidden');
}
function hideSuggestions() { els.suggestions?.classList.add('hidden'); }

function buildPlayerInputs(names=['Player 1','Player 2']) {
  els.playerInputs.innerHTML='';
  names.forEach((name,i) => addPlayerInput(name,i));
  updatePlayerTools();
}
function addPlayerInput(name='', index=null) {
  const count=els.playerInputs.children.length;
  if (count>=4) return;
  const i=index ?? count;
  const row=document.createElement('div'); row.className='player-input-row';
  row.innerHTML=`<span class="player-number">${i+1}</span><input maxlength="24" value="${escapeHtml(name || `Player ${i+1}`)}" aria-label="Player ${i+1} name"><button class="remove-player" type="button" aria-label="Remove player">×</button>`;
  row.querySelector('.remove-player').addEventListener('click', () => { if (els.playerInputs.children.length>2) { row.remove(); renumberPlayers(); updatePlayerTools(); } });
  els.playerInputs.appendChild(row);
}
function renumberPlayers() { [...els.playerInputs.children].forEach((row,i)=>{row.querySelector('.player-number').textContent=i+1; row.querySelector('input').setAttribute('aria-label',`Player ${i+1} name`);}); }
function updatePlayerTools() { const n=els.playerInputs.children.length; els.playerCountHint.textContent=`${n} of 4 players`; els.addPlayerButton.disabled=n>=4; }
function getLocalPlayers() { return [...els.playerInputs.querySelectorAll('input')].map((input,i)=>({name:input.value.trim() || `Player ${i+1}`})); }

function destroyOnline() {
  try { game.conn?.close(); } catch {}
  try { game.peer?.destroy(); } catch {}
  game.peer=null;game.conn=null;game.connected=false;game.onlineRole=null;game.myPlayerIndex=null;game.roomCode=null;
}
function sendMessage(payload) { if (game.conn?.open) { try { game.conn.send(payload); } catch {} } }
function publicState() { return {players:game.players,currentIndex:game.currentIndex,route:game.route,finished:game.finished,resultPayload}; }
function sendSync() { sendMessage({type:'sync', state:publicState()}); }
function consumeState(s) {
  clearTimeout(resultTimer);
  game.players=s.players||game.players; game.currentIndex=s.currentIndex||0; game.route=s.route||[]; game.finished=!!s.finished; resultPayload=s.resultPayload||null;
  renderMapState(); updateGameUI(); if (game.route.length) fitRoute();
  if (game.finished && resultPayload) showResult(); else els.resultModal.classList.add('hidden');
}
function wireConnection(conn, role) {
  game.conn=conn;
  conn.on('open',()=>{ game.connected=true; updateGameUI(); if(role==='guest') sendMessage({type:'hello',name:game.players[1]?.name||'Guest'}); });
  conn.on('close',()=>{ game.connected=false; updateGameUI(); if ($('gameScreen').classList.contains('active')) showToast('Online connection closed.','error',5000); });
  conn.on('error',()=>{ game.connected=false; updateGameUI(); showToast('Online connection error.','error'); });
  conn.on('data', data => handlePeerData(data,role));
}
function handlePeerData(data, role) {
  if (!data || typeof data!=='object') return;
  if (role==='host') {
    if (data.type==='hello') {
      game.players[1]={name:String(data.name||'Guest').slice(0,24)}; game.connected=true;
      renderHostWaiting(true); sendMessage({type:'welcome',playerIndex:1,state:publicState()});
    } else if (data.type==='moveRequest') {
      if (data.playerIndex!==1) return;
      const result=applyMove(data.place,1);
      if (!result.ok) sendMessage({type:'moveRejected',reason:result.reason});
    } else if (data.type==='resetRequest') {
      resetGameState(true); sendMessage({type:'reset',state:publicState()});
    }
  } else {
    if (data.type==='welcome') { game.myPlayerIndex=data.playerIndex; if(data.state) consumeState(data.state); }
    else if (data.type==='start') { consumeState(data.state); showScreen('game'); initMap(); updateGameUI(); }
    else if (data.type==='sync') consumeState(data.state);
    else if (data.type==='moveRejected') { showToast(data.reason||'Move rejected by host.','error'); updateGameUI(); }
    else if (data.type==='reset') { consumeState(data.state); els.resultModal.classList.add('hidden'); }
  }
}

function renderHostForm() {
  els.onlineEyebrow.textContent='Host online'; els.onlineTitle.textContent='Create a room';
  els.onlinePanel.innerHTML=`<div class="online-field"><label for="hostName">Your name</label><input id="hostName" maxlength="24" value="Player 1" /></div><button id="createRoomButton" class="primary-button wide" type="button">Create room →</button><p class="form-hint">Geoline uses a direct peer-to-peer connection for the game state. Share only the temporary room code with the person you want to play.</p>`;
  $('createRoomButton').addEventListener('click', createOnlineRoom);
}
function renderHostWaiting(connected=false) {
  els.onlinePanel.innerHTML=`<div class="room-code-display"><div><div class="eyebrow">Room code</div><strong>${escapeHtml(game.roomCode||'------')}</strong></div><button id="copyRoomButton" class="secondary-button" type="button">Copy code</button></div><div class="connection-pill ${connected?'connected':''}">${connected ? `${escapeHtml(game.players[1]?.name||'Opponent')} connected` : 'Waiting for opponent…'}</div><button id="startOnlineButton" class="primary-button wide" type="button" ${connected?'':'disabled'}>Start game →</button><p class="form-hint">The room exists only while this page stays open. No Geoline account is required.</p>`;
  $('copyRoomButton').addEventListener('click', async()=>{ try { await navigator.clipboard.writeText(game.roomCode); $('copyRoomButton').textContent='Copied!'; } catch { showToast(`Room code: ${game.roomCode}`); } });
  $('startOnlineButton').addEventListener('click',()=>{ startGame('online',game.players); game.onlineRole='host'; game.myPlayerIndex=0; game.connected=true; sendMessage({type:'start',state:publicState()}); });
}
function createOnlineRoom() {
  if (!window.Peer) return showToast('Online library failed to load. Check your connection.','error');
  destroyOnline();
  const hostName=String($('hostName').value||'Player 1').trim().slice(0,24) || 'Player 1';
  game.mode='online'; game.onlineRole='host'; game.myPlayerIndex=0; game.players=[{name:hostName},{name:'Opponent'}]; game.roomCode=randomCode();
  renderHostWaiting(false);
  const peer=new Peer(ROOM_PREFIX+game.roomCode.toLowerCase()); game.peer=peer;
  peer.on('open',()=>{});
  peer.on('connection',conn=>{ if(game.conn?.open){conn.close();return;} wireConnection(conn,'host'); });
  peer.on('error',err=>{ console.error(err); showToast(err.type==='unavailable-id'?'Room code collision. Go back and create a new room.':'Could not create online room.','error',5000); });
}
function renderJoinForm() {
  els.onlineEyebrow.textContent='Join online'; els.onlineTitle.textContent='Enter a room code';
  els.onlinePanel.innerHTML=`<div class="online-field"><label for="joinName">Your name</label><input id="joinName" maxlength="24" value="Player 2" /></div><div class="online-field"><label for="roomCodeInput">Six-character room code</label><input id="roomCodeInput" inputmode="text" maxlength="6" autocomplete="off" placeholder="ABC123" style="text-transform:uppercase;letter-spacing:.16em;font-weight:900" /></div><button id="joinRoomButton" class="primary-button wide" type="button">Join room →</button><div id="joinConnectionStatus" class="connection-pill hidden">Connecting…</div>`;
  $('joinRoomButton').addEventListener('click', joinOnlineRoom);
}
function joinOnlineRoom() {
  const code=String($('roomCodeInput').value||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(code.length!==6) return showToast('Enter the six-character room code.','error');
  if(!window.Peer) return showToast('Online library failed to load.','error');
  destroyOnline(); game.mode='online'; game.onlineRole='guest';game.myPlayerIndex=1;game.roomCode=code;
  const guestName=String($('joinName').value||'Player 2').trim().slice(0,24)||'Player 2'; game.players=[{name:'Host'},{name:guestName}];
  $('joinRoomButton').disabled=true; $('joinConnectionStatus').classList.remove('hidden');
  const peer=new Peer();game.peer=peer;
  peer.on('open',()=>{ const conn=peer.connect(ROOM_PREFIX+code.toLowerCase(),{reliable:true}); wireConnection(conn,'guest'); });
  peer.on('error',err=>{ console.error(err); $('joinRoomButton').disabled=false; $('joinConnectionStatus').textContent='Could not connect'; showToast('Could not join that room. Check the code and try again.','error',5000); });
}

function openOnline(mode) { showScreen('online'); if(mode==='host') renderHostForm(); else renderJoinForm(); }

function bindEvents() {
  document.querySelectorAll('[data-screen]').forEach(btn=>btn.addEventListener('click',()=>showScreen(btn.dataset.screen)));
  document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{
    const mode=btn.dataset.mode;
    if(mode==='local'){ buildPlayerInputs(); showScreen('players'); }
    else if(mode==='solo'){ game.onlineRole=null;game.myPlayerIndex=0;startGame('solo',[{name:'Explorer'}]); }
    else openOnline(mode);
  }));
  els.addPlayerButton.addEventListener('click',()=>{ addPlayerInput();renumberPlayers();updatePlayerTools(); });
  els.startLocalButton.addEventListener('click',()=>{ destroyOnline(); startGame('local',getLocalPlayers()); });
  els.cityForm.addEventListener('submit',onCitySubmit);
  els.cityInput.addEventListener('input',updateSuggestions);
  els.cityInput.addEventListener('keydown',e=>{ if(e.key==='Escape')hideSuggestions(); });
  document.addEventListener('click',e=>{ if(!els.cityForm.contains(e.target)) hideSuggestions(); });
  els.fitRouteButton.addEventListener('click',fitRoute);
  els.quitGameButton.addEventListener('click',()=>{ destroyOnline(); resetGameState(false); showScreen('setup'); });
  els.cancelPlaceModal.addEventListener('click',closePlaceChooser);
  els.placeModal.addEventListener('click',e=>{if(e.target===els.placeModal)closePlaceChooser();});
  els.playAgainButton.addEventListener('click',()=>{
    if(game.mode==='online' && game.onlineRole==='guest'){ sendMessage({type:'resetRequest'}); els.resultModal.classList.add('hidden'); return; }
    resetGameState(true); if(game.mode==='online' && game.onlineRole==='host') sendMessage({type:'reset',state:publicState()});
  });
  els.resultHomeButton.addEventListener('click',()=>{ els.resultModal.classList.add('hidden'); destroyOnline(); resetGameState(false); showScreen('home'); });
  els.soundToggle.addEventListener('click',()=>{ game.sound=!game.sound; localStorage.setItem('geoline:sound',game.sound?'on':'off');updateSoundButton();tone('move'); });
  window.addEventListener('resize',()=>{ if(map) setTimeout(()=>map.invalidateSize(),80); });
}

function init() {
  ['soundToggle','playerInputs','addPlayerButton','playerCountHint','startLocalButton','onlineEyebrow','onlineTitle','onlinePanel','cityForm','cityInput','submitCityButton','suggestions','routeCount','routeList','currentPlayerName','turnDot','onlineStatus','fitRouteButton','quitGameButton','mapBadgeText','toast','placeModal','placeChoices','cancelPlaceModal','resultModal','resultIcon','resultTitle','resultText','resultRoute','playAgainButton','resultHomeButton'].forEach(id=>els[id]=$(id));
  updateSoundButton(); bindEvents(); buildPlayerInputs();
}

document.addEventListener('DOMContentLoaded',init);
