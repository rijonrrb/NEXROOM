# NEXROOM production setup

The frontend currently builds as a static site. To enable deploy-on-push:

1. Create the NEXROOM subdomain in the cPanel account. Confirm the exact domain first: existing GitHub deployments use `devrijonn.com` (two n's), although the requested name is `devrijon.com`.
2. Create a **dedicated FTP account restricted to the new NEXROOM subdomain's document root**. Do not reuse Portfolio or Screenroom FTP accounts.
3. Add GitHub Actions secrets `NEXROOM_FTPS_USERNAME` and `NEXROOM_FTPS_PASSWORD`. The host is `nova.hostseba.com` based on existing project workflows; confirm FTPS support.
4. After DNS, HTTPS and FTP permissions work, each push to `main` builds and uploads `dist/`. Until secrets are set, the deploy step is skipped but the build still runs.

**Scope guard:** `server-dir: ./` is only safe with a dedicated FTP login jailed to the new subdomain's web root. Never use an account pointed at the general hosting root or existing site.

The future Node.js WebRTC signaling backend is not included in this static-only deployment.