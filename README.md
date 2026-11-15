# NEXROOM

**A browser-first space for straightforward, real-time conversations.**

[Live website](https://nexroom.devrijonn.com/)

## Overview

NEXROOM is an open-source communication and collaboration project designed to make connecting with someone as simple as sharing a link. Its focus is a clean, distraction-free experience that works directly in the browser—without installing an app or creating an account.

**The problem:** Starting a quick online conversation can feel unnecessarily complicated. NEXROOM explores an easier way to open a temporary space and connect, while leaving room for richer collaboration features in future releases.

**Who it's for:** students, remote collaborators, independent professionals, friends, and small teams who want lightweight, browser-based conversations.

## What the current beta can do

- **One-to-one voice and video calling** powered by WebRTC.
- **Temporary rooms** created and joined using an invite link or room code.
- **Microphone and camera controls**, including an audio-only fallback.
- **Responsive calling interface** with fullscreen support and camera switching on supported devices.
- **Connection feedback and recovery handling** to make interruptions easier to understand.
- **Ephemeral room management:** signaling state is maintained in memory, without persistent user profiles or conversation history.

The frontend uses **React, TypeScript, and Vite**; a **Node.js/WebSocket signaling service** coordinates the peer connection. WebRTC handles call media between participants when the network permits.

> **Current status: one-to-one beta.** Rooms support two participants. Anyone with a valid room link may join; host approval and identity verification are not implemented. Calls may fail on restrictive networks without relay support. The service is not a guarantee of end-to-end identity assurance.

## Product vision

NEXROOM is intended to grow from a simple calling experience into a lightweight temporary collaboration space. Potential additions include:

- In-room chat, reactions, and conversation tools.
- Screen sharing for presenting work or reviewing ideas.
- File sharing and shared-session utilities.
- Better participant permissions, group collaboration, and broader network compatibility.

**These are future plans—not features available in the current beta.**

## Why this project matters

NEXROOM combines thoughtful product design with practical real-time engineering. The project explores how an approachable interface, browser media permissions, connection recovery, and temporary room lifecycles can work together without burdening users with a complex onboarding process.

## Contributing

Feedback and contributions are welcome. Use [GitHub Issues](https://github.com/rijonrrb/NEXROOM/issues) for bugs and ideas. For code or documentation improvements, fork the repository and submit a focused [pull request](https://github.com/rijonrrb/NEXROOM/pulls). Please discuss large feature proposals in an issue before implementing them.

---

**NEXROOM is an evolving personal open-source project.** Features and privacy protections should be evaluated against the current beta, not the long-term vision.
