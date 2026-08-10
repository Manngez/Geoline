# Geoline privacy notes

Geoline's first version does not require an account and does not run its own database.

- Pass & Play and Solo Practice game state stays in the browser.
- Online rooms use a direct peer-to-peer connection via PeerJS/WebRTC. A temporary room code is used to connect the players.
- Place searches are sent to the configured geocoding provider only after the player explicitly presses **Play**. Typed autocomplete suggestions are local and do not trigger network search requests.
- Successful place-search results may be cached in the browser's local storage for up to 30 days to reduce repeated requests.
- OpenStreetMap map tiles are requested by the browser while the map is displayed.

Before a public commercial launch, this document should be reviewed and expanded to match the final hosting, analytics, geocoding and account providers actually used.
