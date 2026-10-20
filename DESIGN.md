# Design direction

Owner's choices (asked 2026-10-20), transcribed. Applies to every page.

## Identity

- **Mood:** technical notebook. Calm and focused, like a well-made engineering handbook. Warm paper tones, ink-coloured text. The terminal and labs are the working surface the reader keeps returning to.
- **Accent:** Kubernetes blue (`#326CE5` family), the subject's own colour.
- **Type:** IBM Plex Sans for text, IBM Plex Mono for code, terminal output, and resource names. One family, so prose and code feel like the same notebook.

Dial: ENERGY 1 / RHYTHM 2 / MOTION 1

## Palette

| Token | Light | Dark | Use |
|---|---|---|---|
| bg | `#f6f3ec` | `#11141a` | page (paper / night) |
| surface | `#fffdf8` | `#181c24` | cards, panels |
| code | `#eee9de` | `#1f242d` | code blocks, group boxes |
| fg | `#1c2230` | `#ebe8e1` | body text (ink) |
| muted | `#555c6a` | `#a2a8b4` | secondary text |
| border | `#e0dacd` | `#2b313c` | rules, outlines |
| accent | `#2a5bc8` | `#86abf7` | links, focus, the one highlight |
| accent-fill | `#326ce5` | `#326ce5` | filled primary buttons (white text) |
| ok / bad | `#17703a` / `#b42318` | `#4ade80` / `#f87171` | lab and quiz state only |

All text pairs are WCAG AA or better (lowest 4.76:1). The terminal stays dark in both themes.

## Rules

- Blue marks what you can act on or what is highlighted. Nothing decorative is blue.
- Resource names, kinds, and commands are set in Plex Mono, so they read as one recurring motif.
- Flat surfaces. Borders separate; shadows only for something genuinely raised (none today).
- Prose column about 70 characters wide; interactive blocks (labs, diagrams, quizzes) use the full width.
