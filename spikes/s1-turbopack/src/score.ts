// Original synthetic alphaTex fragment written for MusicHub spike S1 (no third-party material).
// 2 tracks × 12 bars, so alphaTab draws its attribution mark (> 10 bars). In alphaTex a
// duration suffix (`.1`) carries over to the next beats, so bars reset it with `:4`/`:8`.
export const SPIKE_SCORE = String.raw`
\title "MusicHub spike S1"
\subtitle "Original test fragment"
\tempo 96
.
\track "Guitar"
\staff {score tabs}
\tuning e4 b3 g3 d3 a2 e2
:4 0.6 2.5 2.4 0.3 | 3.6 2.5 0.4 2.4 | (0.3 1.2 0.1).2 (0.3 1.2 0.1).2 | 3.1.1 |
:8 0.6 2.6 3.6 2.6 0.5 2.5 3.5 2.5 | :4 0.4 2.4 3.4 2.4 | (3.6 2.5 0.4 0.3 0.2 3.1).1 | 0.1.2 3.2.2 |
:4 5.3 7.3 5.2 7.2 | 8.1.2 7.1.2 | :8 0.6 0.6 3.6 3.6 5.6 5.6 3.6 3.6 | (0.4 2.3 3.2).1
\track "Piano"
\staff {score}
\clef G2
:4 c5 d5 e5 f5 | g5.2 g5.2 | (c5 e5 g5).1 | :4 a4 b4 c5 d5 |
e5 f5 g5 a5 | g5.1 | (b4 d5 g5).2 (c5 e5 g5).2 | c5.1 |
:8 c5 d5 e5 f5 g5 f5 e5 d5 | c5.2 r.2 | :4 e5 d5 c5 b4 | (c5 e5 g5 c6).1
`;
