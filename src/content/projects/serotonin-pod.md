---
title: Serotonin Pod
summary: "Pose tracking and a voice guide in the browser. Prototype for the Exploratorium."
metaDescription: "A browser-based wellness experience prototyped for the Exploratorium: a voice guide and live pose tracking walk you through a pose or breathing exercise."
context: Exploratorium × Minerva civic project
period: September 2025 – May 2026
stack: [TypeScript, React, MediaPipe Pose, ElevenLabs, React Three Fiber, Vite, Tailwind CSS, Vitest]
repo: https://github.com/amirassyl/serotonin-pod
demo: https://stance-magic.lovable.app
order: 1
featured: true
---

## The brief

The Exploratorium asked a team of five Minerva students for a pop-up photobooth concept that helps young adults practise *emotional granularity*: naming a specific emotion instead of a vague one. I built the web component. The full deliverable also included the booth exterior concept, a Figma user flow, and a printed takeaway card.

The prototype was delivered to the Exploratorium for internal review. It has not been installed for visitors.

## How it works

1. **Intro.** A field of drifting clouds and a voice guide that welcomes the visitor.
2. **Feeling wheel.** Eight core emotions, each opening into three more specific ones, 24 in total. The visitor picks by voice or by tapping.
3. **Pose studio.** For every emotion outside the Fear family, the camera tracks the visitor's body and draws a glowing "ghost" mannequin of the target pose next to their own skeleton. The skeleton changes colour as the two line up, and a hold timer fills once the match is close. Each session runs two one-minute poses.
4. **Breathing studio.** For the Fear family, a pulsing orb paces a two-minute box-breathing exercise while the voice guide talks the visitor through it.

## The technical core

- **Pose tracking.** MediaPipe Pose runs in the browser and returns 33 body landmarks per frame.
- **Alignment score.** For ten key joints, the distance between the detected landmark and the target pose becomes a 0–100 score. Joints the camera cannot see are skipped.
- **Voice.** Three ElevenLabs conversational agents, one per stage. The agents can call functions in the browser: the intro agent selects the emotion the visitor names, and the pose agent can ask for the live alignment score.
- **Overlay.** Both skeletons are drawn with Three.js through React Three Fiber on a transparent canvas over the video, with smoothing between frames.
- **Session flow.** One state machine coordinates the camera, voice, timers, and the pose swap.

## How it was built

I built the app with [Lovable](https://lovable.dev), an AI development tool, over many rounds of prompting, testing, and revision. The tool wrote code quickly. The work was deciding what it should build and checking that it did: translating the team's visitor flow into screens and states, shaping how pose tracking, scoring, and the voice guide fit together, testing each iteration with a real camera and microphone, and reworking whatever broke or felt wrong.

When I published the repository I moved API identifiers into environment variables and added unit tests for the alignment score.

## Limits

- It is a prototype, tested by the team and not with museum visitors.
- Pose targets are hand-set coordinates for a front-facing camera. They are not calibrated for body size or distance.
- The voice agents need an ElevenLabs account that is not included in the repository.
