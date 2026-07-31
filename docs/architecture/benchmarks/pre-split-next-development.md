# Pre-split Next development memory baseline

Measured on macOS arm64 with Node v22.22.3 on 2026-07-31 using:

```text
node scripts/measure-local-dev.mjs --pid 56230 --duration-ms 600000 --sample-interval-ms 1000 --prompt-interval-ms 5000
```

Each run sampled the whole existing Next development process tree for ten
minutes while a deterministic fixture agent received 120 prompts. Unrelated
`codex-acp` and `claude-agent-acp` process subtrees were reported as ambient
memory but excluded from the calibrated figure.

| Measurement | Run 1 | Run 2 | Change |
| --- | ---: | ---: | ---: |
| Measured at | 2026-07-30T23:12:07.106Z | 2026-07-30T23:28:21.578Z | — |
| Samples | 601 | 601 | — |
| Filtered peak RSS | 2539.0 MB | 2979.3 MB | +17.3% |
| Filtered final RSS | 1570.6 MB | 2838.2 MB | +80.7% |
| Gross peak RSS | 3095.8 MB | 3202.4 MB | +3.4% |
| Gross final RSS | 2098.8 MB | 2867.8 MB | +36.6% |
| Peak process count | 14 | 14 | 0 |
| Final process count | 13 | 13 | 0 |
| Next peak RSS | 2293.8 MB | 2805.2 MB | +22.3% |
| Ambient RSS at gross peak | 574.0 MB | 476.7 MB | -17.0% |
| Ambient RSS at final sample | 528.1 MB | 29.6 MB | -94.4% |

The two filtered peaks exceeded the documented 15% repeat tolerance by 2.3
percentage points, and the final samples diverged substantially. Process
inspection attributes nearly all of the filtered peak to `next-server`, not
the deterministic fixture. The baseline is therefore intentionally recorded
as unstable and above the split design's `<2 GB` development target. It is not
used to weaken that target. Task 11 must repeat the same workload against the
runner plus Vite topology and pass the absolute limit.

The measurement parser/sampler suite has five passing tests covering
process-tree aggregation, timing, ambient-agent filtering, and fixture cleanup.
The exact fixture agent left by the second run was removed after inspection;
unrelated user agent processes were not touched.
