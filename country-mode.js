'use strict';

// Country selection for Geoline. Players can enable USA, Canada, or both.
(function () {
  const COUNTRY_STORAGE_KEY = 'geoline:countries-v1';
  const COUNTRY_CACHE_PREFIX = 'geoline:geocode:countries-v1:';
  const CANADA_PROVINCE_ABBR = {
    'Alberta':'AB','British Columbia':'BC','Manitoba':'MB','New Brunswick':'NB',
    'Newfoundland and Labrador':'NL','Northwest Territories':'NT','Nova Scotia':'NS',
    'Nunavut':'NU','Ontario':'ON','Prince Edward Island':'PE','Quebec':'QC',
    'Québec':'QC','Saskatchewan':'SK','Yukon':'YT'
  };
  const CANADA_COMMON_PLACES = [
    'Toronto, ON','Montreal, QC','Vancouver, BC','Calgary, AB','Edmonton, AB',
    'Ottawa, ON','Winnipeg, MB','Quebec City, QC','Hamilton, ON','Kitchener, ON',
    'London, ON','Victoria, BC','Halifax, NS','Oshawa, ON','Windsor, ON',
    'Saskatoon, SK','Regina, SK','St. Catharines, ON','Kelowna, BC','Barrie, ON',
    'Sherbrooke, QC','Guelph, ON','Abbotsford, BC','Kingston, ON','Moncton, NB',
    'Saint John, NB','Fredericton, NB','Charlottetown, PE','St. John’s, NL',
    'Whitehorse, YT','Yellowknife, NT','Iqaluit, NU','Thunder Bay, ON',
    'Sudbury, ON','Trois-Rivières, QC','Saguenay, QC','Red Deer, AB','Lethbridge, AB',
    'Nanaimo, BC','Kamloops, BC','Prince George, BC','Banff, AB','Jasper, AB',
    'Whistler, BC','Niagara Falls, ON','Medicine Hat, AB','Fort McMurray, AB',
    'Sault Ste. Marie, ON','North Bay, ON','Corner Brook, NL'
  ];

  function normalizeCountries(value) {
    const list = Array.isArray(value) ? value : [];
    const clean = [...new Set(list.map(v => String(v).toLowerCase()).filter(v => v === 'us' || v === 'ca'))];
    return clean.length ? clean : ['us'];
  }

  function loadCountries() {
    try { return normalizeCountries(JSON.parse(localStorage.getItem(COUNTRY_STORAGE_KEY) || '["us"]')); }
    catch { return ['us']; }
  }

  game.countries = loadCountries();

  function countryKey() {
    return normalizeCountries(game.countries).sort().join('-');
  }

  function countryLabel() {
    const selected = normalizeCountries(game.countries);
    if (selected.length === 2) return 'U.S. or Canadian';
    return selected[0] === 'ca' ? 'Canadian' : 'U.S.';
  }

  function mapView() {
    const selected = normalizeCountries(game.countries);
    if (selected.length === 2) return {center:[47.8,-101.5], zoom:3};
    if (selected[0] === 'ca') return {center:[56.0,-106.0], zoom:3};
    return {center:[39.2,-98.4], zoom:4};
  }

  function saveCountries() {
    try { localStorage.setItem(COUNTRY_STORAGE_KEY, JSON.stringify(normalizeCountries(game.countries))); } catch {}
  }

  function updateCountryPicker() {
    const picker = document.getElementById('countryPicker');
    if (!picker) return;
    const selected = normalizeCountries(game.countries);
    picker.querySelectorAll('[data-country-choice]').forEach(button => {
      const active = selected.includes(button.dataset.countryChoice);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      const check = button.querySelector('.country-check');
      if (check) check.textContent = active ? '✓' : '+';
    });
    const summary = document.getElementById('countryPickerSummary');
    if (summary) {
      summary.textContent = selected.length === 2 ? 'USA + Canada' : (selected[0] === 'ca' ? 'Canada' : 'United States');
    }
  }

  function setCountries(next, {persist=true, recenter=true}={}) {
    game.countries = normalizeCountries(next);
    if (persist) saveCountries();
    updateCountryPicker();
    if (recenter && map && !game.route.length) {
      const view = mapView();
      map.setView(view.center, view.zoom);
    }
  }

  function toggleCountry(code) {
    const current = normalizeCountries(game.countries);
    if (current.includes(code)) {
      if (current.length === 1) {
        const picker = document.getElementById('countryPicker');
        picker?.classList.remove('country-picker-nudge');
        requestAnimationFrame(() => picker?.classList.add('country-picker-nudge'));
        return;
      }
      setCountries(current.filter(c => c !== code));
    } else {
      setCountries([...current, code]);
    }
  }

  function cacheGetCountry(query) {
    try {
      const raw = localStorage.getItem(COUNTRY_CACHE_PREFIX + countryKey() + ':' + normalizeText(query));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed.ts || Date.now() - parsed.ts > 1000 * 60 * 60 * 24 * 30) return null;
      return parsed.results;
    } catch { return null; }
  }

  function cacheSetCountry(query, results) {
    try {
      localStorage.setItem(
        COUNTRY_CACHE_PREFIX + countryKey() + ':' + normalizeText(query),
        JSON.stringify({ts:Date.now(), results})
      );
    } catch {}
  }

  // Extend settlement parsing with Canadian province / territory codes.
  parseNominatimResult = function parseNorthAmericanSettlement(r) {
    const a = r.address || {};
    const rawName = String(r.name || String(r.display_name || '').split(',')[0] || '').trim();
    if (!rawName || !geolineIsPlayableSettlement(r, a, rawName)) return null;

    const settlementName = a.city || a.town || a.village || a.hamlet || a.municipality || rawName;
    const state = a.state || a.region || '';
    const countryCode = String(a.country_code || '').toLowerCase();
    const iso = a['ISO3166-2-lvl4'] || a['ISO3166-2-lvl6'] || a['ISO3166-2-lvl3'] || '';
    let stateCode = '';
    if (iso.startsWith('US-') || iso.startsWith('CA-')) stateCode = iso.slice(3);
    else if (countryCode === 'ca') stateCode = CANADA_PROVINCE_ABBR[state] || '';
    else stateCode = STATE_ABBR[state] || '';

    return {
      name: String(settlementName || rawName).trim(),
      state: String(state || '').trim(),
      stateCode,
      countryCode,
      lat: Number(r.lat),
      lon: Number(r.lon),
      displayName: r.display_name,
      osmType: r.osm_type,
      osmId: r.osm_id,
      category: r.category || '',
      placeType: r.type || ''
    };
  };

  // Search only the countries enabled for this match. Nominatim accepts a comma-separated list.
  geocodePlace = async function geocodeSelectedCountries(query) {
    const cached = cacheGetCountry(query);
    if (cached?.length) return cached;

    const wait = Math.max(0, 1100 - (Date.now() - lastGeocodeAt));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    lastGeocodeAt = Date.now();

    const params = new URLSearchParams({
      format:'jsonv2',
      q:query,
      countrycodes:normalizeCountries(game.countries).join(','),
      featureType:'settlement',
      addressdetails:'1',
      limit:'10',
      'accept-language':'en'
    });
    const response = await fetch(`${GEOCODER_ENDPOINT}?${params.toString()}`, {headers:{'Accept':'application/json'}});
    if (!response.ok) throw new Error(`Place lookup failed (${response.status})`);

    const raw = await response.json();
    const parsed = raw
      .map(parseNominatimResult)
      .filter(p => p && p.name && Number.isFinite(p.lat) && Number.isFinite(p.lon));
    const unique = [];
    const seen = new Set();
    for (const p of parsed) {
      const key = `${placeKey(p)}|${p.countryCode || ''}`;
      if (!seen.has(key)) { seen.add(key); unique.push(p); }
    }
    cacheSetCountry(query, unique);
    return unique;
  };

  // Country-aware local suggestions, with no network request while typing.
  updateSuggestions = function updateNorthAmericanSuggestions() {
    const q = normalizeText(els.cityInput.value);
    if (q.length < 2 || els.cityInput.disabled) return hideSuggestions();
    const selected = normalizeCountries(game.countries);
    const pool = [];
    if (selected.includes('us')) pool.push(...COMMON_PLACES);
    if (selected.includes('ca')) pool.push(...CANADA_COMMON_PLACES);
    const deduped = [...new Set(pool)];
    const starts = deduped.filter(p => normalizeText(p).startsWith(q));
    const contains = deduped.filter(p => !normalizeText(p).startsWith(q) && normalizeText(p).includes(q));
    const matches = [...starts,...contains].slice(0,7);
    if (!matches.length) return hideSuggestions();
    els.suggestions.innerHTML='';
    matches.forEach(name => {
      const b=document.createElement('button');
      b.type='button'; b.className='suggestion-button'; b.textContent=name;
      b.addEventListener('click', () => { els.cityInput.value=name; hideSuggestions(); els.cityInput.focus(); });
      els.suggestions.appendChild(b);
    });
    els.suggestions.classList.remove('hidden');
  };

  // Dynamic submit messages and the same county guard for both countries.
  onCitySubmit = async function onNorthAmericanCitySubmit(event) {
    event.preventDefault();
    const query = els.cityInput.value.trim();
    if (!query || game.finished) return;
    if (/(^|\s)county(\s|$)/i.test(query)) {
      showToast('Counties are not playable. Try a city or town instead.', 'error', 4200);
      updateGameUI();
      return;
    }
    if (game.mode === 'online' && game.currentIndex !== game.myPlayerIndex) return showToast('Wait for your turn.','error');
    els.submitCityButton.disabled=true;
    els.submitCityButton.textContent='Finding…';
    try {
      const results = await geocodePlace(query);
      if (!results.length) return showToast(`No ${countryLabel()} city or town found for “${query}”.`, 'error');
      if (results.length === 1) submitResolvedPlace(results[0]);
      else openPlaceChooser(results);
    } catch (err) {
      console.error(err);
      showToast('City lookup is unavailable right now. Check your connection and try again.', 'error', 4500);
    } finally {
      els.submitCityButton.textContent='Play';
      updateGameUI();
    }
  };

  const baseInitMap = initMap;
  initMap = function initCountryMap() {
    baseInitMap();
    if (map && !game.route.length) {
      const view = mapView();
      map.setView(view.center, view.zoom);
    }
  };

  const baseResetGameState = resetGameState;
  resetGameState = function resetCountryGameState(keepPlayers=true) {
    baseResetGameState(keepPlayers);
    if (map && !game.route.length) {
      const view = mapView();
      map.setView(view.center, view.zoom);
    }
  };

  const baseUpdateGameUI = updateGameUI;
  updateGameUI = function updateCountryGameUI() {
    baseUpdateGameUI();
    if (!els.cityInput || els.cityInput.disabled) return;
    const selected = normalizeCountries(game.countries);
    els.cityInput.placeholder = selected.length === 2 ? 'e.g. Austin or Toronto' : (selected[0] === 'ca' ? 'e.g. Toronto, ON' : 'e.g. Austin, TX');
  };

  // Include country selection in online room state so the host defines the match map.
  const basePublicState = publicState;
  publicState = function publicCountryState() {
    return {...basePublicState(), countries:normalizeCountries(game.countries)};
  };

  const baseConsumeState = consumeState;
  consumeState = function consumeCountryState(state) {
    if (state?.countries) setCountries(state.countries, {persist:false, recenter:false});
    baseConsumeState(state);
  };

  function patchCopy() {
    const heroSubtitle = document.querySelector('.hero-subtitle');
    if (heroSubtitle) heroSubtitle.textContent = 'Name cities and towns across the U.S. and Canada, connect them on the map, and keep the route alive. The first player to cross an earlier line loses.';
    const featureCountry = document.querySelector('.feature-strip > div:nth-child(3) strong');
    if (featureCountry) featureCountry.textContent = 'USA + CA';
    const firstRule = document.querySelector('.rules-grid .rule-card:first-child');
    if (firstRule) {
      const h3 = firstRule.querySelector('h3');
      const p = firstRule.querySelector('p');
      if (h3) h3.textContent = 'Name a playable place';
      if (p) p.textContent = 'Choose the United States, Canada, or both, then start with any city or town in the selected countries.';
    }
    const cityLabel = document.querySelector('label[for="cityInput"]');
    if (cityLabel) cityLabel.textContent = 'Enter a city or town';
  }

  function injectCountryPicker() {
    const setup = document.getElementById('setupScreen');
    const modeGrid = setup?.querySelector('.mode-grid');
    if (!setup || !modeGrid || document.getElementById('countryPicker')) return;

    const picker = document.createElement('section');
    picker.id = 'countryPicker';
    picker.className = 'country-picker';
    picker.setAttribute('aria-label','Playable countries');
    picker.innerHTML = `
      <div class="country-picker-copy">
        <div class="eyebrow">Playable countries</div>
        <strong>Choose one or both</strong>
        <span id="countryPickerSummary">United States</span>
      </div>
      <div class="country-picker-options">
        <button type="button" class="country-choice" data-country-choice="us" aria-pressed="true">
          <span class="country-flag" aria-hidden="true">🇺🇸</span>
          <span class="country-name">United States</span>
          <span class="country-check">✓</span>
        </button>
        <button type="button" class="country-choice" data-country-choice="ca" aria-pressed="false">
          <span class="country-flag" aria-hidden="true">🇨🇦</span>
          <span class="country-name">Canada</span>
          <span class="country-check">+</span>
        </button>
      </div>`;
    modeGrid.before(picker);
    picker.querySelectorAll('[data-country-choice]').forEach(button => {
      button.addEventListener('click', () => toggleCountry(button.dataset.countryChoice));
    });
    updateCountryPicker();
  }

  document.addEventListener('DOMContentLoaded', () => {
    patchCopy();
    injectCountryPicker();
  });
})();
