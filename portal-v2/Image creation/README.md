# Puppy Sprite Build Workspace

This workspace now contains the starter production pack for Puppy 01.

## What is ready

- Reference screenshots copied locally:
  - `references/source_screens/ref-01.png` ... `ref-08.png`
- Pose extraction tool:
  - `scripts/extract_pose_grids.py`
- Extracted 3x3 poses for core sheets:
  - `references/pose_grids/ref-01` ... `ref-05`, `ref-08`
- Research synthesis:
  - `research/puppy-animation-research.md`
- Articulation + animation spec:
  - `specs/puppy01-spec.json`
  - `specs/puppy01-pose-map.json`
- Delivery plan:
  - `docs/puppy01-production-plan.md`
- Quick visual browser:
  - `preview/reference-index.html`

## Regenerating pose grids

```bash
python3 scripts/extract_pose_grids.py \
  --input references/source_screens/ref-01.png \
          references/source_screens/ref-02.png \
          references/source_screens/ref-03.png \
          references/source_screens/ref-04.png \
          references/source_screens/ref-05.png \
          references/source_screens/ref-08.png
```

## Building atlas + animation preview

```bash
python3 scripts/build_puppy01_atlas.py
```

Outputs:

- `preview/puppy01-atlas.png`
- `preview/puppy01-atlas.json`
- `preview/puppy01-anim-preview.html`
