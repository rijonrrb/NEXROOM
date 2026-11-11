# NEXROOM

A responsive, browser-first homepage for a private real-time collaboration platform. Built with React, TypeScript, and Vite.

## Current scope

This first commit includes the homepage, responsive navigation, features/steps/privacy sections, and accessible **UI-preview-only** Create Room and Join Room dialogs. No realtime calling, signaling server, storage, authentication, profile, or room management backend has been implemented yet. The next phase will introduce Node.js signaling and WebRTC.

## Setup

Requires Node.js 20.19+ or 22.12+ (or newer compatible version).

    npm install
    npm run dev
    npm run build
    npm run preview

## Design

- Dark \`#0A0A0A\`, yellow \`#F5C518\`, off-white
- Space Grotesk and JetBrains Mono
- Rounded matte UI components, restrained shadows and subtle wave animation
- Reduced-motion accessibility
- Designed for desktop and mobile browsers

## Deployment

The frontend is a static Vite build emitted to \`dist/\`. Deployment automation can publish this folder to the NEXROOM subdomain once cPanel's document root and GitHub Actions credentials have been configured. **Never commit hosting credentials, API tokens, or \`.env\` files.**

## Roadmap

1. Room creation, invite link, host approval, host handoff and ephemeral lifecycle
2. WebRTC 1:1 and small-group calls with STUN/TURN fallback
3. Encrypted, temporary chat/files and screen sharing
4. Testing, browser compatibility, security hardening and deployment checks

Encryption/privacy features are targets, not claims about the current homepage-only release.
