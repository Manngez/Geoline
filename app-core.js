'use strict';

const PLAYER_COLORS = ['#54f1ff', '#ff4f9a', '#ffd166', '#59f7a4'];
const GEOCODER_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const CACHE_PREFIX = 'geoline:geocode:';
const ROOM_PREFIX = 'geoline-';

const STATE_ABBR = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY','District of Columbia':'DC','Puerto Rico':'PR'
};

const COMMON_PLACES = [
  'New York, NY','Los Angeles, CA','Chicago, IL','Houston, TX','Phoenix, AZ','Philadelphia, PA','San Antonio, TX','San Diego, CA','Dallas, TX','Jacksonville, FL','Fort Worth, TX','Austin, TX','San Jose, CA','Columbus, OH','Charlotte, NC','Indianapolis, IN','San Francisco, CA','Seattle, WA','Denver, CO','Washington, DC','Nashville, TN','Oklahoma City, OK','El Paso, TX','Boston, MA','Portland, OR','Las Vegas, NV','Detroit, MI','Memphis, TN','Louisville, KY','Baltimore, MD','Milwaukee, WI','Albuquerque, NM','Tucson, AZ','Fresno, CA','Sacramento, CA','Atlanta, GA','Mesa, AZ','Kansas City, MO','Raleigh, NC','Colorado Springs, CO','Omaha, NE','Miami, FL','Virginia Beach, VA','Oakland, CA','Minneapolis, MN','Tulsa, OK','Bakersfield, CA','Wichita, KS','Arlington, TX','Aurora, CO','Tampa, FL','New Orleans, LA','Cleveland, OH','Honolulu, HI','Anaheim, CA','Lexington, KY','Stockton, CA','Corpus Christi, TX','Henderson, NV','Riverside, CA','Newark, NJ','Saint Paul, MN','Santa Ana, CA','Cincinnati, OH','Irvine, CA','Orlando, FL','Pittsburgh, PA','St. Louis, MO','Greensboro, NC','Jersey City, NJ','Anchorage, AK','Lincoln, NE','Plano, TX','Durham, NC','Buffalo, NY','Chandler, AZ','Chula Vista, CA','Toledo, OH','Madison, WI','Gilbert, AZ','Reno, NV','Fort Wayne, IN','North Las Vegas, NV','St. Petersburg, FL','Lubbock, TX','Irving, TX','Laredo, TX','Winston-Salem, NC','Chesapeake, VA','Glendale, AZ','Garland, TX','Scottsdale, AZ','Norfolk, VA','Boise, ID','Richmond, VA','Spokane, WA','Baton Rouge, LA','Tacoma, WA','San Bernardino, CA','Huntsville, AL','Salt Lake City, UT','Fremont, CA','Des Moines, IA','Yonkers, NY','Rochester, NY','Little Rock, AR','Tallahassee, FL','Montgomery, AL','Juneau, AK','Dover, DE','Hartford, CT','Trenton, NJ','Annapolis, MD','Augusta, ME','Concord, NH','Providence, RI','Montpelier, VT','Charleston, WV','Frankfort, KY','Columbia, SC','Jackson, MS','Jefferson City, MO','Topeka, KS','Pierre, SD','Bismarck, ND','Helena, MT','Cheyenne, WY','Santa Fe, NM','Carson City, NV','Salem, OR','Olympia, WA','Harrisburg, PA','Albany, NY','Lansing, MI','Springfield, IL','Madison, WI','Saint Paul, MN','Des Moines, IA','Indianapolis, IN','Nashville, TN','Raleigh, NC','Richmond, VA','Atlanta, GA','Tallahassee, FL','Austin, TX','Oklahoma City, OK','Denver, CO','Phoenix, AZ','Sacramento, CA','Boise, ID','Salt Lake City, UT','Columbus, OH','Boston, MA','Concord, NH','Portland, ME','Burlington, VT','Savannah, GA','Charleston, SC','Key West, FL','Daytona Beach, FL','Asheville, NC','Knoxville, TN','Chattanooga, TN','Birmingham, AL','Mobile, AL','Biloxi, MS','Shreveport, LA','Galveston, TX','Waco, TX','Amarillo, TX','Santa Fe, NM','Flagstaff, AZ','Palm Springs, CA','Santa Barbara, CA','Monterey, CA','Eureka, CA','Bend, OR','Eugene, OR','Bellingham, WA','Yakima, WA','Coeur d’Alene, ID','Missoula, MT','Bozeman, MT','Jackson, WY','Rapid City, SD','Fargo, ND','Duluth, MN','Green Bay, WI','Traverse City, MI','South Bend, IN','Dayton, OH','Erie, PA','Syracuse, NY','Burlington, VT','Portsmouth, NH','Worcester, MA','New Haven, CT','Atlantic City, NJ','Wilmington, DE','Ocean City, MD','Alexandria, VA','Myrtle Beach, SC','Gatlinburg, TN','Hot Springs, AR','Branson, MO','Lawrence, KS','Lincoln, NE','Sioux Falls, SD','Grand Forks, ND','Billings, MT','Casper, WY','Pocatello, ID','Provo, UT','Sedona, AZ','Taos, NM','Aspen, CO','Vail, CO','Santa Fe, NM','Marfa, TX','Fredericksburg, TX','Natchez, MS','Lafayette, LA','Pensacola, FL','Naples, FL','St. Augustine, FL','Hilton Head Island, SC','Williamsburg, VA','Gettysburg, PA','Bar Harbor, ME','Nantucket, MA','Newport, RI','Lake Placid, NY','Niagara Falls, NY','Mackinac Island, MI','Wisconsin Dells, WI','Dodge City, KS','Deadwood, SD','Tombstone, AZ','Telluride, CO','Moab, UT','Ketchikan, AK','Fairbanks, AK','Hilo, HI','Kailua-Kona, HI'
];

const els = {};
let map = null;
let mapLayers = [];
let crossLayer = null;
let lastGeocodeAt = 0;
let toastTimer = null;
let resultTimer = null;
let resultPayload = null;

const game = {
  mode: null,
  players: [],
  currentIndex: 0,
  route: [],
  finished: false,
  onlineRole: null,
  myPlayerIndex: null,
  roomCode: null,
  peer: null,
  conn: null,
  connected: false,
  sound: localStorage.getItem('geoline:sound') !== 'off'
};

function $(id) { return document.getElementById(id); }
function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function normalizeText(value='') { return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' '); }
function randomCode() { return Math.random().toString(36).slice(2,8).toUpperCase(); }

function cacheGet(query) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + normalizeText(query));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.ts || Date.now() - parsed.ts > 1000 * 60 * 60 * 24 * 30) return null;
    return parsed.results;
  } catch { return null; }
}
function cacheSet(query, results) {
  try { localStorage.setItem(CACHE_PREFIX + normalizeText(query), JSON.stringify({ts:Date.now(), results})); } catch {}
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = $(`${name}Screen`);
  if (target) target.classList.add('active');
  document.body.classList.toggle('in-game', name === 'game');
  window.scrollTo({top:0, behavior:'smooth'});
  if (name !== 'game') hideSuggestions();
}

function tone(kind='move') {
  if (!game.sound) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = kind === 'cross' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(kind === 'cross' ? 210 : 430, now);
    if (kind === 'move') osc.frequency.exponentialRampToValueAtTime(680, now + .11);
    else osc.frequency.exponentialRampToValueAtTime(95, now + .38);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.08, now + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, now + (kind === 'cross' ? .42 : .16));
    osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + (kind === 'cross' ? .44 : .18));
    setTimeout(() => ctx.close(), 600);
  } catch {}
}

function updateSoundButton() {
  els.soundToggle.textContent = game.sound ? '🔊' : '🔇';
  els.soundToggle.setAttribute('aria-label', game.sound ? 'Mute sound' : 'Enable sound');
}

function showToast(message, type='info', ms=3200) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.remove('hidden','error');
  if (type === 'error') els.toast.classList.add('error');
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), ms);
}

function initMap() {
  if (!map) {
    map = L.map('map', {zoomControl:true, minZoom:2, worldCopyJump:true}).setView([39.2,-98.4], 4);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
  }
  setTimeout(() => map.invalidateSize(), 80);
  renderMapState();
}

function clearRouteLayers() {
  mapLayers.forEach(layer => { try { map.removeLayer(layer); } catch {} });
  mapLayers = [];
  if (crossLayer) { try { map.removeLayer(crossLayer); } catch {} crossLayer = null; }
}

function markerIcon(color) {
  return L.divIcon({className:'', html:`<div class="city-marker" style="--marker:${color}"></div>`, iconSize:[18,18], iconAnchor:[9,9]});
}

function renderMapState() {
  if (!map) return;
  clearRouteLayers();
  game.route.forEach((place, idx) => {
    const color = PLAYER_COLORS[place.playerIndex % PLAYER_COLORS.length];
    const marker = L.marker([place.lat, place.lon], {icon: markerIcon(color)}).addTo(map);
    marker.bindTooltip(`${escapeHtml(place.name)}, ${escapeHtml(place.stateCode || place.state || '')}`, {direction:'top', className:'city-label', offset:[0,-8]});
    mapLayers.push(marker);
    if (idx > 0) {
      const prev = game.route[idx-1];
      const line = L.polyline([[prev.lat, prev.lon],[place.lat,place.lon]], {color, weight:5, opacity:.92, lineCap:'round'}).addTo(map);
      mapLayers.push(line);
    }
  });
  if (resultPayload?.intersection) showCrossMarker(resultPayload.intersection);
}

function showCrossMarker(intersection) {
  if (!map || !intersection) return;
  if (crossLayer) { try { map.removeLayer(crossLayer); } catch {} }
  const layers = [];
  const crossedIndex = resultPayload?.crossedSegmentIndex;
  if (Number.isInteger(crossedIndex) && game.route.length >= 2) {
    const crossedStart = game.route[crossedIndex];
    const crossedEnd = game.route[crossedIndex + 1];
    const newStart = game.route[game.route.length - 2];
    const newEnd = game.route[game.route.length - 1];
    if (crossedStart && crossedEnd) {
      layers.push(L.polyline([[crossedStart.lat,crossedStart.lon],[crossedEnd.lat,crossedEnd.lon]], {className:'crossed-route-line', color:'#ffd166', weight:10, opacity:.95, lineCap:'round', interactive:false}));
    }
    if (newStart && newEnd) {
      layers.push(L.polyline([[newStart.lat,newStart.lon],[newEnd.lat,newEnd.lon]], {className:'crossing-route-line', color:'#ff4f9a', weight:10, opacity:.95, lineCap:'round', interactive:false}));
    }
  }
  const icon = L.divIcon({className:'', html:'<div class="cross-marker">×</div>', iconSize:[28,28], iconAnchor:[14,14]});
  layers.push(L.marker([intersection.lat, intersection.lon], {icon, interactive:false}));
  crossLayer = L.layerGroup(layers).addTo(map);
}

function fitRoute() {
  if (!map) return;
  if (game.route.length < 2) { map.setView(game.route[0] ? [game.route[0].lat,game.route[0].lon] : [39.2,-98.4], game.route[0] ? 7 : 4); return; }
  map.fitBounds(L.latLngBounds(game.route.map(p => [p.lat,p.lon])), {padding:[45,45], maxZoom:7});
}

function project(p) {
  const lat = Math.max(-85, Math.min(85, p.lat)) * Math.PI / 180;
  return {x:p.lon, y:Math.log(Math.tan(Math.PI/4 + lat/2))};
}

function intersectionOf(a,b,c,d) {
  const A=project(a), B=project(b), C=project(c), D=project(d);
  const r={x:B.x-A.x,y:B.y-A.y}, s={x:D.x-C.x,y:D.y-C.y};
  const den=r.x*s.y-r.y*s.x;
  if (Math.abs(den) < 1e-12) return null;
  const q={x:C.x-A.x,y:C.y-A.y};
  const t=(q.x*s.y-q.y*s.x)/den;
  const u=(q.x*r.y-q.y*r.x)/den;
  const eps=1e-9;
  if (t <= eps || t >= 1-eps || u < -eps || u > 1+eps) return null;
  const y=A.y+t*r.y;
  const lat=(2*Math.atan(Math.exp(y))-Math.PI/2)*180/Math.PI;
  const lon=A.x+t*r.x;
  return {lat,lon,t,u};
}

function crossingForNewSegment(newPlace) {
  if (game.route.length < 3) return null;
  const start = game.route[game.route.length-1];
  for (let i=0; i<game.route.length-2; i++) {
    const hit = intersectionOf(start, newPlace, game.route[i], game.route[i+1]);
    if (hit) return {intersection:{lat:hit.lat,lon:hit.lon}, crossedSegmentIndex:i};
  }
  return null;
}

function placeKey(place) {
  const state = place.stateCode || place.state || '';
  return `${normalizeText(place.name)}|${normalizeText(state)}`;
}

function isDuplicate(place) { return game.route.some(p => placeKey(p) === placeKey(place)); }
