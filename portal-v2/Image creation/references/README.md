# Puppy Reference Pack

This folder is the locked style reference set for the puppy animation project.

## Source Screens (Copied Local Files)

- `source_screens/ref-01.png` brown puppy, 9 poses
- `source_screens/ref-02.png` dalmatian puppy, 9 poses
- `source_screens/ref-03.png` tricolor beagle-like puppy, 9 poses
- `source_screens/ref-04.png` basset-style puppy, 9 poses
- `source_screens/ref-05.png` yorkie-style puppy, 9 poses
- `source_screens/ref-06.png` multi-breed side-view lineup
- `source_screens/ref-07.png` multi-breed face lineup
- `source_screens/ref-08.png` corgi-like puppy, 9 poses

## Extracted Pose Grids

Generated with:

```bash
python3 scripts/extract_pose_grids.py \
  --input references/source_screens/ref-01.png \
          references/source_screens/ref-02.png \
          references/source_screens/ref-03.png \
          references/source_screens/ref-04.png \
          references/source_screens/ref-05.png \
          references/source_screens/ref-08.png
```

Output path pattern:

- `pose_grids/ref-0X/ref-0X-trimmed.png`
- `pose_grids/ref-0X/pose-r{row}c{col}.png`

## Style Lock

- Keep silhouettes, muzzle length, ear shape, leg thickness, and tail placement faithful to these references.
- Start from `ref-01` as Puppy 01 master.
- Do not "improve" proportions toward realism; preserve the stock-cartoon geometry.

## Licensing Note

Some source sets appear to come from stock-vector marketplaces. Keep the source trail in `source_manifest.json` and replace screenshot-derived assets with purchased vector originals once licensed.
