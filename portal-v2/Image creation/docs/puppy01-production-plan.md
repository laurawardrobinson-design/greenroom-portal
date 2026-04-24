# Puppy 01 Production Plan

## Goal

Build Puppy 01 with exact locked aesthetics from `ref-01` and production-ready animation behavior for a web-app game.

## Phase 1 (Now): Reference + Spec Lock

- [x] Copy and preserve user reference sheets locally.
- [x] Extract pose-grid cells for pose-by-pose comparison.
- [x] Define animation and articulation baseline spec.
- [x] Gather research on animation, game loop, and articulation pipeline.

## Phase 2: Source Asset Acquisition

- [ ] Confirm exact marketplace listings for all 8 references.
- [ ] Purchase vector originals (or provide licensed source files).
- [ ] Replace screenshot-derived references with licensed vector source pack.

## Phase 3: Puppy 01 Art Build

- [ ] Create clean master turnaround:
  - side (primary)
  - front
  - back
  - optional 3/4
- [ ] Slice parts for hybrid pipeline:
  - rigid shells: torso/head base
  - secondary pieces: ears/tail/face swaps
- [ ] Lock pivot map and baseline.

## Phase 4: Animation Build

- [ ] Locomotion: idle, walk, run
- [ ] Expressive: jump, beg, twirl, paws-up
- [ ] Interaction: carry toy, eat, nap

## Phase 5: Runtime Integration

- [ ] Build animation controller with strict state keys.
- [ ] Hook actions to interaction events.
- [ ] Add QA overlay for silhouette and ground-contact drift checks.

## Hard Constraints

- Do not drift from reference silhouette.
- No proportional changes between states/directions.
- Keep style minimal and flat-shaded (no realism pass).
