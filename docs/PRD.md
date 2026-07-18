# PRD — Cathedral of Threads

Status: Hackathon build  
Platform: Desktop web  
Framework: Astro + Three.js + GSAP

## 1. Product statement

Cathedral of Threads is a one-page interactive 3D journey into an original
metaphysical "Coordinate": a place outside ordinary time where every human
memory appears as a luminous path converging into one impossible structure.

The experience borrows the emotional vocabulary of mythic blue-sand liminal
spaces and a world-spanning convergence point, but it does not use anime
characters, names, symbols, dialogue, music, or production artwork.

## 2. Audience and outcome

Primary audience:

- Creative-web hackathon judges.
- Developers and designers interested in GSAP, WebGL, Astro, and Webflow Cloud.
- Visitors who should understand the idea without reading a long explanation.

Desired outcome:

- Within five seconds, the visitor sees one memorable visual idea.
- The first scroll immediately moves the camera and confirms that the page is an
  experience, not a static landing page.
- The visitor completes a 30–60 second journey to the Coordinate and can replay it
  by scrolling back.

## 3. Experience scope

The experience is desktop-first and contains one route with one continuous scroll
timeline. A sticky full-viewport stage remains in place while a 500vh scroll
track advances the scene.

Included:

- Full-screen Three.js scene.
- Procedural sand surface, memory filaments, central luminous tree/core, fog,
  particles, and restrained bloom.
- Real GSAP loading/reveal sequence.
- GSAP `ScrollTrigger` timeline controlling camera position, scene rotation,
  filament intensity, and HTML copy.
- Pointer-based micro-parallax on desktop.
- Intro title, scroll prompt, chapter progress, and About.
- Functional full-screen About overlay.
- Reduced-motion behavior and WebGL failure fallback.

Not included:

- Mobile-specific 3D optimization or the future 2D mobile experience.
- Sound design.
- Backend, accounts, analytics, CMS, or persistence.
- Webflow Cloud deployment work.
- Purchased or generated character models.
- Direct copyrighted anime assets.

## 4. Experience flow

### Beat 0 — Awakening

The page opens behind a dark blue loading veil. A thin line and the word
"Connecting" appear. When the WebGL scene is ready, GSAP contracts the line,
slides the veil away, and reveals the world.

### Beat 1 — Threshold (0–18%)

The camera is low over dark blue sand. The complete luminous tree is visible in
the distance. The title "Cathedral of Threads", a one-line premise, and "Scroll
to enter" establish the interaction.

### Beat 2 — Approach (18–52%)

The title recedes and fades as the camera glides over the sand. Foreground memory
paths pass around the camera. Small pulses travel toward the center. Pointer
movement creates a restrained lateral drift.

### Beat 3 — Convergence (52–82%)

The camera reaches the trunk/core and tilts upward. Branch density and bloom
increase slightly. A single chapter line appears: "Every path remembers."

### Beat 4 — Afterglow (82–100%)

The camera passes close to the Coordinate and settles in a calm elevated view.
The final line appears: "Nothing is ever truly lost." About remains
available. Scrolling upward reverses the entire journey.

## 5. Information architecture

There is no conventional header.

Persistent or contextual UI:

- Top-left: minimal wordmark/title during the opening beat only.
- Bottom-left: scroll instruction, then current chapter label.
- Right edge: quiet vertical progress rail.
- Bottom-right: About button.
- Center overlay: loading veil and later chapter copy.

All UI text is HTML. The canvas is visual and marked as decorative.

## 6. Visual direction

- Palette: midnight navy, cobalt, moonlit cyan, bone-white highlights.
- Environment: infinite blue sand with no obvious real-world location.
- Coordinate: an enormous tree/cathedral formed from thousands of branching,
  translucent memory filaments.
- Camera: cinematic low starting angle, slow dolly, gentle tilt, no orbit-control
  UI.
- Typography: high-contrast editorial serif for the title; neutral sans-serif for
  instructions and utility UI.
- Motion: slow, inevitable, reversible, and tied to scroll. Avoid bounce, elastic
  UI motion, and generic cyberpunk HUD effects.

## 7. Technical approach

### Scene

- Three.js renders one scene into one canvas.
- The Coordinate is procedural: curves, points, and simple
  geometries. This is the correct first implementation because it stays editable,
  light, and naturally animated.
- A displaced plane provides sand without a texture dependency.
- `EffectComposer`, `RenderPass`, and `UnrealBloomPass` provide restrained glow.
- The renderer uses ACES tone mapping and a DPR cap of 1.5.

### Animation

- A single GSAP master timeline is scrubbed by `ScrollTrigger`.
- GSAP animates camera and scene object properties. Three.js owns the render loop.
- The initial load reveal is a separate non-scrubbed GSAP timeline.
- `prefers-reduced-motion` skips long camera travel and shows a readable static
  composition.

### Future authored assets

No 3D model is required for the current build. If procedural geometry cannot deliver the
desired silhouette later:

1. Block out the core/root silhouette in Blender.
2. Keep emissive filament motion in code.
3. Export only the authored core as a single optimized `.glb`.
4. Load it through Three.js `GLTFLoader`.
5. Measure before adding Draco, Meshopt, or KTX2.

Blender's glTF exporter and the Three.js loader are the preferred pipeline:

- <https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html>
- <https://threejs.org/docs/pages/GLTFLoader.html>

For neutral HDRIs, sand/rock references, or PBR materials, prefer clearly licensed
CC0 sources such as Poly Haven:

- <https://polyhaven.com/license>

Paid marketplace assets should be considered only for a distinctive sculptural
core that would take longer to author than the hackathon allows. Before purchase,
confirm commercial/web redistribution terms and record the license. Do not buy a
complete scene: it will be harder to optimize, animate, and make original.

- Fab marketplace: <https://www.fab.com/>
- Fab Standard License: <https://www.fab.com/eula>

AI-generated 3D can be useful for rough ideation, but generated topology usually
needs Blender cleanup, retopology, UV review, and aggressive optimization before
shipping to WebGL. It is not the critical path for this hackathon build.

## 8. Performance and quality targets

- 60 fps target on a modern laptop; usable at 40+ fps on integrated graphics.
- Fewer than 120 draw calls in the current build.
- DPR capped at 1.5.
- Initial compressed JavaScript target: approximately 450 KB or less.
- Initial transferred experience: under 5 MB before authored models.
- No 4K texture requirement in the first viewport.
- Scene resize, tab visibility pause, and full disposal are required.

## 9. Acceptance criteria

- The production build succeeds with no Astro/TypeScript errors.
- Loading reveal visibly uses GSAP and cannot leave a permanent blocking veil.
- The first wheel/trackpad movement changes both HTML copy and the 3D camera.
- Scrolling backward reverses the scene cleanly.
- About opens as a full-screen overlay, closes by button and Escape, and is
  keyboard reachable.
- The canvas remains full-bleed without horizontal overflow at desktop widths.
- Reduced-motion users can access all content without a long scrub journey.
- The first viewport retains blue sand, a central luminous tree, sparse
  left-side title, and minimal UI without depending on an external reference image.

## 10. Later phases

1. Art-direction pass: improve tree silhouette, sand shading, and traveling light
   pulses.
2. Authored Blender core or root mesh only if the procedural version is limiting.
3. Sound design with an explicit mute control.
4. Separate lightweight mobile 2D treatment.
5. Performance profiling and asset compression.
6. Webflow Cloud deployment and production observability.
