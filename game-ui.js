'use strict';

(function () {
  function setupImmersiveGameUI() {
    const gameScreen = document.getElementById('gameScreen');
    const mapWrap = gameScreen?.querySelector('.map-wrap');
    const routeCount = document.getElementById('routeCount');
    const fitRouteButton = document.getElementById('fitRouteButton');
    const quitGameButton = document.getElementById('quitGameButton');
    if (!gameScreen || !mapWrap || document.getElementById('gameMapControls')) return;

    const controls = document.createElement('div');
    controls.id = 'gameMapControls';
    controls.className = 'game-map-controls';
    controls.innerHTML = `
      <button id="routeToggleButton" class="game-map-button route-toggle" type="button" aria-expanded="false" aria-label="Show played places">
        <span aria-hidden="true">☷</span><span class="route-label">Route</span><span id="routeCountShort" class="route-count-short">0</span>
      </button>
      <button id="gameMenuButton" class="game-map-button" type="button" aria-expanded="false" aria-label="Game menu">•••</button>`;
    mapWrap.appendChild(controls);

    const menu = document.createElement('div');
    menu.id = 'gameMapMenu';
    menu.className = 'game-map-menu hidden';
    menu.innerHTML = `
      <button id="menuFitRouteButton" type="button">⌖ Fit full route</button>
      <button id="menuQuitGameButton" class="danger" type="button">Quit game</button>`;
    mapWrap.appendChild(menu);

    const routeToggleButton = document.getElementById('routeToggleButton');
    const routeCountShort = document.getElementById('routeCountShort');
    const gameMenuButton = document.getElementById('gameMenuButton');
    const menuFitRouteButton = document.getElementById('menuFitRouteButton');
    const menuQuitGameButton = document.getElementById('menuQuitGameButton');

    function syncRouteCount() {
      const match = String(routeCount?.textContent || '0').match(/\d+/);
      routeCountShort.textContent = match ? match[0] : '0';
    }

    function closeRoute() {
      gameScreen.classList.remove('route-open');
      routeToggleButton.setAttribute('aria-expanded', 'false');
    }

    function closeMenu() {
      menu.classList.add('hidden');
      gameMenuButton.setAttribute('aria-expanded', 'false');
    }

    routeToggleButton.addEventListener('click', (event) => {
      event.stopPropagation();
      closeMenu();
      const open = gameScreen.classList.toggle('route-open');
      routeToggleButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    gameMenuButton.addEventListener('click', (event) => {
      event.stopPropagation();
      closeRoute();
      const opening = menu.classList.contains('hidden');
      menu.classList.toggle('hidden', !opening);
      gameMenuButton.setAttribute('aria-expanded', opening ? 'true' : 'false');
    });

    menuFitRouteButton.addEventListener('click', () => {
      closeMenu();
      fitRouteButton?.click();
    });

    menuQuitGameButton.addEventListener('click', () => {
      closeMenu();
      quitGameButton?.click();
    });

    document.addEventListener('click', (event) => {
      if (!gameScreen.classList.contains('active')) return;
      if (!menu.contains(event.target) && !controls.contains(event.target)) closeMenu();
      const routeSummary = gameScreen.querySelector('.route-summary');
      if (gameScreen.classList.contains('route-open') && !routeSummary?.contains(event.target) && !routeToggleButton.contains(event.target)) closeRoute();
    });

    if (routeCount) {
      new MutationObserver(syncRouteCount).observe(routeCount, {childList: true, characterData: true, subtree: true});
    }
    syncRouteCount();

    // Keep Leaflet aware of the map's new full-screen dimensions.
    const originalShowScreen = showScreen;
    showScreen = function immersiveShowScreen(name) {
      originalShowScreen(name);
      if (name === 'game') {
        closeRoute();
        closeMenu();
        requestAnimationFrame(() => {
          if (map) {
            map.invalidateSize();
            if (game.route.length) fitRoute();
          }
        });
      }
    };

    // Whenever the game UI refreshes, update the compact HUD count as well.
    const originalUpdateGameUI = updateGameUI;
    updateGameUI = function immersiveUpdateGameUI() {
      originalUpdateGameUI();
      syncRouteCount();
    };

    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        if (map && gameScreen.classList.contains('active')) {
          map.invalidateSize();
          if (game.route.length) fitRoute();
        }
      }, 180);
    });
  }

  document.addEventListener('DOMContentLoaded', setupImmersiveGameUI);
})();
