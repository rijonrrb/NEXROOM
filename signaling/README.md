# NEXROOM one-to-one signaling

Ephemeral WebSocket signaling for two participants per room. It stores rooms and socket state in memory only. It does not provide chat, recording, profiles, accounts, group calls, or persistent history.

## Local development

1. From `signaling/`, run `npm ci` and `npm start`.
2. From the repository root, run `npm ci` and `npm run dev`.
3. Open the Vite URL in two browser sessions and create/join the same invite.

The local default allows only `http://localhost:5173` and `http://127.0.0.1:5173`. The Vite client uses `ws://localhost:3001` in development.

## Production configuration

Set these variables in the cPanel Node.js application:

- `NODE_ENV=production`
- `ALLOWED_ORIGINS=https://nexroom.devrijonn.com`

Production refuses to start without an explicit HTTPS origin allowlist. cPanel supplies `PORT`; do not hard-code or override it. Use `server.mjs` as the startup file. Keep the application files in a separate application root. Never use the existing NEXROOM homepage document root as the Node application root.

The WebSocket endpoint is the application root path `/`. TLS must terminate at cPanel/Apache and WebSocket Upgrade requests must reach the Node process. Both `GET /` and `GET /healthz` return only a small JSON status object, including for cPanel application checks. Confirm `wss://signal.devrijonn.com/` can complete a WebSocket upgrade before exposing the service.

## Safeguards

- Exact `Origin` allowlist; missing and unlisted origins are rejected.
- Two participants per room, with configurable global room and connection caps.
- 16 KiB maximum WebSocket message size; binary frames are rejected and compression is disabled.
- SDP and ICE candidate fields are validated and bounded.
- Each socket has a burst-limited message budget; dead sockets are removed by ping/pong checks.
- Room IDs are generated from 18 random bytes. A room link is a bearer invite: anyone who gets it can join the room. There is no host approval or identity verification.
- Rooms and participant IDs exist only in process memory. A server restart ends all active rooms.

## Tests

From the repository root:

- `npm run test:signaling` checks origin rejection, health response, capacity, malformed inputs, relay, reconnect, payload size, and rate limiting.
- `npm run test:browser` launches two simulated media browsers and checks live tracks, mute/camera controls, leave/rejoin, signaling reconnection, and audio-only fallback.

The server uses a public STUN endpoint only. TURN is not configured, so some restrictive NAT/firewall combinations can still fail. Do not claim universal connectivity or peer identity security.
