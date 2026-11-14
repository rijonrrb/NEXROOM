# NEXROOM deployment

## Verified hosting state

- cPanel host: `nova.hostseba.com`; account label: `devrijon.com`.
- Homepage domain: `nexroom.devrijonn.com` (double **n** in `devrijonn`).
- cPanel Domains lists its document root as `/home/devrijon/nexroom.devrijonn.com`. This is separate from `/home/devrijon/public_html` and `/home/devrijon/screenroom.devrijonn.com`.
- From the authorized Windows PC on November 14, 2026, `nexroom.devrijonn.com` resolved to `103.174.152.66` and an HTTPS HEAD request returned `200 OK`.
- `signal.devrijonn.com` had no DNS record at the time of this check. Do not point it at the homepage document root.
- The cPanel Node.js creation page currently defaults to Node `10.24.1`. The available version list still needs live verification before creating the app; select Node `22.23.5` if the selector confirms it.
- Existing frontend deployment uploads only `dist/` to the dedicated NEXROOM FTPS account. The workflow skips deployment if its FTPS secrets are missing.

## One-to-one signaling setup

1. In cPanel Domains, create `signal.devrijonn.com` with its own document root, such as `/home/devrijon/signal.devrijonn.com`. Leave the existing homepage domain and root unchanged.
2. Wait for DNS to resolve and enable TLS for the signaling subdomain.
3. Create a Node.js application with Node `22.23.5` after confirming the option in cPanel. Keep its application root separate from all public document roots (for example, `/home/devrijon/nexroom-signal-app`), set application URL to `signal.devrijonn.com`, and startup file to `server.mjs`.
4. Install the files and `ws` dependency from the repository's `signaling/` folder. Set:
   - `NODE_ENV=production`
   - `ALLOWED_ORIGINS=https://nexroom.devrijonn.com`
   cPanel supplies `PORT`.
5. Verify `https://signal.devrijonn.com/healthz` returns the signaling health JSON and a browser WebSocket upgrade succeeds at `wss://signal.devrijonn.com/`. If cPanel does not proxy WebSocket upgrades, stop and ask the host to confirm support; do not expose the Node port directly.
6. Confirm the deployed frontend uses `VITE_SIGNAL_URL=wss://signal.devrijonn.com`.

## Frontend CI/CD

The GitHub Actions workflow builds the Vite app, runs lint, signaling and two-browser tests, audits dependencies, then uploads static `dist/` files to the existing dedicated FTPS account on pushes to `main`. It never uploads the Node server to the homepage document root.

In the private GitHub repository, the FTPS credentials must be configured as Actions secrets named `NEXROOM_FTPS_USERNAME` and `NEXROOM_FTPS_PASSWORD`. Never commit credentials, session URLs, or production `.env` files.

## Limits

The signaling service keeps rooms in memory and only supports two participants. There is no database, persistent chat, profile, recording, host approval, or group calling. Public STUN is configured; TURN is not, so some restrictive networks may still fail.
