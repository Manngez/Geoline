// Geoline settlement eligibility filter.
// Keeps real populated places playable while rejecting counties and other admin-only results.

const GEOLINE_SETTLEMENT_CACHE_PREFIX = 'geoline:geocode:settlements-v2:';
const GEOLINE_ALLOWED_PLACE_TYPES = new Set(['city', 'town', 'village', 'hamlet', 'municipality']);

function geolineSettlementCacheGet(query) {
  try {
    const raw = localStorage.getItem(GEOLINE_SETTLEMENT_CACHE_PREFIX + normalizeText(query));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.ts || Date.now() - parsed.ts > 1000 * 60 * 60 * 24 * 30) return null;
    return parsed.results;
  } catch { return null; }
}

function geolineSettlementCacheSet(query, results) {
  try {
    localStorage.setItem(
      GEOLINE_SETTLEMENT_CACHE_PREFIX + normalizeText(query),
      JSON.stringify({ts: Date.now(), results})
    );
  } catch {}
}

function geolineIsPlayableSettlement(raw, address, rawName) {
  const category = String(raw.category || '').toLowerCase();
  const type = String(raw.type || '').toLowerCase();
  const normalizedName = normalizeText(rawName);
  const countyName = normalizeText(address.county || '');
  const settlementName = address.city || address.town || address.village || address.hamlet || address.municipality || '';
  const normalizedSettlement = normalizeText(settlementName);

  const isCounty = type === 'county' || /(^| )county($| )/.test(normalizedName) || (countyName && normalizedName === countyName);
  if (isCounty) return false;

  const isExplicitPlace = category === 'place' && GEOLINE_ALLOWED_PLACE_TYPES.has(type);
  const matchesSettlementAddress = normalizedSettlement && normalizedName === normalizedSettlement;

  // Administrative boundaries are accepted only when they clearly represent the same
  // city/town/village/hamlet/municipality named in the address data.
  if (category === 'boundary' && type === 'administrative') return Boolean(matchesSettlementAddress);

  return Boolean(isExplicitPlace || matchesSettlementAddress);
}

parseNominatimResult = function parseNominatimResultFiltered(r) {
  const a = r.address || {};
  const rawName = String(r.name || String(r.display_name || '').split(',')[0] || '').trim();
  if (!rawName || !geolineIsPlayableSettlement(r, a, rawName)) return null;

  const settlementName = a.city || a.town || a.village || a.hamlet || a.municipality || rawName;
  const state = a.state || a.region || '';
  const iso = a['ISO3166-2-lvl4'] || a['ISO3166-2-lvl6'] || '';
  const stateCode = iso.startsWith('US-') ? iso.slice(3) : (STATE_ABBR[state] || '');

  return {
    name: String(settlementName || rawName).trim(),
    state: String(state || '').trim(),
    stateCode,
    lat: Number(r.lat),
    lon: Number(r.lon),
    displayName: r.display_name,
    osmType: r.osm_type,
    osmId: r.osm_id,
    category: r.category || '',
    placeType: r.type || ''
  };
};

geocodePlace = async function geocodePlayablePlace(query) {
  const cached = geolineSettlementCacheGet(query);
  if (cached?.length) return cached;

  const wait = Math.max(0, 1100 - (Date.now() - lastGeocodeAt));
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  lastGeocodeAt = Date.now();

  const params = new URLSearchParams({
    format: 'jsonv2',
    q: query,
    countrycodes: 'us',
    featureType: 'settlement',
    addressdetails: '1',
    limit: '8',
    'accept-language': 'en'
  });
  const response = await fetch(`${GEOCODER_ENDPOINT}?${params.toString()}`, {headers: {'Accept': 'application/json'}});
  if (!response.ok) throw new Error(`Place lookup failed (${response.status})`);

  const raw = await response.json();
  const parsed = raw
    .map(parseNominatimResult)
    .filter(p => p && p.name && Number.isFinite(p.lat) && Number.isFinite(p.lon));

  // One playable place per city/town + state, even if OSM returns both a point and a boundary.
  const unique = [];
  const seen = new Set();
  for (const p of parsed) {
    const key = placeKey(p);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  }

  geolineSettlementCacheSet(query, unique);
  return unique;
};

const geolineOriginalOnCitySubmit = onCitySubmit;
onCitySubmit = async function onCitySubmitFiltered(event) {
  const query = els.cityInput?.value?.trim() || '';
  if (/(^|\s)county(\s|$)/i.test(query)) {
    event.preventDefault();
    showToast('Counties are not playable. Try a city or town instead.', 'error', 4200);
    updateGameUI();
    return;
  }
  return geolineOriginalOnCitySubmit(event);
};
