All values in playback ms. Error = |e − bias| at animation frames against the fitted audio-frame timeline; bias = median(e). Snaps counted in the steady window.

### Per run (main variants)

| Run | Split | Variant | Frames | Bias | Median | p95 | p99 | Max | Max abs | Snaps | Snaps/min | Max snap |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| chromium-i0-s1-d60-r1 | tuning | interpolation (snap every anchor) | 3570 | 1.34 | 0.07 | 0.26 | 0.91 | 5.41 | 4.07 | 0 | 0.00 | 0.00 |
| chromium-i0-s1-d60-r1 | tuning | slew + snap ≥ 20 ms | 3570 | 1.34 | 0.07 | 0.24 | 0.38 | 2.86 | 1.60 | 0 | 0.00 | 0.00 |
| chromium-i0-s1-d60-r1 | tuning | slew + snap ≥ 30 ms | 3570 | 1.34 | 0.07 | 0.24 | 0.38 | 2.86 | 1.60 | 0 | 0.00 | 0.00 |
| chromium-i0-s1-d60-r1 | tuning | slew + snap ≥ 40 ms | 3570 | 1.34 | 0.07 | 0.24 | 0.38 | 2.86 | 1.60 | 0 | 0.00 | 0.00 |
| chromium-i0-s1-d60-r1 | tuning | slew, never snap | 3570 | 1.34 | 0.07 | 0.24 | 0.38 | 2.86 | 1.60 | 0 | 0.00 | 0.00 |
| chromium-i0-s1-d60-r2 | tuning | interpolation (snap every anchor) | 3561 | 1.39 | 0.08 | 0.49 | 2.60 | 10.40 | 9.01 | 0 | 0.00 | 0.00 |
| chromium-i0-s1-d60-r2 | tuning | slew + snap ≥ 20 ms | 3561 | 1.39 | 0.08 | 0.37 | 0.78 | 5.23 | 3.84 | 2 | 2.02 | 24.90 |
| chromium-i0-s1-d60-r2 | tuning | slew + snap ≥ 30 ms | 3561 | 1.39 | 0.08 | 0.37 | 0.78 | 3.32 | 1.93 | 0 | 0.00 | 0.00 |
| chromium-i0-s1-d60-r2 | tuning | slew + snap ≥ 40 ms | 3561 | 1.39 | 0.08 | 0.37 | 0.78 | 3.32 | 1.93 | 0 | 0.00 | 0.00 |
| chromium-i0-s1-d60-r2 | tuning | slew, never snap | 3561 | 1.39 | 0.08 | 0.37 | 0.78 | 3.32 | 1.93 | 0 | 0.00 | 0.00 |
| chromium-i0-s1-d60-r3 | tuning | interpolation (snap every anchor) | 3570 | 1.39 | 0.11 | 0.61 | 1.95 | 8.48 | 7.09 | 0 | 0.00 | 0.00 |
| chromium-i0-s1-d60-r3 | tuning | slew + snap ≥ 20 ms | 3570 | 1.39 | 0.11 | 0.53 | 0.90 | 1.84 | 1.76 | 0 | 0.00 | 0.00 |
| chromium-i0-s1-d60-r3 | tuning | slew + snap ≥ 30 ms | 3570 | 1.39 | 0.11 | 0.53 | 0.90 | 1.84 | 1.76 | 0 | 0.00 | 0.00 |
| chromium-i0-s1-d60-r3 | tuning | slew + snap ≥ 40 ms | 3570 | 1.39 | 0.11 | 0.53 | 0.90 | 1.84 | 1.76 | 0 | 0.00 | 0.00 |
| chromium-i0-s1-d60-r3 | tuning | slew, never snap | 3570 | 1.39 | 0.11 | 0.53 | 0.90 | 1.84 | 1.76 | 0 | 0.00 | 0.00 |
| chromium-i10-s0.5-d60-r1 | held-out | interpolation (snap every anchor) | 3570 | 0.07 | 0.06 | 0.42 | 0.81 | 5.21 | 5.14 | 0 | 0.00 | 0.00 |
| chromium-i10-s0.5-d60-r1 | held-out | slew + snap ≥ 20 ms | 3570 | 0.06 | 0.07 | 0.41 | 0.78 | 1.20 | 1.14 | 0 | 0.00 | 0.00 |
| chromium-i10-s0.5-d60-r1 | held-out | slew + snap ≥ 30 ms | 3570 | 0.06 | 0.07 | 0.41 | 0.78 | 1.20 | 1.14 | 0 | 0.00 | 0.00 |
| chromium-i10-s0.5-d60-r1 | held-out | slew + snap ≥ 40 ms | 3570 | 0.06 | 0.07 | 0.41 | 0.78 | 1.20 | 1.14 | 0 | 0.00 | 0.00 |
| chromium-i10-s0.5-d60-r1 | held-out | slew, never snap | 3570 | 0.06 | 0.07 | 0.41 | 0.78 | 1.20 | 1.14 | 0 | 0.00 | 0.00 |
| chromium-i10-s1-d300-r1 | held-out | interpolation (snap every anchor) | 17964 | 0.07 | 0.08 | 0.55 | 0.92 | 9.09 | 9.02 | 0 | 0.00 | 0.00 |
| chromium-i10-s1-d300-r1 | held-out | slew + snap ≥ 20 ms | 17964 | 0.07 | 0.08 | 0.50 | 0.77 | 3.13 | 3.07 | 0 | 0.00 | 0.00 |
| chromium-i10-s1-d300-r1 | held-out | slew + snap ≥ 30 ms | 17964 | 0.07 | 0.08 | 0.50 | 0.77 | 3.13 | 3.07 | 0 | 0.00 | 0.00 |
| chromium-i10-s1-d300-r1 | held-out | slew + snap ≥ 40 ms | 17964 | 0.07 | 0.08 | 0.50 | 0.77 | 3.13 | 3.07 | 0 | 0.00 | 0.00 |
| chromium-i10-s1-d300-r1 | held-out | slew, never snap | 17964 | 0.07 | 0.08 | 0.50 | 0.77 | 3.13 | 3.07 | 0 | 0.00 | 0.00 |
| chromium-i10-s1-d60-r1 | tuning | interpolation (snap every anchor) | 3563 | 0.03 | 0.05 | 0.21 | 0.82 | 9.07 | 9.04 | 0 | 0.00 | 0.00 |
| chromium-i10-s1-d60-r1 | tuning | slew + snap ≥ 20 ms | 3563 | 0.03 | 0.05 | 0.23 | 0.63 | 1.71 | 1.68 | 0 | 0.00 | 0.00 |
| chromium-i10-s1-d60-r1 | tuning | slew + snap ≥ 30 ms | 3563 | 0.03 | 0.05 | 0.23 | 0.63 | 1.71 | 1.68 | 0 | 0.00 | 0.00 |
| chromium-i10-s1-d60-r1 | tuning | slew + snap ≥ 40 ms | 3563 | 0.03 | 0.05 | 0.23 | 0.63 | 1.71 | 1.68 | 0 | 0.00 | 0.00 |
| chromium-i10-s1-d60-r1 | tuning | slew, never snap | 3563 | 0.03 | 0.05 | 0.23 | 0.63 | 1.71 | 1.68 | 0 | 0.00 | 0.00 |
| chromium-i10-s1-d60-r2 | tuning | interpolation (snap every anchor) | 3570 | 0.15 | 0.10 | 0.70 | 1.23 | 9.54 | 9.40 | 1 | 1.01 | 63.23 |
| chromium-i10-s1-d60-r2 | tuning | slew + snap ≥ 20 ms | 3570 | 0.14 | 0.10 | 0.58 | 0.91 | 2.00 | 1.86 | 4 | 4.03 | 63.23 |
| chromium-i10-s1-d60-r2 | tuning | slew + snap ≥ 30 ms | 3570 | 0.14 | 0.10 | 0.58 | 0.91 | 2.00 | 1.86 | 3 | 3.03 | 63.23 |
| chromium-i10-s1-d60-r2 | tuning | slew + snap ≥ 40 ms | 3570 | 0.14 | 0.10 | 0.59 | 0.98 | 19.55 | 19.41 | 2 | 2.02 | 63.23 |
| chromium-i10-s1-d60-r2 | tuning | slew, never snap | 3570 | 0.14 | 0.10 | 0.58 | 0.91 | 2.00 | 1.86 | 0 | 0.00 | 0.00 |
| chromium-i10-s1-d60-r3 | tuning | interpolation (snap every anchor) | 3570 | 0.04 | 0.07 | 0.37 | 0.88 | 6.52 | 6.48 | 0 | 0.00 | 0.00 |
| chromium-i10-s1-d60-r3 | tuning | slew + snap ≥ 20 ms | 3570 | 0.04 | 0.07 | 0.37 | 0.74 | 1.39 | 1.35 | 0 | 0.00 | 0.00 |
| chromium-i10-s1-d60-r3 | tuning | slew + snap ≥ 30 ms | 3570 | 0.04 | 0.07 | 0.37 | 0.74 | 1.39 | 1.35 | 0 | 0.00 | 0.00 |
| chromium-i10-s1-d60-r3 | tuning | slew + snap ≥ 40 ms | 3570 | 0.04 | 0.07 | 0.37 | 0.74 | 1.39 | 1.35 | 0 | 0.00 | 0.00 |
| chromium-i10-s1-d60-r3 | tuning | slew, never snap | 3570 | 0.04 | 0.07 | 0.37 | 0.74 | 1.39 | 1.35 | 0 | 0.00 | 0.00 |
| chromium-i10-s1.5-d60-r1 | held-out | interpolation (snap every anchor) | 3570 | 0.08 | 0.09 | 0.56 | 1.01 | 2.46 | 2.38 | 0 | 0.00 | 0.00 |
| chromium-i10-s1.5-d60-r1 | held-out | slew + snap ≥ 20 ms | 3570 | 0.08 | 0.09 | 0.48 | 0.85 | 1.49 | 1.41 | 0 | 0.00 | 0.00 |
| chromium-i10-s1.5-d60-r1 | held-out | slew + snap ≥ 30 ms | 3570 | 0.08 | 0.09 | 0.48 | 0.85 | 1.49 | 1.41 | 0 | 0.00 | 0.00 |
| chromium-i10-s1.5-d60-r1 | held-out | slew + snap ≥ 40 ms | 3570 | 0.08 | 0.09 | 0.48 | 0.85 | 1.49 | 1.41 | 0 | 0.00 | 0.00 |
| chromium-i10-s1.5-d60-r1 | held-out | slew, never snap | 3570 | 0.08 | 0.09 | 0.48 | 0.85 | 1.49 | 1.41 | 0 | 0.00 | 0.00 |
| webkit-i0-s1-d60-r1 | tuning | interpolation (snap every anchor) | 3526 | 0.85 | 2.41 | 6.79 | 8.04 | 19.25 | 18.40 | 1 | 1.01 | 53.33 |
| webkit-i0-s1-d60-r1 | tuning | slew + snap ≥ 20 ms | 3526 | 0.90 | 2.38 | 6.68 | 8.01 | 28.08 | 27.18 | 6 | 6.06 | 53.33 |
| webkit-i0-s1-d60-r1 | tuning | slew + snap ≥ 30 ms | 3526 | 0.93 | 2.36 | 6.67 | 7.99 | 17.45 | 16.51 | 2 | 2.02 | 53.33 |
| webkit-i0-s1-d60-r1 | tuning | slew + snap ≥ 40 ms | 3526 | 0.94 | 2.36 | 6.63 | 7.87 | 49.46 | 48.51 | 2 | 2.02 | 53.33 |
| webkit-i0-s1-d60-r1 | tuning | slew, never snap | 3526 | 0.96 | 2.36 | 6.63 | 7.88 | 9.53 | 8.57 | 0 | 0.00 | 0.00 |
| webkit-i0-s1-d60-r2 | tuning | interpolation (snap every anchor) | 3525 | 0.07 | 3.07 | 7.89 | 9.66 | 13.02 | 12.95 | 1 | 1.01 | 40.33 |
| webkit-i0-s1-d60-r2 | tuning | slew + snap ≥ 20 ms | 3525 | 0.09 | 3.04 | 7.96 | 9.71 | 24.64 | 24.55 | 6 | 6.07 | 40.33 |
| webkit-i0-s1-d60-r2 | tuning | slew + snap ≥ 30 ms | 3525 | 0.09 | 3.05 | 7.89 | 9.54 | 10.32 | 10.41 | 2 | 2.02 | 40.33 |
| webkit-i0-s1-d60-r2 | tuning | slew + snap ≥ 40 ms | 3525 | 0.09 | 3.04 | 7.88 | 9.54 | 10.32 | 10.41 | 2 | 2.02 | 40.33 |
| webkit-i0-s1-d60-r2 | tuning | slew, never snap | 3525 | 0.09 | 3.04 | 7.88 | 9.54 | 10.32 | 10.41 | 0 | 0.00 | 0.00 |
| webkit-i0-s1-d60-r3 | tuning | interpolation (snap every anchor) | 3529 | 0.50 | 1.84 | 4.58 | 5.55 | 13.51 | 13.02 | 1 | 1.01 | 38.33 |
| webkit-i0-s1-d60-r3 | tuning | slew + snap ≥ 20 ms | 3529 | 0.49 | 1.85 | 4.45 | 5.39 | 16.27 | 15.78 | 4 | 4.04 | 38.33 |
| webkit-i0-s1-d60-r3 | tuning | slew + snap ≥ 30 ms | 3529 | 0.50 | 1.85 | 4.43 | 5.33 | 6.14 | 6.25 | 2 | 2.02 | 38.33 |
| webkit-i0-s1-d60-r3 | tuning | slew + snap ≥ 40 ms | 3529 | 0.51 | 1.85 | 4.43 | 5.31 | 6.15 | 6.25 | 0 | 0.00 | 0.00 |
| webkit-i0-s1-d60-r3 | tuning | slew, never snap | 3529 | 0.51 | 1.85 | 4.43 | 5.31 | 6.15 | 6.25 | 0 | 0.00 | 0.00 |
| webkit-i10-s0.5-d60-r1 | held-out | interpolation (snap every anchor) | 3529 | 0.53 | 2.72 | 7.54 | 10.69 | 15.42 | 14.89 | 1 | 1.01 | 33.33 |
| webkit-i10-s0.5-d60-r1 | held-out | slew + snap ≥ 20 ms | 3529 | 0.58 | 2.51 | 6.87 | 9.42 | 12.86 | 12.28 | 2 | 2.02 | 33.33 |
| webkit-i10-s0.5-d60-r1 | held-out | slew + snap ≥ 30 ms | 3529 | 0.59 | 2.51 | 6.88 | 9.43 | 12.87 | 12.28 | 2 | 2.02 | 33.33 |
| webkit-i10-s0.5-d60-r1 | held-out | slew + snap ≥ 40 ms | 3529 | 0.59 | 2.51 | 6.89 | 9.43 | 12.87 | 12.28 | 0 | 0.00 | 0.00 |
| webkit-i10-s0.5-d60-r1 | held-out | slew, never snap | 3529 | 0.59 | 2.51 | 6.89 | 9.43 | 12.87 | 12.28 | 0 | 0.00 | 0.00 |
| webkit-i10-s1-d300-r1 | held-out | interpolation (snap every anchor) | 17943 | 0.46 | 4.21 | 12.39 | 15.49 | 32.66 | 32.20 | 9 | 1.80 | 84.33 |
| webkit-i10-s1-d300-r1 | held-out | slew + snap ≥ 20 ms | 17943 | 0.45 | 4.10 | 12.18 | 15.42 | 32.65 | 32.20 | 46 | 9.21 | 84.33 |
| webkit-i10-s1-d300-r1 | held-out | slew + snap ≥ 30 ms | 17943 | 0.43 | 4.11 | 12.20 | 15.42 | 25.80 | 25.37 | 18 | 3.60 | 84.33 |
| webkit-i10-s1-d300-r1 | held-out | slew + snap ≥ 40 ms | 17943 | 0.45 | 4.11 | 12.23 | 15.53 | 47.15 | 46.70 | 10 | 2.00 | 84.33 |
| webkit-i10-s1-d300-r1 | held-out | slew, never snap | 17943 | 0.46 | 4.10 | 12.14 | 15.20 | 21.28 | 20.82 | 0 | 0.00 | 0.00 |
| webkit-i10-s1-d60-r1 | tuning | interpolation (snap every anchor) | 3546 | 0.12 | 3.74 | 13.49 | 16.74 | 23.83 | 23.71 | 3 | 3.02 | 76.33 |
| webkit-i10-s1-d60-r1 | tuning | slew + snap ≥ 20 ms | 3546 | 0.12 | 3.64 | 13.33 | 16.45 | 24.25 | 24.14 | 22 | 22.16 | 76.33 |
| webkit-i10-s1-d60-r1 | tuning | slew + snap ≥ 30 ms | 3546 | 0.16 | 3.61 | 13.26 | 16.37 | 18.89 | 18.73 | 7 | 7.05 | 76.33 |
| webkit-i10-s1-d60-r1 | tuning | slew + snap ≥ 40 ms | 3546 | 0.09 | 3.62 | 13.03 | 16.60 | 26.00 | 25.91 | 4 | 4.03 | 76.33 |
| webkit-i10-s1-d60-r1 | tuning | slew, never snap | 3546 | 0.17 | 3.60 | 13.30 | 16.15 | 18.16 | 18.33 | 0 | 0.00 | 0.00 |
| webkit-i10-s1-d60-r2 | tuning | interpolation (snap every anchor) | 3537 | -0.24 | 4.08 | 13.30 | 16.39 | 145.71 | 145.47 | 4 | 4.04 | 296.33 |
| webkit-i10-s1-d60-r2 | tuning | slew + snap ≥ 20 ms | 3537 | -0.16 | 4.03 | 12.57 | 15.85 | 145.68 | 145.52 | 21 | 21.21 | 296.33 |
| webkit-i10-s1-d60-r2 | tuning | slew + snap ≥ 30 ms | 3537 | -0.16 | 4.02 | 12.38 | 15.84 | 145.68 | 145.52 | 13 | 13.13 | 296.33 |
| webkit-i10-s1-d60-r2 | tuning | slew + snap ≥ 40 ms | 3537 | -0.21 | 4.02 | 12.81 | 16.31 | 145.73 | 145.52 | 8 | 8.08 | 296.33 |
| webkit-i10-s1-d60-r2 | tuning | slew, never snap | 3537 | -0.13 | 4.04 | 14.37 | 134.78 | 145.65 | 145.52 | 0 | 0.00 | 0.00 |
| webkit-i10-s1-d60-r3 | tuning | interpolation (snap every anchor) | 3518 | 0.31 | 2.86 | 9.27 | 11.35 | 14.76 | 14.45 | 0 | 0.00 | 0.00 |
| webkit-i10-s1-d60-r3 | tuning | slew + snap ≥ 20 ms | 3518 | 0.28 | 2.71 | 8.68 | 10.65 | 13.00 | 12.72 | 4 | 4.05 | 26.33 |
| webkit-i10-s1-d60-r3 | tuning | slew + snap ≥ 30 ms | 3518 | 0.29 | 2.72 | 8.68 | 10.66 | 13.01 | 12.72 | 0 | 0.00 | 0.00 |
| webkit-i10-s1-d60-r3 | tuning | slew + snap ≥ 40 ms | 3518 | 0.29 | 2.72 | 8.68 | 10.66 | 13.01 | 12.72 | 0 | 0.00 | 0.00 |
| webkit-i10-s1-d60-r3 | tuning | slew, never snap | 3518 | 0.29 | 2.72 | 8.68 | 10.66 | 13.01 | 12.72 | 0 | 0.00 | 0.00 |
| webkit-i10-s1.5-d60-r1 | held-out | interpolation (snap every anchor) | 3528 | 0.43 | 3.13 | 8.47 | 11.29 | 15.30 | 14.87 | 0 | 0.00 | 0.00 |
| webkit-i10-s1.5-d60-r1 | held-out | slew + snap ≥ 20 ms | 3528 | 0.49 | 2.93 | 7.59 | 9.82 | 13.10 | 12.61 | 0 | 0.00 | 0.00 |
| webkit-i10-s1.5-d60-r1 | held-out | slew + snap ≥ 30 ms | 3528 | 0.49 | 2.93 | 7.59 | 9.82 | 13.10 | 12.61 | 0 | 0.00 | 0.00 |
| webkit-i10-s1.5-d60-r1 | held-out | slew + snap ≥ 40 ms | 3528 | 0.49 | 2.93 | 7.59 | 9.82 | 13.10 | 12.61 | 0 | 0.00 | 0.00 |
| webkit-i10-s1.5-d60-r1 | held-out | slew, never snap | 3528 | 0.49 | 2.93 | 7.59 | 9.82 | 13.10 | 12.61 | 0 | 0.00 | 0.00 |

### Per browser and interval (pooled runs; worst run in brackets)

| Browser | Interval | Variant | Runs | Frames | p95 range over runs | worst p99 | worst max | Snaps total | Snaps/min (worst run) | Max snap |
|---|---|---|---|---|---|---|---|---|---|---|
| chromium | 0 | interpolation (snap every anchor) | 3 | 10701 | 0.26–0.61 | 2.60 | 10.40 | 0 | 0.00 | 0.00 |
| chromium | 0 | slew + snap ≥ 20 ms | 3 | 10701 | 0.24–0.53 | 0.90 | 5.23 | 2 | 2.02 | 24.90 |
| chromium | 0 | slew + snap ≥ 30 ms | 3 | 10701 | 0.24–0.53 | 0.90 | 3.32 | 0 | 0.00 | 0.00 |
| chromium | 0 | slew + snap ≥ 40 ms | 3 | 10701 | 0.24–0.53 | 0.90 | 3.32 | 0 | 0.00 | 0.00 |
| chromium | 0 | slew, never snap | 3 | 10701 | 0.24–0.53 | 0.90 | 3.32 | 0 | 0.00 | 0.00 |
| chromium | 10 | interpolation (snap every anchor) | 6 | 35807 | 0.21–0.70 | 1.23 | 9.54 | 1 | 1.01 | 63.23 |
| chromium | 10 | slew + snap ≥ 20 ms | 6 | 35807 | 0.23–0.58 | 0.91 | 3.13 | 4 | 4.03 | 63.23 |
| chromium | 10 | slew + snap ≥ 30 ms | 6 | 35807 | 0.23–0.58 | 0.91 | 3.13 | 3 | 3.03 | 63.23 |
| chromium | 10 | slew + snap ≥ 40 ms | 6 | 35807 | 0.23–0.59 | 0.98 | 19.55 | 2 | 2.02 | 63.23 |
| chromium | 10 | slew, never snap | 6 | 35807 | 0.23–0.58 | 0.91 | 3.13 | 0 | 0.00 | 0.00 |
| webkit | 0 | interpolation (snap every anchor) | 3 | 10580 | 4.58–7.89 | 9.66 | 19.25 | 3 | 1.01 | 53.33 |
| webkit | 0 | slew + snap ≥ 20 ms | 3 | 10580 | 4.45–7.96 | 9.71 | 28.08 | 16 | 6.07 | 53.33 |
| webkit | 0 | slew + snap ≥ 30 ms | 3 | 10580 | 4.43–7.89 | 9.54 | 17.45 | 6 | 2.02 | 53.33 |
| webkit | 0 | slew + snap ≥ 40 ms | 3 | 10580 | 4.43–7.88 | 9.54 | 49.46 | 4 | 2.02 | 53.33 |
| webkit | 0 | slew, never snap | 3 | 10580 | 4.43–7.88 | 9.54 | 10.32 | 0 | 0.00 | 0.00 |
| webkit | 10 | interpolation (snap every anchor) | 6 | 35601 | 7.54–13.49 | 16.74 | 145.71 | 17 | 4.04 | 296.33 |
| webkit | 10 | slew + snap ≥ 20 ms | 6 | 35601 | 6.87–13.33 | 16.45 | 145.68 | 95 | 22.16 | 296.33 |
| webkit | 10 | slew + snap ≥ 30 ms | 6 | 35601 | 6.88–13.26 | 16.37 | 145.68 | 40 | 13.13 | 296.33 |
| webkit | 10 | slew + snap ≥ 40 ms | 6 | 35601 | 6.89–13.03 | 16.60 | 145.73 | 22 | 8.08 | 296.33 |
| webkit | 10 | slew, never snap | 6 | 35601 | 6.89–14.37 | 134.78 | 145.65 | 0 | 0.00 | 0.00 |

### Plain interpolation: corrections per run (|delta| ≥ 5 / 20 / 30 / 40 ms; each is a visible jump under this policy)

| Run | ≥ 5 | ≥ 20 | ≥ 30 | ≥ 40 |
|---|---|---|---|---|
| chromium-i0-s1-d60-r1 | 5 | 0 | 0 | 0 |
| chromium-i0-s1-d60-r2 | 28 | 0 | 0 | 0 |
| chromium-i0-s1-d60-r3 | 18 | 0 | 0 | 0 |
| chromium-i10-s0.5-d60-r1 | 5 | 0 | 0 | 0 |
| chromium-i10-s1-d300-r1 | 39 | 0 | 0 | 0 |
| chromium-i10-s1-d60-r1 | 4 | 0 | 0 | 0 |
| chromium-i10-s1-d60-r2 | 25 | 1 | 1 | 1 |
| chromium-i10-s1-d60-r3 | 7 | 0 | 0 | 0 |
| chromium-i10-s1.5-d60-r1 | 8 | 0 | 0 | 0 |
| webkit-i0-s1-d60-r1 | 658 | 3 | 1 | 1 |
| webkit-i0-s1-d60-r2 | 661 | 3 | 1 | 1 |
| webkit-i0-s1-d60-r3 | 679 | 2 | 1 | 0 |
| webkit-i10-s0.5-d60-r1 | 333 | 1 | 1 | 0 |
| webkit-i10-s1-d300-r1 | 1286 | 20 | 9 | 5 |
| webkit-i10-s1-d60-r1 | 477 | 9 | 3 | 2 |
| webkit-i10-s1-d60-r2 | 375 | 6 | 4 | 3 |
| webkit-i10-s1-d60-r3 | 331 | 1 | 0 | 0 |
| webkit-i10-s1.5-d60-r1 | 326 | 0 | 0 | 0 |

### Anchor availability and event checks (interpolation variant; identical for every variant)

| Run | Seeks | Wait play → first anchor (ms) | Waits seek → anchor (ms) | Anchor gaps > 50 ms | Max gap | Duplicates rejected | Out of order |
|---|---|---|---|---|---|---|---|
| chromium-i0-s1-d60-r1 | 7 | 144.5 | 144.6 | 0 | 0.00 | 1 | 0 |
| chromium-i0-s1-d60-r2 | 7 | 167.4 | 167.4 | 0 | 0.00 | 1 | 0 |
| chromium-i0-s1-d60-r3 | 7 | 138.7 | 138.7 | 0 | 0.00 | 1 | 0 |
| chromium-i10-s0.5-d60-r1 | 7 | 190.6 | 190.6 | 0 | 0.00 | 1 | 0 |
| chromium-i10-s1-d300-r1 | 7 | 167.4 | 167.6 | 0 | 0.00 | 1 | 0 |
| chromium-i10-s1-d60-r1 | 7 | 214.6 | 216.5 | 0 | 0.00 | 1 | 0 |
| chromium-i10-s1-d60-r2 | 7 | 197.3 | 197.3 | 1 | 73.90 | 1 | 0 |
| chromium-i10-s1-d60-r3 | 7 | 170 | 170 | 0 | 0.00 | 1 | 0 |
| chromium-i10-s1.5-d60-r1 | 7 | 175.7 | 175.8 | 0 | 0.00 | 1 | 0 |
| webkit-i0-s1-d60-r1 | 7 | 259 | 259 | 1 | 56.00 | 1 | 0 |
| webkit-i0-s1-d60-r2 | 7 | 246 | 246 | 0 | 0.00 | 1 | 0 |
| webkit-i0-s1-d60-r3 | 7 | 287 | 287 | 0 | 0.00 | 1 | 0 |
| webkit-i10-s0.5-d60-r1 | 7 | 279 | 279 | 0 | 0.00 | 1 | 0 |
| webkit-i10-s1-d300-r1 | 7 | 275 | 275 | 5 | 95.00 | 1 | 0 |
| webkit-i10-s1-d60-r1 | 7 | 345 | 345 | 2 | 87.00 | 1 | 0 |
| webkit-i10-s1-d60-r2 | 7 | 272 | 272 | 3 | 307.00 | 1 | 0 |
| webkit-i10-s1-d60-r3 | 7 | 315 | 315 | 0 | 0.00 | 1 | 0 |
| webkit-i10-s1.5-d60-r1 | 7 | 263 | 263 | 0 | 0.00 | 1 | 0 |

### Exploratory slew rates (threshold 30 ms): tuning runs vs held-out runs

| Variant | Browser | Interval | Split | Runs | p95 range | worst p99 | Snaps total |
|---|---|---|---|---|---|---|---|
| slew + snap ≥ 30 ms | chromium | 0 | tuning | 3 | 0.24–0.53 | 0.90 | 0 |
| exploratory: slew 5 % + snap ≥ 30 ms | chromium | 0 | tuning | 3 | 0.22–0.48 | 0.81 | 0 |
| exploratory: slew 20 % + snap ≥ 30 ms | chromium | 0 | tuning | 3 | 0.25–0.57 | 1.06 | 0 |
| slew + snap ≥ 30 ms | chromium | 10 | held-out | 3 | 0.41–0.50 | 0.85 | 0 |
| exploratory: slew 5 % + snap ≥ 30 ms | chromium | 10 | held-out | 3 | 0.37–0.40 | 0.60 | 0 |
| exploratory: slew 20 % + snap ≥ 30 ms | chromium | 10 | held-out | 3 | 0.41–0.54 | 1.00 | 0 |
| slew + snap ≥ 30 ms | chromium | 10 | tuning | 3 | 0.23–0.58 | 0.91 | 3 |
| exploratory: slew 5 % + snap ≥ 30 ms | chromium | 10 | tuning | 3 | 0.21–0.45 | 0.71 | 3 |
| exploratory: slew 20 % + snap ≥ 30 ms | chromium | 10 | tuning | 3 | 0.21–0.65 | 1.15 | 3 |
| slew + snap ≥ 30 ms | webkit | 0 | tuning | 3 | 4.43–7.89 | 9.54 | 6 |
| exploratory: slew 5 % + snap ≥ 30 ms | webkit | 0 | tuning | 3 | 4.38–7.88 | 9.50 | 6 |
| exploratory: slew 20 % + snap ≥ 30 ms | webkit | 0 | tuning | 3 | 4.49–7.90 | 9.63 | 6 |
| slew + snap ≥ 30 ms | webkit | 10 | held-out | 3 | 6.88–12.20 | 15.42 | 20 |
| exploratory: slew 5 % + snap ≥ 30 ms | webkit | 10 | held-out | 3 | 6.50–12.09 | 15.31 | 20 |
| exploratory: slew 20 % + snap ≥ 30 ms | webkit | 10 | held-out | 3 | 7.15–12.29 | 15.42 | 20 |
| slew + snap ≥ 30 ms | webkit | 10 | tuning | 3 | 8.68–13.26 | 16.37 | 20 |
| exploratory: slew 5 % + snap ≥ 30 ms | webkit | 10 | tuning | 3 | 8.41–13.13 | 16.35 | 22 |
| exploratory: slew 20 % + snap ≥ 30 ms | webkit | 10 | tuning | 3 | 8.85–13.39 | 16.43 | 20 |
