'use strict';

// Geoline uses a label-free CARTO Voyager basemap built from OpenStreetMap data.
// This keeps geographic context such as roads, coastlines, water and terrain cues
// without revealing city/town names to players.
initMap = function () {
  if (!map) {
    map = L.map('map', {
      zoomControl: true,
      minZoom: 2,
      worldCopyJump: true
    }).setView([39.2, -98.4], 4);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
  }

  setTimeout(() => map.invalidateSize(), 80);
  renderMapState();
};
