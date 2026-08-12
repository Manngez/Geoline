'use strict';

// Fair-play autocomplete for Geoline.
// Suggestions help with spelling, but do not reveal state/province information.
// If multiple real places share the same name, the normal place chooser resolves
// the ambiguity only after the player submits that city/town name.
(function () {
  const CANADA_SUGGESTION_PLACES = [
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

  function enabledCountries() {
    const selected = Array.isArray(game.countries) ? game.countries.map(v => String(v).toLowerCase()) : ['us'];
    const clean = [...new Set(selected.filter(v => v === 'us' || v === 'ca'))];
    return clean.length ? clean : ['us'];
  }

  function cityOnly(label) {
    return String(label || '').replace(/,\s*[A-Z]{2}\s*$/i, '').trim();
  }

  function suggestionCities() {
    const selected = enabledCountries();
    const source = [];
    if (selected.includes('us')) source.push(...COMMON_PLACES);
    if (selected.includes('ca')) source.push(...CANADA_SUGGESTION_PLACES);

    const unique = [];
    const seen = new Set();
    for (const label of source) {
      const city = cityOnly(label);
      const key = normalizeText(city);
      if (!city || seen.has(key)) continue;
      seen.add(key);
      unique.push(city);
    }
    return unique;
  }

  // Replace the state-aware local autocomplete with city-name-only suggestions.
  // Matching is also performed only against the city name, so typing a state
  // abbreviation cannot be used to discover cities in that state.
  updateSuggestions = function updateFairPlaySuggestions() {
    const rawQuery = String(els.cityInput?.value || '').trim();
    const q = normalizeText(rawQuery);
    if (q.length < 2 || els.cityInput?.disabled || !els.suggestions) return hideSuggestions();

    const cities = suggestionCities();
    const starts = cities.filter(city => normalizeText(city).startsWith(q));
    const contains = cities.filter(city => !normalizeText(city).startsWith(q) && normalizeText(city).includes(q));
    const matches = [...starts, ...contains].slice(0, 7);

    els.suggestions.innerHTML = '';
    matches.forEach(city => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'suggestion-button';
      button.textContent = city;
      button.addEventListener('click', () => {
        els.cityInput.value = city;
        hideSuggestions();
        els.cityInput.focus();
      });
      els.suggestions.appendChild(button);
    });

    // Keep the expanded place search available without exposing a state/province
    // in the suggestion itself.
    const searchButton = document.createElement('button');
    searchButton.type = 'button';
    searchButton.className = 'suggestion-button search-all-places';
    searchButton.textContent = `⌕ Search cities & towns for “${rawQuery}”`;
    searchButton.addEventListener('click', () => {
      hideSuggestions();
      if (typeof els.cityForm.requestSubmit === 'function') els.cityForm.requestSubmit();
      else els.submitCityButton?.click();
    });
    els.suggestions.appendChild(searchButton);
    els.suggestions.classList.remove('hidden');
  };

  // The expanded geocoder can return near matches in addition to an exact match.
  // For a bare city/town name, keep only exact-name results when they exist:
  // one exact match plays directly, while two or more exact matches open the
  // existing chooser where state/province is shown only because disambiguation
  // is actually required.
  const expandedGeocodePlace = geocodePlace;
  geocodePlace = async function geocodeFairPlayPlace(query) {
    const results = await expandedGeocodePlace(query);
    const raw = String(query || '').trim();
    const hasRegionSuffix = /(?:,\s*|\s+)[A-Za-z]{2}$/.test(raw);
    if (hasRegionSuffix) return results;

    const queryKey = normalizeText(raw);
    const exact = results.filter(place => normalizeText(place.name) === queryKey);
    return exact.length ? exact : results;
  };

  // Keep the input examples neutral as well; the player should not be taught a
  // state/province association by the input UI itself.
  const previousUpdateGameUI = updateGameUI;
  updateGameUI = function updateFairPlayGameUI() {
    previousUpdateGameUI();
    if (!els.cityInput || els.cityInput.disabled) return;
    const selected = enabledCountries();
    els.cityInput.placeholder = selected.length === 2
      ? 'e.g. Austin or Toronto'
      : (selected[0] === 'ca' ? 'e.g. Toronto' : 'e.g. Austin');
  };
})();
