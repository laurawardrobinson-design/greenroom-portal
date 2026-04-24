# Puppy Animation Research Synthesis

Date: 2026-04-13  
Scope: web-app virtual puppy with locked visual style and interactive behaviors.

## 1. Animation System Recommendations

- Use a state-driven animation graph (idle/walk/run as loops; jump/twirl as one-shots; beg/paws-up as expressive holds).
- Keep anticipation and follow-through in every expressive action.
- Use variable frame durations instead of uniform timing for livelier motion.

Suggested state keys:

- `puppy_idle`
- `puppy_walk`
- `puppy_run`
- `puppy_jump_start`
- `puppy_jump_air`
- `puppy_jump_land`
- `puppy_beg`
- `puppy_twirl`
- `puppy_paws_up`

Suggested starting timing:

- idle: 6-8 fps
- walk: 8-10 fps
- run: 10-12 fps
- jump segments: ~12 fps with short holds
- beg/paws-up: 6-8 fps or partial hold

References:

- [Unity Animation State Machines](https://docs.unity3d.com/kr/2018.3/Manual/AnimationStateMachines.html)
- [Phaser Animations](https://docs.phaser.io/phaser/concepts/animations)
- [Aseprite Animation](https://www.aseprite.org/docs/animation/)
- [Aseprite Tags](https://www.aseprite.org/docs/tags/)

## 2. Virtual Puppy Game Design Recommendations

- Use a compact simulation tick for needs and a separate render loop for visuals.
- Keep the core loop short: notice need -> interact in world -> immediate visual response -> small progression.
- Use a hierarchical state model to avoid combinatorial animation/behavior growth.
- Model first gameplay interactions as:
  - carry toy
  - feed/eat
  - nap/sleep

References:

- [MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- [Game Programming Patterns: Game Loop](https://gameprogrammingpatterns.com/game-loop.html)
- [Game Programming Patterns: State](https://gameprogrammingpatterns.com/state.html)
- [Game Programming Patterns: Component](https://gameprogrammingpatterns.com/component.html)
- [NN/g Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)

## 3. Articulation / Rigging Recommendations

- Because style is locked, use a hybrid pipeline:
  - key silhouettes baked as sprite frames
  - limited rigging for low-risk secondary parts (ears, tail, eyes, mouth)
- Keep per-direction attachment sets instead of rotating one rig.
- Lock pivots, baseline, and draw order across all directions.

References:

- [MDN Canvas drawImage](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage)
- [MDN OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)
- [PixiJS Spritesheets](https://pixijs.com/7.x/guides/components/sprite-sheets)
- [PixiJS Performance Tips](https://pixijs.com/8.x/guides/concepts/performance-tips)
- [Spine Runtime Skeletons](https://esotericsoftware.com/spine-runtime-skeletons)
- [Spine Runtime Skins](https://esotericsoftware.com/spine-runtime-skins)
- [Spine Meshes](https://en.esotericsoftware.com/spine-meshes)
- [Spine Texture Packer](https://esotericsoftware.com/spine-texture-packer)
- [Adobe Export for Screens](https://helpx.adobe.com/illustrator/desktop/save-and-export/export-files-to-different-formats/export-for-screens.html)

## 4. Decisions For Puppy 01

- Start with `ref-01` as the master style lock.
- Build side-view locomotion first (`idle`, `walk`, `run`).
- Add expressive actions next (`beg`, `paws_up`, `jump`, `twirl`).
- Keep all assets versioned as source + exported derivatives.

## 5. Immediate Production Risks

- Source licensing must be finalized before shipping extracted/derived assets.
- Over-rigging can drift silhouettes away from style references.
- Too many early interaction states can slow implementation and QA.
