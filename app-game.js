function parseNominatimResult(r) {
  const a = r.address || {};
  const name = a.city || a.town || a.village || a.hamlet || a.municipality || a.borough || r.name || String(r.display_name||'').split(',')[0];
  const state = a.state || a.region || '';
  const iso = a['ISO3166-2-lvl4'] || a['ISO3166-2-lvl6'] || '';
  const stateCode = iso.startsWith('US-') ? iso.slice(3) : (STATE_ABBR[state] || '');
  return {
    name: String(name || '').trim(),
    state: String(state || '').trim(),
    stateCode,
    lat: Number(r.lat),
    lon: Number(r.lon),
    displayName: r.display_name,
    osmType: r.osm_type,
    osmId: r.osm_id
  };
}

async function geocodePlace(query) {
  const cached = cacheGet(query);
  if (cached?.length) return cached;
  const wait = Math.max(0, 1100 - (Date.now() - lastGeocodeAt));
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  lastGeocodeAt = Date.now();
  const params = new URLSearchParams({format:'jsonv2', q:query, countrycodes:'us', featureType:'settlement', addressdetails:'1', limit:'5', 'accept-language':'en'});
  const response = await fetch(`${GEOCODER_ENDPOINT}?${params.toString()}`, {headers:{'Accept':'application/json'}});
  if (!response.ok) throw new Error(`Place lookup failed (${response.status})`);
  const raw = await response.json();
  const parsed = raw.map(parseNominatimResult).filter(p => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lon));
  const unique = [];
  const seen = new Set();
  for (const p of parsed) {
    const key = `${placeKey(p)}|${p.osmType}${p.osmId}`;
    if (!seen.has(key)) { seen.add(key); unique.push(p); }
  }
  cacheSet(query, unique);
  return unique;
}

function openPlaceChooser(results) {
  els.placeChoices.innerHTML = '';
  results.forEach((place, idx) => {
    const b = document.createElement('button');
    b.type='button'; b.className='place-choice';
    b.innerHTML = `<strong>${escapeHtml(place.name)}${place.stateCode ? `, ${escapeHtml(place.stateCode)}` : ''}</strong><small>${escapeHtml(place.displayName || place.state || 'United States')}</small>`;
    b.addEventListener('click', () => { closePlaceChooser(); submitResolvedPlace(results[idx]); });
    els.placeChoices.appendChild(b);
  });
  els.placeModal.classList.remove('hidden');
}
function closePlaceChooser() { els.placeModal.classList.add('hidden'); }

function updateGameUI() {
  const player = game.players[game.currentIndex] || {name:'Player 1'};
  els.currentPlayerName.textContent = player.name;
  els.turnDot.style.background = PLAYER_COLORS[game.currentIndex % PLAYER_COLORS.length];
  els.turnDot.style.boxShadow = `0 0 14px ${PLAYER_COLORS[game.currentIndex % PLAYER_COLORS.length]}`;
  els.routeCount.textContent = `${game.route.length} ${game.route.length === 1 ? 'place' : 'places'}`;
  els.routeList.innerHTML = game.route.map((p,i) => `<li><span class="route-index">${String(i+1).padStart(2,'0')}</span><span>${escapeHtml(p.name)}${p.stateCode ? `, ${escapeHtml(p.stateCode)}` : ''}</span><span class="route-player">${escapeHtml(game.players[p.playerIndex]?.name || '')}</span></li>`).join('');
  requestAnimationFrame(() => { els.routeList.scrollTop = els.routeList.scrollHeight; });
  const isMyTurn = game.mode !== 'online' || game.currentIndex === game.myPlayerIndex;
  const enabled = !game.finished && isMyTurn && (!game.mode || game.mode !== 'online' || game.connected);
  els.cityInput.disabled = !enabled;
  els.submitCityButton.disabled = !enabled;
  els.cityInput.placeholder = enabled ? 'e.g. Austin, TX' : (game.finished ? 'Round finished' : 'Waiting for opponent…');
  if (game.mode === 'online') {
    els.onlineStatus.classList.remove('hidden');
    els.onlineStatus.textContent = game.connected ? (isMyTurn ? 'Your move' : `Waiting for ${player.name}`) : 'Connection lost';
    els.mapBadgeText.textContent = game.connected ? 'Online room connected' : 'Reconnecting…';
  } else {
    els.onlineStatus.classList.add('hidden');
    els.mapBadgeText.textContent = game.mode === 'solo' ? 'Solo practice' : 'Route ready';
  }
}

function resetGameState(keepPlayers=true) {
  clearTimeout(resultTimer);
  game.route=[]; game.currentIndex=0; game.finished=false; resultPayload=null;
  if (!keepPlayers) game.players=[];
  if (map) { renderMapState(); map.setView([39.2,-98.4],4); }
  els.resultModal.classList.add('hidden');
  updateGameUI();
}

function startGame(mode, players) {
  clearTimeout(resultTimer);
  game.mode = mode;
  game.players = players.map((p,i) => ({name:p.name || `Player ${i+1}`}));
  game.currentIndex=0; game.route=[]; game.finished=false; resultPayload=null;
  showScreen('game');
  initMap();
  updateGameUI();
  setTimeout(() => els.cityInput.focus(), 120);
}

function applyMove(place, playerIndex, {broadcast=true}={}) {
  if (game.finished) return {ok:false, reason:'This round is already over.'};
  if (playerIndex !== game.currentIndex && game.mode !== 'solo') return {ok:false, reason:'It is not that player’s turn.'};
  if (isDuplicate(place)) return {ok:false, reason:`${place.name}${place.stateCode ? `, ${place.stateCode}` : ''} has already been used.`};
  const crossing = crossingForNewSegment(place);
  const stored = {...place, playerIndex, moveNumber:game.route.length+1};
  game.route.push(stored);
  tone(crossing ? 'cross' : 'move');
  if (crossing) {
    game.finished=true;
    resultPayload={loserIndex:playerIndex, intersection:crossing.intersection, crossedSegmentIndex:crossing.crossedSegmentIndex};
  } else if (game.mode !== 'solo') {
    game.currentIndex=(game.currentIndex+1)%game.players.length;
  }
  renderMapState(); updateGameUI();
  if (game.route.length === 1) map.setView([place.lat,place.lon],6);
  else fitRoute();
  if (game.mode === 'online' && game.onlineRole === 'host' && broadcast) sendSync();
  if (crossing) showResult();
  return {ok:true, crossing};
}

function showResult() {
  clearTimeout(resultTimer);
  const loser = game.players[resultPayload?.loserIndex]?.name || 'The player';
  const solo = game.mode === 'solo';
  els.resultIcon.textContent = solo ? '🧭' : '⚡';
  els.resultTitle.textContent = solo ? 'Route crossed' : `${loser} crossed the line`;
  els.resultText.textContent = solo ? `Your practice route lasted ${game.route.length} places before it crossed an earlier segment.` : `${loser} loses the round. The route survived ${game.route.length} places.`;
  els.resultRoute.textContent = game.route.map(p => `${p.name}${p.stateCode ? `, ${p.stateCode}` : ''}`).join(' → ');
  els.resultModal.classList.add('hidden');
  if (resultPayload?.intersection && map) {
    showCrossMarker(resultPayload.intersection);
    map.setView([resultPayload.intersection.lat,resultPayload.intersection.lon], Math.max(map.getZoom(),7), {animate:true});
    showToast('Crossing found — the two intersecting lines are highlighted.', 'error', 2200);
  }
  resultTimer = setTimeout(() => els.resultModal.classList.remove('hidden'), 2400);
}

async function submitResolvedPlace(place) {
  if (game.mode === 'online' && game.currentIndex !== game.myPlayerIndex) return showToast('Wait for your turn.', 'error');
  if (isDuplicate(place)) return showToast(`${place.name}${place.stateCode ? `, ${place.stateCode}` : ''} was already played.`, 'error');
  els.cityInput.value=''; hideSuggestions();
  if (game.mode === 'online' && game.onlineRole === 'guest') {
    els.submitCityButton.disabled=true;
    sendMessage({type:'moveRequest', place, playerIndex:game.myPlayerIndex});
    showToast('Move sent to host…');
    return;
  }
  const result=applyMove(place, game.mode === 'solo' ? 0 : game.currentIndex);
  if (!result.ok) showToast(result.reason,'error');
  else if (!result.crossing) showToast(`${place.name}${place.stateCode ? `, ${place.stateCode}` : ''} added to the route.`);
}

async function onCitySubmit(event) {
  event.preventDefault();
  const query = els.cityInput.value.trim();
  if (!query || game.finished) return;
  if (game.mode === 'online' && game.currentIndex !== game.myPlayerIndex) return showToast('Wait for your turn.','error');
  els.submitCityButton.disabled=true;
  els.submitCityButton.textContent='Finding…';
  try {
    const results = await geocodePlace(query);
    if (!results.length) return showToast(`No U.S. city or town found for “${query}”.`, 'error');
    if (results.length === 1) submitResolvedPlace(results[0]);
    else openPlaceChooser(results);
  } catch (err) {
    console.error(err);
    showToast('City lookup is unavailable right now. Check your connection and try again.', 'error', 4500);
  } finally {
    els.submitCityButton.textContent='Play';
    updateGameUI();
  }
}
