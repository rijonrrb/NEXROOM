# One-to-one calling beta

NEXROOM supports ephemeral one-to-one voice/video calls over WebRTC. The signaling server relays SDP and ICE only; media flows peer-to-peer when network conditions allow. The server has no database or persistent chat history.

## Local run

1. From `signaling/`, run `npm ci` and `npm start`.
2. From the repository root, run `npm ci` and `npm run dev`.
3. Open the Vite URL in two browser profiles/windows. Create a room in one, join its invite in the other, and grant microphone/camera access.

Use headphones to avoid feedback. Test mute, camera off, leave/rejoin, room-full rejection, and signaling reconnection.

Production builds use `VITE_SIGNAL_URL=wss://signal.devrijonn.com`. Local Vite builds use `ws://localhost:3001`. HTTPS pages require WSS; production refuses a non-WSS client URL.

## Security and limits

- Production signaling requires `NODE_ENV=production` and an exact HTTPS `ALLOWED_ORIGINS` entry for `https://nexroom.devrijonn.com`.
- The server limits room capacity, connections, frame size, message rate, and accepted SDP/ICE fields.
- A private room link grants access to whoever holds it. There is no login, host approval, identity verification, or group calling in this phase.
- WebRTC media is encrypted in transit with DTLS-SRTP, but NEXROOM does not verify peer identity or provide end-to-end identity assurance.
- Public STUN is configured. No TURN relay or paid service is included, so some networks may not connect.
- Mobile camera/microphone use requires HTTPS or localhost.

## Verification

Run `npm run lint`, `npm run build`, and `npm test`. The browser test uses simulated devices; real-device testing across desktop/mobile and different networks remains a manual acceptance step.
