'use strict';

// Broader place search for Geoline.
// Local suggestions stay instant, while pressing Play searches all enabled countries.
(function () {
  const SEARCH_CACHE_PREFIX = 'geoline:place-search-v4:';
  const ALLOWED_SETTLEMENT_TYPES = new Set([
    'city', 'town', 'village', 'hamlet', 'municipality', 'borough', 'locality'
  ]);
  const BLOCKED_ADDRESS_TYPES = new Set([
    'county', 'state', 'province', 'region', 'state_district', 'country'
  ]);
  const BLOCKED_NAME_WORDS = /\b(county|parish|census area|borough government|regional district)\b/i;

  const CANADA_PROVINCES = {
    'Alberta':'AB','British Columbia':'BC','Manitoba':'MB','New Brunswick':'NB',
    'Newfoundland and Labrador':'NL','Northwest Territories':'NT','Nova Scotia':'NS',
    'Nunavut':'NU','Ontario':'ON','Prince Edward Island':'PE','Quebec':'QC',
    'Québec':'QC','Saskatchewan':'SK','Yukon':'YT'
  };

  const US_STATES_BY_CODE = Object.fromEntries(
    Object.entries(STATE_ABBR).map(([name, code]) => [String(code).toUpperCase(), name])
  );
  const CANADA_PROVINCES_BY_CODE = Object.fromEntries(
    Object.entries(CANADA_PROVINCES).map(([name, code]) => [String(code).toUpperCase(), name])
  );

  function selectedCountries() {
    const selected = Array.isArray(game.countries) ? game.countries : ['us'];
    const clean = [...new Set(selected.map(v => String(v).toLowerCase()).filter(v => v === 'us' || v === 'ca'))];
    return clean.length ? clean : ['us'];
  }

  function parseQueryHints(query) {
    const raw = String(query || '').trim();
    const compact = raw.replace(/\s+/g, ' ');
    const match = compact.match(/^(.+?)(?:,\s*|\s+)([A-Za-z]{2})$/);
    if (!match) return { raw: compact, city: compact, regionCode: '', regionName: '', countryCode: '' };

    const city = match[1].trim();
    const regionCode = match[2].toUpperCase();
    if (US_STATES_BY_CODE[regionCode] && selectedCountries().includes('us')) {
      return { raw: compact, city, regionCode, regionName: US_STATES_BY_CODE[regionCode], countryCode: 'us' };
    }
    if (CANADA_PROVINCES_BY_CODE[regionCode] && selectedCountries().includes('ca')) {
      return { raw: compact, city, regionCode, regionName: CANADA_PROVINCES_BY_CODE[regionCode], countryCode: 'ca' };
    }
    return { raw: compact, city: compact, regionCode: '', regionName: '', countryCode: '' };
  }

  function searchCacheKey(query) {
    return SEARCH_CACHE_PREFIX + selectedCountries().sort().join('-') + ':' + normalizeText(query);
  }

  function searchCacheGet(query) {
    try {
      const raw = localStorage.getItem(searchCacheKey(query));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed.ts || Date.now() - parsed.ts > 1000 * 60 * 60 * 24 * 30) return null;
      return Array.isArray(parsed.results) ? parsed.results : null;
    } catch { return null; }
  }

  function searchCacheSet(query, results) {
    try {
      localStorage.setItem(searchCacheKey(query), JSON.stringify({ts:Date.now(), results}));
    } catch {}
  }

  function normalizedValues(address) {
    return [
      address.city, address.town, address.village, address.hamlet,
      address.municipality, address.borough, address.locality
    ].filter(Boolean).map(normalizeText);
  }

  function rawRegionCode(raw) {
    const a = raw.address || {};
    const countryCode = String(a.country_code || '').toLowerCase();
    const iso = a['ISO3166-2-lvl4'] || a['ISO3166-2-lvl6'] || a['ISO3166-2-lvl3'] || '';
    if (iso.startsWith('US-') || iso.startsWith('CA-')) return iso.slice(3).toUpperCase();
    const state = a.state || a.region || '';
    if (countryCode === 'ca') return String(CANADA_PROVINCES[state] || '').toUpperCase();
    return String(STATE_ABBR[state] || '').toUpperCase();
  }

  function matchesQueryRegion(raw, hints) {
    if (!hints.regionCode) return true;
    return rawRegionCode(raw) === hints.regionCode;
  }

  function isExpandedPlayableSettlement(raw, hints) {
    const address = raw.address || {};
    const category = String(raw.category || raw.class || '').toLowerCase();
    const type = String(raw.type || '').toLowerCase();
    const addressType = String(raw.addresstype || '').toLowerCase();
    const rawName = String(raw.name || String(raw.display_name || '').split(',')[0] || '').trim();
    const nameKey = normalizeText(rawName);
    const countyKey = normalizeText(address.county || '');

    if (!rawName) return false;
    if (type === 'county' || addressType === 'county') return false;
    if (countyKey && nameKey === countyKey) return false;
    if (BLOCKED_ADDRESS_TYPES.has(addressType)) return false;
    if (BLOCKED_NAME_WORDS.test(rawName) && !ALLOWED_SETTLEMENT_TYPES.has(addressType)) return false;
    if (!matchesQueryRegion(raw, hints)) return false;

    if (ALLOWED_SETTLEMENT_TYPES.has(addressType)) return true;
    if (category === 'place' && ALLOWED_SETTLEMENT_TYPES.has(type)) return true;

    const addressNames = normalizedValues(address);
    if (addressNames.includes(nameKey)) return true;

    const requestedCity = normalizeText(hints.city || '');
    const exactRequestedName = requestedCity && nameKey === requestedCity;
    if (category === 'boundary' && type === 'administrative') {
      if (addressNames.includes(nameKey)) return true;
      if (exactRequestedName && matchesQueryRegion(raw, hints)) return true;
    }

    return false;
  }

  function parseExpandedResult(raw, hints) {
    if (!isExpandedPlayableSettlement(raw, hints)) return null;
    const a = raw.address || {};
    const rawName = String(raw.name || String(raw.display_name || '').split(',')[0] || '').trim();
    const name = a.city || a.town || a.village || a.hamlet || a.municipality || a.borough || a.locality || rawName;
    const state = a.state || a.region || '';
    const countryCode = String(a.country_code || '').toLowerCase();
    const stateCode = rawRegionCode(raw);

    return {
      name: String(name || rawName).trim(),
      state: String(state || '').trim(),
      stateCode,
      countryCode,
      lat: Number(raw.lat),
      lon: Number(raw.lon),
      displayName: raw.display_name,
      osmType: raw.osm_type,
      osmId: raw.osm_id,
      category: raw.category || '',
      placeType: raw.type || '',
      addressType: raw.addresstype || ''
    };
  }

  async function waitForGeocoder() {
    const wait = Math.max(0, 1100 - (Date.now() - lastGeocodeAt));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    lastGeocodeAt = Date.now();
  }

  async function nominatimFreeTextRequest(query, useSettlementFilter) {
    await waitForGeocoder();
    const params = new URLSearchParams({
      format:'jsonv2',
      q:query,
      countrycodes:selectedCountries().join(','),
      addressdetails:'1',
      namedetails:'1',
      limit:'20',
      'accept-language':'en'
    });
    if (useSettlementFilter) params.set('featureType', 'settlement');

    const response = await fetch(`${GEOCODER_ENDPOINT}?${params.toString()}`, {headers:{'Accept':'application/json'}});
    if (!response.ok) throw new Error(`Place lookup failed (${response.status})`);
    return response.json();
  }

  async function nominatimStructuredRequest(hints) {
    if (!hints.city || !hints.regionName) return [];
    await waitForGeocoder();

    const countries = hints.countryCode ? [hints.countryCode] : selectedCountries();
    const params = new URLSearchParams({
      format:'jsonv2',
      city:hints.city,
      state:hints.regionName,
      countrycodes:countries.join(','),
      addressdetails:'1',
      namedetails:'1',
      limit:'20',
      'accept-language':'en'
    });
    const response = await fetch(`${GEOCODER_ENDPOINT}?${params.toString()}`, {headers:{'Accept':'application/json'}});
    if (!response.ok) throw new Error(`Place lookup failed (${response.status})`);
    return response.json();
  }

  function dedupeAndRank(rawResults, query) {
    const hints = parseQueryHints(query);
    const queryCore = normalizeText(hints.city);
    const parsed = rawResults
      .map(raw => parseExpandedResult(raw, hints))
      .filter(p => p && p.name && Number.isFinite(p.lat) && Number.isFinite(p.lon));

    const unique = [];
    const seen = new Set();
    for (const place of parsed) {
      const key = `${placeKey(place)}|${place.countryCode || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(place);
      }
    }

    unique.sort((a, b) => {
      const aName = normalizeText(a.name);
      const bName = normalizeText(b.name);
      const aExact = aName === queryCore ? 0 : (aName.startsWith(queryCore) ? 1 : 2);
      const bExact = bName === queryCore ? 0 : (bName.startsWith(queryCore) ? 1 : 2);
      const aRegion = hints.regionCode && a.stateCode === hints.regionCode ? 0 : 1;
      const bRegion = hints.regionCode && b.stateCode === hints.regionCode ? 0 : 1;
      return aRegion - bRegion || aExact - bExact;
    });
    return unique.slice(0, 10);
  }

  geocodePlace = async function geocodePlaceExpanded(query) {
    const cached = searchCacheGet(query);
    if (cached) return cached;

    const hints = parseQueryHints(query);
    const firstRaw = await nominatimFreeTextRequest(query, true);
    let combinedRaw = [...firstRaw];
    let results = dedupeAndRank(combinedRaw, query);

    const queryCore = normalizeText(hints.city);
    let hasStrongMatch = results.some(place =>
      normalizeText(place.name) === queryCore &&
      (!hints.regionCode || place.stateCode === hints.regionCode)
    );

    if (!hasStrongMatch && hints.regionCode) {
      const structuredRaw = await nominatimStructuredRequest(hints);
      combinedRaw.push(...structuredRaw);
      results = dedupeAndRank(combinedRaw, query);
      hasStrongMatch = results.some(place =>
        normalizeText(place.name) === queryCore &&
        place.stateCode === hints.regionCode
      );
    }

    if (!hasStrongMatch) {
      const fallbackRaw = await nominatimFreeTextRequest(query, false);
      combinedRaw.push(...fallbackRaw);
      results = dedupeAndRank(combinedRaw, query);
    }

    searchCacheSet(query, results);
    return results;
  };

  const previousSuggestions = updateSuggestions;
  updateSuggestions = function updateSuggestionsWithFullSearch() {
    previousSuggestions();
    const rawQuery = String(els.cityInput?.value || '').trim();
    const q = normalizeText(rawQuery);
    if (q.length < 2 || els.cityInput?.disabled || !els.suggestions) return;

    if (!els.suggestions.querySelector('.search-all-places')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'suggestion-button search-all-places';
      button.textContent = `⌕ Search all cities & towns for “${rawQuery}”`;
      button.addEventListener('click', () => {
        hideSuggestions();
        if (typeof els.cityForm.requestSubmit === 'function') els.cityForm.requestSubmit();
        else els.submitCityButton?.click();
      });
      els.suggestions.appendChild(button);
    }
    els.suggestions.classList.remove('hidden');
  };
})();
