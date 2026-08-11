'use strict';
// Geoline is split into classic scripts for maintainability. This loader runs
// during document parsing so all modules are available before DOMContentLoaded.
document.write('<link rel="stylesheet" href="game-ui.css">');
document.write('<link rel="stylesheet" href="country-mode.css">');
document.write('<script src="app-core.js"><\/script>');
document.write('<script src="app-map.js"><\/script>');
document.write('<script src="app-game.js"><\/script>');
document.write('<script src="settlement-filter.js"><\/script>');
document.write('<script src="app-online.js"><\/script>');
document.write('<script src="country-mode.js"><\/script>');
document.write('<script src="place-search-v2.js"><\/script>');
document.write('<script src="game-ui.js"><\/script>');
