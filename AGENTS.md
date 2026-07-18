# Project Working Agreement

This repository is an Astro single-page, desktop-first immersive WebGL experience.
The product target and scope live in `docs/PRD.md`.

## Product boundaries

- Keep the experience original. The mood may evoke a mythic shared-memory
  "coordinate", but do not copy anime characters, names, symbols, costumes,
  dialogue, music, or production artwork.
- The MVP is one continuous desktop page. Scroll advances one cinematic
  timeline; it must not navigate between routes.
- Do not add a conventional header. Keep persistent UI limited to the scroll
  prompt, progress marker, sound/status controls if introduced, and About.
- Mobile 3D is out of scope for the MVP. Any later mobile experience should use a
  deliberate 2D or reduced-complexity treatment, not a broken desktop canvas.

## Astro and TypeScript

- Keep Astro server/frontmatter code free of `window`, `document`, WebGL, and
  browser-only imports. Initialize Three.js and GSAP only from bundled client
  scripts.
- Use TypeScript for scene and interaction code. Avoid `any`; model shared
  animation state with small explicit types.
- Keep the page as composition. Scene lifecycle belongs in a focused controller,
  not in `index.astro` or the layout.
- Run `pnpm check` and `pnpm build` before handing off changes.

## Three.js

- Import Three.js from `three` and official extras from `three/addons/...`.
  Do not add a second 3D runtime without an explicit architectural decision.
- Use one renderer, one animation loop, and at most one post-processing composer
  per canvas. GSAP may update scene properties but must not create a second RAF.
- Cap device pixel ratio at `1.5` for the desktop MVP. Resize from the canvas
  container, not assumed window dimensions.
- Prefer procedural `BufferGeometry`, shared materials, merged geometry, and
  instancing. Avoid creating objects, arrays, colors, or vectors inside the
  per-frame render loop.
- Keep bloom selective in practice: emissive lines/core should glow; sand and UI
  should retain contrast. Do not raise bloom to hide weak lighting/material work.
- Pause expensive updates when the document is hidden. Dispose geometries,
  materials, textures, render targets, listeners, and controls during teardown.
- Use deterministic seeded randomness for scene layout so screenshots and QA are
  reproducible.
- Future authored models belong in `public/models/` as optimized `.glb` files.
  Record source, author, license, and modifications in
  `public/models/README.md`. Never commit an asset with uncertain rights.
- Load future GLB assets with `GLTFLoader`. Introduce Draco, Meshopt, or KTX2 only
  when an actual measured asset warrants the extra decoder/runtime cost.

## GSAP

- Import GSAP through `src/lib/gsap.ts`. Register only the plugins used in
  production; do not import the full plugin catalog or ship `GSDevTools`.
- Use `gsap.context()` and revert it in teardown. Kill associated
  `ScrollTrigger` instances and DOM listeners.
- Use one master scroll timeline for the story. Labels should identify narrative
  beats such as `threshold`, `approach`, `convergence`, and `afterglow`.
- Prefer a numeric `scrub` value for damped camera movement. Avoid mixing scrubbed
  tweens with competing CSS transitions on the same property.
- Animate Three.js object properties directly. Mark state dirty only when needed;
  rendering remains owned by the scene controller.
- Use `gsap.matchMedia()` and respect `prefers-reduced-motion`. Reduced motion
  must reveal the scene and content without long scrubbing or parallax.
- Loading/reveal motion must be interruptible and must never leave the page
  covered if WebGL initialization fails.

## CSS, UI, and accessibility

- Keep the WebGL canvas decorative to assistive technology; expose the story,
  instructions, and About content in semantic HTML.
- Use a real button for About and a native dialog or accessible equivalent.
  Support keyboard close and visible focus states.
- Keep text readable over the brightest scene state. Favor restrained typography,
  wide spacing, and very few visible controls.
- Do not use Tailwind/DaisyUI classes for the cinematic surface unless they
  materially simplify an existing pattern. Component CSS is preferred for exact
  visual control.
- Never block content on a fake loading percentage. The loader exits on actual
  scene readiness, with a guarded timeout/failure state.

## Performance budgets

- Target 60 fps on a modern laptop and remain usable at 40+ fps on integrated
  graphics.
- Keep draw calls below 120 in the MVP and cap DPR at 1.5.
- Keep the initial compressed JavaScript target below roughly 450 KB and the
  initial transferred experience below 5 MB before authored models are added.
- Avoid 4K textures in the initial viewport. Add compressed assets only after
  measuring visual impact and transfer cost.
