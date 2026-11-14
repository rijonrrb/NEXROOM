# One-to-one calling — development beta

This is a proof-of-concept for **two browsers only**, not a production-ready secure calling service.

## Run locally

1. `cd signaling && npm install && npm start` (Node 20+).
2. In another terminal, from the repository root run `npm install && npm run dev`.
3. Open the local Vite URL in two separate browser profiles/windows.
4. Create a room, copy the invitation link, join it in the other browser, and grant microphone/camera permissions.
5. Use headphones to avoid feedback. Test mute, camera off, leave, room full, and reconnect.

The frontend defaults to `ws://localhost:3001`. For a hosted HTTPS site, set `VITE_SIGNAL_URL=wss://<your-signaling-host>` **before building**. HTTPS pages cannot use insecure `ws://` connections.

## Known limitations — do not claim end-to-end security yet

- The signaling prototype relays SDP and ICE; it has no host approval, room passwords, identity verification, rate limiting, or access control. Possession of a room link allows entry.
- WebRTC media is encrypted in transit using DTLS-SRTP, but this beta does **not** authenticate peers or protect signaling against a malicious server. End-to-end identity assurances require additional design and verification.
- A public STUN server is used for discovery. Strict NAT/firewall combinations require TURN relay; TURN bandwidth/hosting availability and cost must be assessed.
- No database, recording, persistent room data, or chat is included. Signaling rooms are in memory only.
- Rejoining after a participant leaves may require reloading the call; reliable reconnection is planned.
- Mobile camera/microphone requires HTTPS or localhost.
- Test with two distinct devices on different networks before production rollout.

Do not merge this branch into main or deploy until the signaling service is secured, configured, and tested.
