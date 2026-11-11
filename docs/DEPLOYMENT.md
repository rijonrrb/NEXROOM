# NEXROOM deployment

## Verified

- Repository: `rijonrrb/NEXROOM` (private); branch `main`.
- Build: `npm ci && npm run build`. Lint: `npm run lint`.
- Domain: `nexroom.devrijonn.com` (double **n** in `devrijonn`).
- cPanel subdomain document root: `/home/devrijon/nexroom.devrijonn.com`.
- Initial static `dist/` files were uploaded to this isolated document root through cPanel File Manager on November 11, 2026. Existing `.htaccess`, `.user.ini`, `php.ini`, and `.well-known` were preserved.
- The GitHub Actions workflow is committed and its verify job has passed. **Automated deployment is not activated until the dedicated FTPS credentials below exist**.
- During validation, the shared host reset HTTP/TLS connections for `nexroom.devrijonn.com`, `devrijonn.com`, and `screenroom.devrijonn.com`. Inspect server/hosting availability before declaring production online.

## One-time setup for future deploy-on-push

1. In cPanel -> FTP Accounts create a **new, dedicated** login such as `nexdeploy@devrijonn.com` with a **unique, strong password**. Set its directory to exactly `nexroom.devrijonn.com` relative to `/home/devrijon/`. Do not point it to `public_html` or either existing site's files.
2. In the private GitHub repository -> Settings -> Secrets and variables -> Actions, add:
   - `NEXROOM_FTPS_USERNAME`: the full FTP username (for example `nexdeploy@devrijonn.com`).
   - `NEXROOM_FTPS_PASSWORD`: the unique FTP password.
3. Trigger the workflow manually (Actions -> NEXROOM CI and production deploy -> Run workflow) or push to `main`. It builds the static frontend and uploads `dist/` to the dedicated FTP account's home directory.
4. Verify that the deployed `index.html` and hashed `assets/` are served over HTTPS at the NEXROOM domain. Check responsive layout, create/join preview dialogs and static assets. Verify that Screenroom and Portfolio remain unchanged.

Never commit passwords, session URLs, credentials, secret values, or production `.env` files.

## Scope limitations

This first release is a static **homepage preview**. The Create and Join dialogs are not connected to any room server. No authenticated accounts, database, persistent history, actual end-to-end media service, or calling backend exists yet. Signaling and WebRTC will be developed later. Hosting for long-running Node.js and TURN is not yet validated.
