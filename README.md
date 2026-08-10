# Geoline

**Connect America. Don't cross the line.**

Geoline is a standalone U.S.-market geography strategy game. Players name American cities and towns, and every new place is connected to the previous one on the map. The first player whose new segment crosses an earlier non-adjacent segment loses the round.

This repository is intentionally independent. It is not linked to, embedded in, or dependent on any other game project.

## Game modes

- **Pass & Play** — 2–4 players on one device.
- **Host Online Game** — 1v1 peer-to-peer room using a temporary six-character code.
- **Join Online Game** — join the host's room with the code.
- **Solo Practice** — build a route and see how long you can avoid a crossing.

## How it works

1. A player enters a U.S. city or town.
2. Geoline resolves the place and puts it on the map.
3. The new place is connected to the previous place.
4. Used places cannot be repeated.
5. If the new segment intersects an earlier non-adjacent segment, that player loses the round.

## Technology

Geoline is a static, mobile-first site designed for GitHub Pages:

- HTML, CSS and vanilla JavaScript
- Leaflet for map rendering
- PeerJS/WebRTC for direct online rooms
- OpenStreetMap tiles
- A switchable geocoding adapter, currently configured for low-traffic development/testing with the public Nominatim endpoint

No database, build step or account system is required for the first version.

## Geocoding / OpenStreetMap note

The public Nominatim service is suitable only for moderate, user-triggered use and has a strict usage policy. Geoline **does not use Nominatim for autocomplete**: autocomplete suggestions come from a small local list, and a lookup occurs only when the user explicitly plays a place. Results are cached locally for 30 days and each client is throttled to no more than one lookup per ~1.1 seconds.

Before commercial launch or significant traffic, switch `GEOCODER_ENDPOINT` / `geocodePlace()` in `app.js` to a dedicated geocoding provider or a self-hosted Nominatim instance. The application is intentionally structured so the provider can be replaced without changing the game engine.

Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/

Map data is © OpenStreetMap contributors and is attributed in the game UI.

## Run locally

Serve the directory with any static web server. For example:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

> Opening `index.html` directly with `file://` is not recommended because browser security rules can block network requests.

## GitHub Pages

The project has no build step. Publish the repository root from the `main` branch with GitHub Pages.

Expected URL when the repository is named `Geoline` under the `Manngez` account:

`https://manngez.github.io/Geoline/`

## Project identity

Name: **Geoline**  
Tagline: **Connect America. Don't cross the line.**
