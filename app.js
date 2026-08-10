'use strict';
// Geoline is split into classic scripts for maintainability. This loader runs
// during document parsing so all modules are available before DOMContentLoaded.
document.write('<script src="app-core.js"><\/script>');
document.write('<script src="app-map.js"><\/script>');
document.write('<script src="app-game.js"><\/script>');
document.write('<script src="app-online.js"><\/script>');
