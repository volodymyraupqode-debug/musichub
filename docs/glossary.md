# MusicHub glossary (EN / UK)

Use these terms in code, docs and UI copy (DESIGN_SYSTEM.md §8). UI copy says "bar", not "measure".

| English (code & docs) | Українською (UI) | Meaning |
|---|---|---|
| composition | композиція | A user's piece of music; stored as an MHD document with revisions |
| MusicHub Document (MHD) | документ MusicHub | Canonical JSON format of a composition (MUSIC_ENGINE.md §3) |
| revision | ревізія | One saved snapshot of a composition |
| track | доріжка | One instrument part (e.g. guitar, piano) |
| staff | нотний стан | One staff of a track; a piano track has two (grand staff) |
| bar | такт | Measure; `masterBar` holds data shared by all tracks |
| beat | доля / біт | Group of simultaneous notes with one rhythmic value |
| voice | голос | Independent rhythmic line within a bar (1–4) |
| note | нота | A single pitch (string + fret on stringed staves) |
| tablature (tab) | табулатура | String/fret notation |
| standard notation | нотний запис | Five-line staff notation |
| tempo / BPM | темп / BPM | Beats per minute in the score |
| playback speed | швидкість відтворення | Session-only speed ratio; does not change the score |
| metronome / count-in | метроном / відлік | Click track / clicks before playback starts |
| loop (A–B) | зациклення (A–B) | Repeated playback of a selected fragment |
| fragment | фрагмент | Bar range (+ hand) practised in practice mode |
| practice mode | режим навчання | Listen / play-along / wait modes with correctness checking |
| wait mode | режим очікування | Playback pauses until the expected notes are played |
| Piano Visualizer | Piano Visualizer | Falling notes above an 88-key keyboard |
| falling notes | падаючі ноти | Note bars moving towards the keyboard |
| Piano Roll | Piano Roll | Grid editor of notes over time |
| hand (left / right) | рука (ліва / права) | Hand assignment of a keyboard staff or note |
| library | бібліотека | The user's own compositions and folders |
| Community | Community | Public compositions, profiles, likes, comments, follows |
