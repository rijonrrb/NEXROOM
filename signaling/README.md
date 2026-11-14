# NEXROOM 1:1 signaling (development)

Ephemeral WebSocket signaling for two participants per room. No database, accounts, recordings or chat history.

## Local
```bash
cd signaling
npm install
npm start
```
Runs on port 3001 (override with PORT). Client connects to `ws://localhost:3001` locally or `wss://` behind a TLS reverse proxy.

## Protocol
Client sends `{"type":"join","roomId":"unguessable_random_room_id"}`. Server responds `joined` with `initiator` flag. Existing peer receives `peer-joined`. Clients exchange `offer`, `answer`, `ice-candidate` with a `data` object. A disconnect emits `peer-left`. A third participant receives `ROOM_FULL`.

## Before production
This is only the signaling foundation, not a completed calling feature. Add the browser WebRTC client, media permissions, peer negotiation, STUN/TURN configuration, reconnection, room host approval and automated tests. Deploy signaling to a persistent Node process with HTTPS/WSS reverse proxy; static FTP hosting alone cannot run it. Add origin checking, rate limits, message validation and room access authorization before exposing publicly. TURN is important for connectivity across restrictive networks. Do not deploy this development server publicly as-is.
