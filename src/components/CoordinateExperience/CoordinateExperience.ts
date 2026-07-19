import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { gsap, ScrollTrigger } from "@/lib/gsap";

type SceneController = {
  motionState: {
    journey: number;
    illumination: number;
    afterglow: number;
    themeMix: number;
  };
  treeMaterials: LineMaterial[];
  dispose: () => void;
};

type CoordinateTheme = "dark" | "light";

type TerrainProfile = {
  seed: number;
  phaseA: number;
  phaseB: number;
  phaseC: number;
  phaseD: number;
};

type TerrainLayerDefinition = {
  centerZ: number;
  depth: number;
  heightOffset: number;
  ridgeHeight: number;
  shadow: THREE.ColorRepresentation;
  highlight: THREE.ColorRepresentation;
  lightShadow: THREE.ColorRepresentation;
  lightHighlight: THREE.ColorRepresentation;
  depthSegments: number;
};

type TimeRewindOptions = {
  experience: HTMLElement;
  button: HTMLButtonElement;
  label: HTMLElement;
  hint: HTMLElement;
  clickIndicator: HTMLElement;
  index: HTMLElement | null;
  rule: HTMLElement;
  timeWarp: HTMLElement;
  scrollTimeline: gsap.core.Timeline;
  onRewindStart: () => void;
  onRewindComplete: () => void;
};

const SCENE_PALETTES = {
  dark: {
    background: 0x051a40,
    fog: 0x051a40,
    hemisphereSky: 0x628fd0,
    hemisphereGround: 0x01030a,
    keyLight: 0x9ecfff,
    terrainEmissive: 0x08265d,
    core: 0xb9e4ff,
    thread: 0xc4e8ff,
    star: 0x91c9ff,
    terrainShadow: 0x02091d,
    terrainHighlight: 0x2872b5,
    duneFaces: [0x0a2b63, 0x0c306b, 0x0e3573, 0x103a7a],
  },
  light: {
    background: 0xd9cda7,
    fog: 0xe4d8b1,
    hemisphereSky: 0xf4e6b9,
    hemisphereGround: 0x6b5126,
    keyLight: 0xffdfa0,
    terrainEmissive: 0x75591e,
    core: 0x24170d,
    thread: 0x17110b,
    star: 0xe6d39d,
    terrainShadow: 0x5d4517,
    terrainHighlight: 0xe2c06b,
    duneFaces: [0x73551c, 0x8d6b27, 0xab8739, 0xc4a052],
  },
} as const;

const TRANSITION_NEUTRALS = {
  background: 0x565b61,
  fog: 0x686d73,
  hemisphereSky: 0x9ba1a8,
  hemisphereGround: 0x24272b,
  keyLight: 0xb4bac1,
  terrainEmissive: 0x34383d,
  core: 0x858b92,
  thread: 0x70757b,
  star: 0x959ba2,
} as const;

const root = document.querySelector<HTMLElement>("[data-coordinate-experience]");

if (root) {
  void initExperience(root);
}

async function initExperience(experience: HTMLElement) {
  const themeQuery = window.matchMedia("(prefers-color-scheme: light)");
  const themeOverride = new URLSearchParams(window.location.search).get("theme");
  const initialTheme: CoordinateTheme =
    themeOverride === "dark" || themeOverride === "light"
      ? themeOverride
      : themeQuery.matches
        ? "light"
        : "dark";
  experience.dataset.coordinateTheme = initialTheme;

  const canvas = experience.querySelector<HTMLCanvasElement>("[data-coordinate-canvas]");
  const loader = experience.querySelector<HTMLElement>("[data-coordinate-loader]");
  const loaderLabel = experience.querySelector<HTMLElement>("[data-loader-label]");
  const loaderLine = experience.querySelector<HTMLElement>("[data-loader-line]");
  const atmosphere = experience.querySelector<HTMLElement>(".coordinate-atmosphere");
  const themeStrike = experience.querySelector<HTMLElement>(
    "[data-coordinate-theme-strike]",
  );
  const intro = experience.querySelector<HTMLElement>("[data-coordinate-intro]");
  const scrollCue = experience.querySelector<HTMLElement>("[data-coordinate-scroll-cue]");
  const scrollWheel = experience.querySelector<HTMLElement>("[data-coordinate-scroll-wheel]");
  const progress = experience.querySelector<HTMLElement>("[data-coordinate-progress]");
  const index = experience.querySelector<HTMLElement>("[data-coordinate-index]");
  const whispers = {
    origin: experience.querySelector<HTMLElement>('[data-coordinate-whisper="origin"]'),
    distance: experience.querySelector<HTMLElement>('[data-coordinate-whisper="distance"]'),
    return: experience.querySelector<HTMLElement>('[data-coordinate-whisper="return"]'),
  };
  const chapters = {
    approach: experience.querySelector<HTMLElement>('[data-coordinate-chapter="approach"]'),
    convergence: experience.querySelector<HTMLElement>(
      '[data-coordinate-chapter="convergence"]',
    ),
    afterglow: experience.querySelector<HTMLElement>('[data-coordinate-chapter="afterglow"]'),
  };
  const rewindButton = experience.querySelector<HTMLButtonElement>("[data-time-rewind]");
  const rewindLabel = experience.querySelector<HTMLElement>("[data-time-rewind-label]");
  const rewindHint = experience.querySelector<HTMLElement>("[data-time-rewind-hint]");
  const rewindClick = experience.querySelector<HTMLElement>("[data-time-rewind-click]");
  const rewindRule = experience.querySelector<HTMLElement>("[data-time-rewind-rule]");
  const timeWarp = experience.querySelector<HTMLElement>("[data-time-warp]");

  if (
    !canvas ||
    !loader ||
    !loaderLabel ||
    !loaderLine ||
    !atmosphere ||
    !themeStrike ||
    !intro ||
    !scrollCue ||
    !progress ||
    !whispers.origin ||
    !whispers.distance ||
    !whispers.return ||
    !chapters.approach ||
    !chapters.convergence ||
    !chapters.afterglow ||
    !rewindButton ||
    !rewindLabel ||
    !rewindHint ||
    !rewindClick ||
    !rewindRule ||
    !timeWarp
  ) {
    return;
  }

  const cleanups: Array<() => void> = [];
  const motion = gsap.matchMedia();
  const context = gsap.context(() => undefined, experience);
  setupAboutDialog(experience, cleanups);

  try {
    const sceneController = createScene(canvas, initialTheme);
    cleanups.push(sceneController.dispose);
    let passageTheme = initialTheme;
    let destinationTheme: CoordinateTheme =
      passageTheme === "dark" ? "light" : "dark";
    let themeLockedForRewind = false;
    const themeEase = gsap.parseEase("power2.inOut");
    const uiThemeColors = {
      stageInk: createThemeColorInterpolator("#f7fbff", "#7f8489", "#0b0a08"),
      stageMuted: createThemeColorInterpolator(
        "rgba(223, 237, 255, 0.66)",
        "rgba(126, 131, 136, 0.67)",
        "rgba(15, 14, 10, 0.68)",
      ),
      stageFaint: createThemeColorInterpolator(
        "rgba(197, 222, 255, 0.32)",
        "rgba(120, 125, 130, 0.33)",
        "rgba(23, 21, 15, 0.34)",
      ),
      chapterInk: createThemeColorInterpolator(
        "rgba(245, 250, 255, 0.86)",
        "rgba(128, 133, 138, 0.87)",
        "rgba(12, 11, 8, 0.9)",
      ),
      whisperInk: createThemeColorInterpolator(
        "rgba(226, 241, 255, 0.7)",
        "rgba(126, 131, 136, 0.71)",
        "rgba(18, 16, 11, 0.74)",
      ),
      cueInk: createThemeColorInterpolator(
        "rgba(226, 240, 255, 0.72)",
        "rgba(126, 131, 136, 0.72)",
        "rgba(16, 15, 10, 0.74)",
      ),
      cueStrong: createThemeColorInterpolator("#eef8ff", "#82878c", "#0d0c09"),
      progressTrack: createThemeColorInterpolator(
        "rgba(204, 228, 255, 0.18)",
        "rgba(118, 123, 128, 0.19)",
        "rgba(17, 15, 10, 0.2)",
      ),
      progressFill: createThemeColorInterpolator(
        "rgba(229, 244, 255, 0.88)",
        "rgba(128, 133, 138, 0.87)",
        "rgba(12, 11, 8, 0.88)",
      ),
      controlInk: createThemeColorInterpolator(
        "rgba(226, 240, 255, 0.62)",
        "rgba(123, 128, 133, 0.64)",
        "rgba(15, 14, 10, 0.68)",
      ),
      controlStrong: createThemeColorInterpolator("#ffffff", "#7f8489", "#090806"),
      rewindHover: createThemeColorInterpolator("#06366e", "#70757a", "#855816"),
    };
    const applyThemeMix = (mix: number) => {
      const clampedMix = THREE.MathUtils.clamp(mix, 0, 1);
      sceneController.motionState.themeMix = clampedMix;
      const semanticTheme = clampedMix >= 0.5 ? "light" : "dark";
      if (experience.dataset.coordinateTheme !== semanticTheme) {
        experience.dataset.coordinateTheme = semanticTheme;
      }
      gsap.set(experience, {
        "--stage-ink": uiThemeColors.stageInk(clampedMix),
        "--stage-muted": uiThemeColors.stageMuted(clampedMix),
        "--stage-faint": uiThemeColors.stageFaint(clampedMix),
        "--chapter-ink": uiThemeColors.chapterInk(clampedMix),
        "--whisper-ink": uiThemeColors.whisperInk(clampedMix),
        "--cue-ink": uiThemeColors.cueInk(clampedMix),
        "--cue-strong": uiThemeColors.cueStrong(clampedMix),
        "--progress-track": uiThemeColors.progressTrack(clampedMix),
        "--progress-fill": uiThemeColors.progressFill(clampedMix),
        "--control-ink": uiThemeColors.controlInk(clampedMix),
        "--control-strong": uiThemeColors.controlStrong(clampedMix),
        "--rewind-hover": uiThemeColors.rewindHover(clampedMix),
      });
      gsap.set(canvas, {
        filter: `blur(${THREE.MathUtils.lerp(0.75, 0.65, clampedMix)}px) saturate(${THREE.MathUtils.lerp(0.88, 0.9, clampedMix)}) contrast(${THREE.MathUtils.lerp(1, 1.08, clampedMix)})`,
      });
      const strikeStrength = smoothNoiseStep(
        1 -
          THREE.MathUtils.clamp(
            Math.abs(clampedMix - 0.5) / 0.18,
            0,
            1,
          ),
      );
      gsap.set(themeStrike, {
        autoAlpha: strikeStrength * 0.9,
        scaleX: THREE.MathUtils.lerp(0.08, 1.08, strikeStrength),
        scaleY: THREE.MathUtils.lerp(0.94, 1, strikeStrength),
        filter: `blur(${THREE.MathUtils.lerp(22, 5, strikeStrength)}px)`,
      });
    };
    const updateThemeJourney = (scrollProgress: number) => {
      if (themeLockedForRewind) {
        return;
      }

      const transitionProgress = THREE.MathUtils.clamp(
        (scrollProgress - 0.04) / 0.92,
        0,
        1,
      );
      const startMix = passageTheme === "light" ? 1 : 0;
      const endMix = destinationTheme === "light" ? 1 : 0;
      applyThemeMix(
        THREE.MathUtils.lerp(
          startMix,
          endMix,
          themeEase(transitionProgress),
        ),
      );
    };
    const retainCurrentThemeForRewind = () => {
      themeLockedForRewind = true;
      passageTheme =
        sceneController.motionState.themeMix >= 0.5 ? "light" : "dark";
      destinationTheme = passageTheme === "dark" ? "light" : "dark";
      applyThemeMix(passageTheme === "light" ? 1 : 0);
    };
    const beginNextThemeJourney = () => {
      applyThemeMix(passageTheme === "light" ? 1 : 0);
      themeLockedForRewind = false;
    };

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    document.documentElement.classList.add("scene-ready");
    const reveal = gsap.timeline({
      defaults: { ease: "power3.inOut" },
      onComplete: () => {
        loader.hidden = true;
      },
    });

    reveal
      .to(loaderLine, { scaleX: 1, duration: 0.72 })
      .to(loaderLabel, { opacity: 0, y: -8, duration: 0.28 }, "-=0.18")
      .to(loader, { clipPath: "inset(0 0 100% 0)", duration: 1.15 }, "-=0.05")
      .to(canvas, { opacity: 1, duration: 0.72, ease: "power2.out" }, "-=0.82")
      .from(
        intro.querySelectorAll("h1 span, p"),
        {
          opacity: 0,
          y: 34,
          duration: 1.05,
          stagger: 0.12,
          ease: "power4.out",
        },
        "-=0.7",
      )
      .from(scrollCue, { opacity: 0, y: 16, duration: 0.7, ease: "power2.out" }, "-=0.55");

    motion.add("(prefers-reduced-motion: no-preference)", () => {
      const scrollCueTimeline = scrollWheel
        ? gsap
            .timeline({ repeat: -1, repeatDelay: 0.22 })
            .fromTo(
              scrollWheel,
              { autoAlpha: 0, y: -3 },
              { autoAlpha: 1, y: 1, duration: 0.42, ease: "power2.out" },
            )
            .to(scrollWheel, { autoAlpha: 0, y: 8, duration: 0.74, ease: "power2.in" })
        : null;
      const scrollTimeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: experience,
          start: "top top",
          end: "bottom bottom",
          scrub: 1.75,
          invalidateOnRefresh: true,
          onUpdate: ({ progress: scrollProgress }) => {
            updateThemeJourney(scrollProgress);
            if (index) {
              index.textContent = String(Math.min(4, Math.floor(scrollProgress * 4) + 1)).padStart(
                2,
                "0",
              );
            }
          },
        },
      });

      scrollTimeline
        .addLabel("threshold", 0)
        .to(progress, { scaleY: 1, duration: 1 }, 0)
        .to(sceneController.motionState, { journey: 1, duration: 1 }, 0)
        .to(
          sceneController.motionState,
          { illumination: 1, duration: 0.38, ease: "power1.in" },
          0.62,
        )
        .to(
          sceneController.motionState,
          { afterglow: 1, duration: 0.24, ease: "power2.in" },
          0.76,
        )
        .to(atmosphere, { opacity: 0.24, duration: 0.22, ease: "power2.inOut" }, 0.78)
        .to(intro, { autoAlpha: 0, y: -72, scale: 0.92, duration: 0.16 }, 0.04)
        .to(scrollCue, { autoAlpha: 0, y: 22, duration: 0.1 }, 0.03)
        .fromTo(
          chapters.approach,
          { autoAlpha: 0, x: -72, y: 22, filter: "blur(10px)" },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            filter: "blur(0px)",
            duration: 0.1,
            ease: "power3.out",
          },
          0.15,
        )
        .to(
          chapters.approach,
          {
            autoAlpha: 0,
            x: 54,
            y: -18,
            filter: "blur(7px)",
            duration: 0.09,
            ease: "power2.in",
          },
          0.27,
        )
        .fromTo(
          whispers.origin,
          { autoAlpha: 0, x: 64, y: 18, filter: "blur(8px)" },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            filter: "blur(0px)",
            duration: 0.08,
            ease: "power3.out",
          },
          0.28,
        )
        .to(
          whispers.origin,
          {
            autoAlpha: 0,
            x: -32,
            y: -14,
            filter: "blur(6px)",
            duration: 0.07,
            ease: "power2.in",
          },
          0.37,
        )
        .addLabel("approach", 0.32)
        .to(sceneController.treeMaterials[0], { opacity: 0.006, duration: 0.28 }, 0.34)
        .to(sceneController.treeMaterials[1], { opacity: 0.0095, duration: 0.28 }, 0.34)
        .to(sceneController.treeMaterials[2], { opacity: 0.0042, duration: 0.28 }, 0.34)
        .fromTo(
          chapters.convergence,
          { autoAlpha: 0, x: 76, y: 18, filter: "blur(10px)" },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            filter: "blur(0px)",
            duration: 0.1,
            ease: "power3.out",
          },
          0.4,
        )
        .to(
          chapters.convergence,
          {
            autoAlpha: 0,
            x: -48,
            y: -24,
            filter: "blur(8px)",
            duration: 0.08,
            ease: "power2.in",
          },
          0.53,
        )
        .fromTo(
          whispers.distance,
          { autoAlpha: 0, y: -24, filter: "blur(8px)", letterSpacing: "0.12em" },
          {
            autoAlpha: 1,
            y: 0,
            filter: "blur(0px)",
            letterSpacing: "0.025em",
            duration: 0.08,
            ease: "power3.out",
          },
          0.51,
        )
        .to(
          whispers.distance,
          {
            autoAlpha: 0,
            y: 20,
            filter: "blur(6px)",
            duration: 0.07,
            ease: "power2.in",
          },
          0.61,
        )
        .addLabel("convergence", 0.6)
        .to(sceneController.treeMaterials[0], { opacity: 0.009, duration: 0.36 }, 0.64)
        .to(sceneController.treeMaterials[1], { opacity: 0.014, duration: 0.36 }, 0.64)
        .to(sceneController.treeMaterials[2], { opacity: 0.0064, duration: 0.36 }, 0.64)
        .fromTo(
          whispers.return,
          { autoAlpha: 0, x: 72, y: 22, filter: "blur(9px)" },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            filter: "blur(0px)",
            duration: 0.08,
            ease: "power3.out",
          },
          0.62,
        )
        .to(
          whispers.return,
          {
            autoAlpha: 0,
            x: -44,
            y: -18,
            filter: "blur(7px)",
            duration: 0.07,
            ease: "power2.in",
          },
          0.72,
        )
        .fromTo(
          chapters.afterglow,
          {
            autoAlpha: 0,
            xPercent: -72,
            y: 42,
            color: "rgba(245, 250, 255, 0.92)",
            filter: "blur(12px)",
          },
          {
            autoAlpha: 1,
            xPercent: 0,
            y: 0,
            color: "rgba(245, 250, 255, 0.92)",
            filter: "blur(0px)",
            duration: 0.16,
            ease: "power4.out",
          },
          0.7,
        )
        .set(chapters.afterglow, { pointerEvents: "auto" }, 0.76)
        .to(
          chapters.afterglow,
          {
            color: "#020814",
            scale: 1.025,
            textShadow: "0 1px 18px rgba(255, 255, 255, 0.36)",
            duration: 0.2,
            ease: "power2.inOut",
          },
          0.8,
        )
        .fromTo(
          rewindHint,
          { autoAlpha: 0, y: 12 },
          { autoAlpha: 0.56, y: 0, duration: 0.11, ease: "power3.out" },
          0.86,
        )
        .fromTo(
          rewindRule,
          { scaleX: 0 },
          { scaleX: 1, duration: 0.1, ease: "power3.out" },
          0.88,
        )
        .addLabel("afterglow", 0.78);

      const rewindCleanup = setupTimeRewind({
        experience,
        button: rewindButton,
        label: rewindLabel,
        hint: rewindHint,
        clickIndicator: rewindClick,
        index,
        rule: rewindRule,
        timeWarp,
        scrollTimeline,
        onRewindStart: retainCurrentThemeForRewind,
        onRewindComplete: beginNextThemeJourney,
      });

      return () => {
        rewindCleanup();
        scrollCueTimeline?.kill();
        scrollTimeline.scrollTrigger?.kill();
        scrollTimeline.kill();
      };
    });

    motion.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(
        [
          chapters.approach,
          chapters.convergence,
          chapters.afterglow,
          whispers.origin,
          whispers.distance,
          whispers.return,
        ],
        { autoAlpha: 0 },
      );
      gsap.set(scrollCue, { autoAlpha: 0 });
    });
  } catch (error) {
    console.error("Unable to initialize the Coordinate scene.", error);
    document.documentElement.classList.add("webgl-failed", "scene-ready");
    loader.hidden = true;
    intro.insertAdjacentHTML(
      "beforeend",
      "<p class=\"coordinate-scene-error\">WebGL is unavailable. The story remains, but the scene could not be rendered.</p>",
    );
  }

  const teardown = () => {
    motion.revert();
    context.revert();
    cleanups.reverse().forEach((cleanup) => cleanup());
    document.documentElement.classList.remove("scene-ready", "webgl-failed");
  };

  document.addEventListener("astro:before-swap", teardown, { once: true });
}

function createScene(
  canvas: HTMLCanvasElement,
  initialTheme: CoordinateTheme,
): SceneController {
  const darkPalette = SCENE_PALETTES.dark;
  const lightPalette = SCENE_PALETTES.light;
  const initialThemeMix = initialTheme === "light" ? 1 : 0;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;

  const scene = new THREE.Scene();
  const sceneBackground = new THREE.Color(
    initialTheme === "light" ? lightPalette.background : darkPalette.background,
  );
  const sceneFog = new THREE.FogExp2(
    initialTheme === "light" ? lightPalette.fog : darkPalette.fog,
    THREE.MathUtils.lerp(0.0215, 0.0115, initialThemeMix),
  );
  scene.background = sceneBackground;
  scene.fog = sceneFog;

  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 620);
  const cameraPath = new THREE.Group();
  const cameraParallax = new THREE.Group();
  const motionState = {
    journey: 0,
    illumination: 0,
    afterglow: 0,
    themeMix: initialThemeMix,
  };
  const cameraCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, 0.7, 24),
      new THREE.Vector3(-0.36, 0.75, 10.5),
      new THREE.Vector3(-0.08, 1.05, 1.5),
      new THREE.Vector3(0.34, 2.45, -7.2),
      new THREE.Vector3(-0.12, 4.2, -10.4),
      new THREE.Vector3(0.22, 5.25, -12.8),
    ],
    false,
    "centripetal",
    0.5,
  );
  const cameraTargetCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0, 3.6, -18),
      new THREE.Vector3(0, 4.5, -18),
      new THREE.Vector3(0, 6.1, -18),
      new THREE.Vector3(0, 9.8, -18.05),
      new THREE.Vector3(0, 14.2, -18.1),
      new THREE.Vector3(0, 21.5, -18.2),
    ],
    false,
    "centripetal",
    0.5,
  );
  const cameraTarget = cameraTargetCurve.getPointAt(0);
  cameraCurve.getPointAt(0, cameraPath.position);
  cameraPath.add(cameraParallax);
  cameraParallax.add(camera);
  scene.add(cameraPath);

  const world = new THREE.Group();
  scene.add(world);

  const hemisphereLight = new THREE.HemisphereLight(
    initialTheme === "light"
      ? lightPalette.hemisphereSky
      : darkPalette.hemisphereSky,
    initialTheme === "light"
      ? lightPalette.hemisphereGround
      : darkPalette.hemisphereGround,
    0.54,
  );
  scene.add(hemisphereLight);
  const moonLight = new THREE.DirectionalLight(
    initialTheme === "light" ? lightPalette.keyLight : darkPalette.keyLight,
    1.65,
  );
  moonLight.position.set(-8, 20, 12);
  scene.add(moonLight);

  const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive:
      initialTheme === "light"
        ? lightPalette.terrainEmissive
        : darkPalette.terrainEmissive,
    emissiveIntensity: 0,
    roughness: 1,
    metalness: 0,
    vertexColors: true,
    flatShading: false,
  });
  const terrainMotion = {
    strength: { value: 0 },
    time: { value: 0 },
    themeMix: { value: initialThemeMix },
  };
  terrainMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.coordinateTremorStrength = terrainMotion.strength;
    shader.uniforms.coordinateTremorTime = terrainMotion.time;
    shader.uniforms.coordinateThemeMix = terrainMotion.themeMix;
    shader.vertexShader = `
      uniform float coordinateTremorStrength;
      uniform float coordinateTremorTime;
      attribute vec3 coordinateLightColor;
      varying vec3 vCoordinateLightColor;
      ${shader.vertexShader}
    `.replace(
      "void main() {",
      `
        void main() {
          vCoordinateLightColor = coordinateLightColor;
      `,
    ).replace(
      "#include <begin_vertex>",
      `
        #include <begin_vertex>
        float tremorDistance = distance(transformed.xz, vec2(0.0, -18.0));
        float tremorFalloff = 1.0 - smoothstep(0.65, 8.5, tremorDistance);
        float tremorWave = sin(tremorDistance * 2.45 - coordinateTremorTime * 10.0);
        float tremorGrain = sin(
          transformed.x * 3.1 +
          transformed.z * 2.7 +
          coordinateTremorTime * 15.0
        );
        transformed.y += (
          tremorWave * 0.052 +
          tremorGrain * 0.014
        ) * tremorFalloff * coordinateTremorStrength;
      `,
    );
    shader.fragmentShader = `
      uniform float coordinateThemeMix;
      varying vec3 vCoordinateLightColor;
      ${shader.fragmentShader}
    `.replace(
      "#include <color_fragment>",
      `
        #include <color_fragment>
        diffuseColor.rgb = mix(
          diffuseColor.rgb,
          vCoordinateLightColor,
          coordinateThemeMix
        );
      `,
    );
  };
  terrainMaterial.customProgramCacheKey = () => "coordinate-terrain-theme-v4";

  const random = mulberry32(731_997);
  const terrainSeed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 731_997;
  const terrainProfile = createTerrainProfile(mulberry32(terrainSeed));
  world.add(
    createTerrainLayer(
      {
        centerZ: -25,
        depth: 180,
        heightOffset: 0,
        ridgeHeight: 0,
        shadow: darkPalette.terrainShadow,
        highlight: darkPalette.terrainHighlight,
        lightShadow: lightPalette.terrainShadow,
        lightHighlight: lightPalette.terrainHighlight,
        depthSegments: 220,
      },
      terrainProfile,
      terrainMaterial,
    ),
  );
  const duneDefinitions = [
    { centerZ: 10, depth: 9, phase: terrainProfile.phaseA },
    { centerZ: -1, depth: 8, phase: terrainProfile.phaseB },
    { centerZ: -12, depth: 10, phase: terrainProfile.phaseC },
    { centerZ: -34, depth: 14, phase: terrainProfile.phaseD },
  ];
  const duneMeshes = duneDefinitions.map((definition, index) =>
    createDuneFace(
      definition.centerZ,
      definition.depth,
      darkPalette.duneFaces[index],
      definition.phase,
      terrainProfile,
    ),
  );
  const duneMaterials = duneMeshes.map(
    (mesh) => mesh.material as THREE.MeshStandardMaterial,
  );
  world.add(...duneMeshes);

  const baseThreadSegments: number[] = [];
  const detailCanopyPaths: Float32Array[] = [];
  const detailFallPaths: Float32Array[] = [];
  const base = new THREE.Vector3(0, terrainHeightAt(0, -18, terrainProfile) + 0.08, -18);
  const coreLight = new THREE.PointLight(
    initialTheme === "light" ? lightPalette.core : darkPalette.core,
    9,
    30,
    1.8,
  );
  coreLight.position.set(base.x, base.y + 1.1, base.z);
  world.add(coreLight);

  const angularSectionCount = 720;
  const angularSectionArc = (Math.PI * 2) / angularSectionCount;
  const smokeSpreadArc = (Math.PI * 2) / 120;
  const angularOffset = random() * Math.PI * 2;
  const intersectionRandom = mulberry32(184_731);
  const threadLodRandom = mulberry32(913_807);
  const densityAnchorCount = 15;
  const densityAnchors = Array.from(
    { length: densityAnchorCount },
    () => Math.pow(random(), 1.35),
  );
  const bendAnchors = Array.from(
    { length: densityAnchorCount },
    () => fractalSigned(random, 3) * 0.115,
  );
  const heightAnchors = Array.from(
    { length: densityAnchorCount },
    () => fractalSigned(random, 3) * 1.15,
  );

  for (let sectionIndex = 0; sectionIndex < angularSectionCount; sectionIndex += 1) {
    const densityPosition =
      (sectionIndex / angularSectionCount) * densityAnchorCount;
    const densityAnchorIndex = Math.floor(densityPosition);
    const nextDensityAnchorIndex =
      (densityAnchorIndex + 1) % densityAnchorCount;
    const densityProgress = smoothNoiseStep(
      densityPosition - densityAnchorIndex,
    );
    const sectionDensity = THREE.MathUtils.lerp(
      densityAnchors[densityAnchorIndex],
      densityAnchors[nextDensityAnchorIndex],
      densityProgress,
    );
    const sectionBend = THREE.MathUtils.lerp(
      bendAnchors[densityAnchorIndex],
      bendAnchors[nextDensityAnchorIndex],
      densityProgress,
    );
    const sectionHeight = THREE.MathUtils.lerp(
      heightAnchors[densityAnchorIndex],
      heightAnchors[nextDensityAnchorIndex],
      densityProgress,
    );
    const occupancyThreshold = 0.13 + sectionDensity * 0.46;
    if (random() > occupancyThreshold) {
      continue;
    }

    const smokeRoll = random();
    const smokeCount = smokeRoll < 0.5 ? 1 : smokeRoll < 0.85 ? 2 : 3;
    const sectionAngle =
      angularOffset + (sectionIndex + 0.5) * angularSectionArc;

    for (let smokeIndex = 0; smokeIndex < smokeCount; smokeIndex += 1) {
      const farAngle =
        sectionAngle + (random() - 0.5) * smokeSpreadArc * 2.8;
      const entryDrift =
        sectionBend + fractalSigned(random, 2) * smokeSpreadArc * 0.12;
      const intersectsNeighbors = intersectionRandom() < 0.16;
      const intersectionSweep = intersectsNeighbors
        ? (intersectionRandom() < 0.5 ? -1 : 1) *
          (0.075 + intersectionRandom() * 0.095)
        : 0;
      const rimAngle = farAngle + entryDrift + intersectionSweep;
      const farRadius = 360 + random() * 110;
      const outerRadius = 88 + random() * 56;
      const innerRadius = 18 + random() * 22;
      const rimRadius = 3.3 + random() * 1.15;
      const rimHeight =
        base.y + 19.2 + sectionHeight + fractalSigned(random, 2) * 0.24;

      const farPoint = radialPoint(
        farAngle,
        farRadius,
        rimHeight + farRadius * (0.12 + random() * 0.18),
        base.z,
      );
      const outerControl = radialPoint(
        farAngle + entryDrift * 0.24,
        outerRadius,
        rimHeight +
          outerRadius * (0.055 + random() * 0.12) +
          fractalSigned(random, 3) * 1.7,
        base.z,
      );
      const innerControl = radialPoint(
        farAngle + entryDrift * 0.78 + intersectionSweep * 0.72,
        innerRadius,
        rimHeight + 0.45 + random() * 2.8 + fractalSigned(random, 3) * 0.65,
        base.z,
      );
      const rimPoint = radialPoint(rimAngle, rimRadius, rimHeight, base.z);
      const canopyCurve = new THREE.CubicBezierCurve3(
        farPoint,
        outerControl,
        innerControl,
        rimPoint,
      );
      const canopyPoints = canopyCurve.getPoints(38);

      const fallRadius = 1.1 + random() * 0.72;
      const fallTop = radialPoint(
        rimAngle + fractalSigned(random, 2) * 0.035,
        fallRadius,
        rimHeight - 4.05 - random() * 0.9,
        base.z,
      );
      const lipControlA = radialPoint(
        rimAngle,
        THREE.MathUtils.lerp(rimRadius, fallRadius, 0.38),
        rimHeight + 0.04,
        base.z,
      );
      const lipControlB = radialPoint(
        rimAngle,
        fallRadius,
        rimHeight - 1.28,
        base.z,
      );
      const waterfallLip = new THREE.CubicBezierCurve3(
        rimPoint,
        lipControlA,
        lipControlB,
        fallTop,
      );
      const waterfallPoints = waterfallLip.getPoints(16);

      const landingAngle = rimAngle + fractalSigned(random, 2) * 0.18;
      const landingRadius = Math.sqrt(random()) * 1.24;
      const landingX = Math.cos(landingAngle) * landingRadius;
      const landingZ = Math.sin(landingAngle) * landingRadius;
      const pathBase = new THREE.Vector3(
        landingX,
        terrainHeightAt(landingX, base.z + landingZ, terrainProfile) + 0.075,
        base.z + landingZ,
      );
      const fallingCurve = new THREE.CubicBezierCurve3(
        fallTop,
        new THREE.Vector3(
          fallTop.x,
          THREE.MathUtils.lerp(fallTop.y, pathBase.y, 0.36),
          fallTop.z,
        ),
        new THREE.Vector3(
          THREE.MathUtils.lerp(fallTop.x, pathBase.x, 0.72),
          THREE.MathUtils.lerp(fallTop.y, pathBase.y, 0.7),
          THREE.MathUtils.lerp(fallTop.z, pathBase.z, 0.72),
        ),
        pathBase,
      );
      const fallingPoints = fallingCurve.getPoints(38);
      const canopyPath = vectorPath(canopyPoints);
      const waterfallPath = vectorPath(waterfallPoints);
      const fallingPath = vectorPath(fallingPoints);

      if (threadLodRandom() < 0.3) {
        detailCanopyPaths.push(canopyPath);
        detailFallPaths.push(waterfallPath, fallingPath);
      } else {
        appendSegments(baseThreadSegments, canopyPath);
        appendSegments(baseThreadSegments, waterfallPath);
        appendSegments(baseThreadSegments, fallingPath);
      }
    }
  }

  shuffleInPlace(detailCanopyPaths, threadLodRandom);
  shuffleInPlace(detailFallPaths, threadLodRandom);
  const detailCanopySegments: number[] = [];
  const detailFallSegments: number[] = [];
  detailCanopyPaths.forEach((path) =>
    appendSegments(detailCanopySegments, path),
  );
  detailFallPaths.forEach((path) =>
    appendSegments(detailFallSegments, path),
  );
  const threadSegments = new Float32Array(
    baseThreadSegments.length +
      detailCanopySegments.length +
      detailFallSegments.length,
  );
  threadSegments.set(baseThreadSegments, 0);
  threadSegments.set(detailCanopySegments, baseThreadSegments.length);
  threadSegments.set(
    detailFallSegments,
    baseThreadSegments.length + detailCanopySegments.length,
  );
  const baseThreadSegmentCount = baseThreadSegments.length / 6;
  const detailCanopySegmentCount = detailCanopySegments.length / 6;
  const detailFallSegmentCount = detailFallSegments.length / 6;
  const threadGeometry = new LineSegmentsGeometry();
  threadGeometry.setPositions(threadSegments);
  threadGeometry.instanceCount = baseThreadSegmentCount;
  let visibleThreadSegmentCount = baseThreadSegmentCount;
  baseThreadSegments.length = 0;
  detailCanopySegments.length = 0;
  detailFallSegments.length = 0;
  detailCanopyPaths.length = 0;
  detailFallPaths.length = 0;
  const threadLayerDefinitions = [
    {
      linewidth: 8.2,
      opacity: 0.0025,
      brightness: 0.42,
      blending: THREE.NormalBlending,
    },
    {
      linewidth: 3,
      opacity: 0.0042,
      brightness: 0.58,
      blending: THREE.NormalBlending,
    },
    {
      linewidth: 0.68,
      opacity: 0.0018,
      brightness: 0.92,
      blending: THREE.AdditiveBlending,
    },
  ];
  const threadPulse = { value: 0 };
  const threadTheme = { value: initialThemeMix };
  const threadDarkColors = threadLayerDefinitions.map((definition) =>
    new THREE.Color(darkPalette.thread).multiplyScalar(definition.brightness),
  );
  const threadNeutralColors = threadLayerDefinitions.map((definition) =>
    new THREE.Color(TRANSITION_NEUTRALS.thread).multiplyScalar(
      definition.brightness,
    ),
  );
  const threadLightColors = threadLayerDefinitions.map((definition) =>
    new THREE.Color(lightPalette.thread).multiplyScalar(definition.brightness),
  );
  const threadPaletteColors = threadLayerDefinitions.map(
    (_, index) =>
      [
        threadDarkColors[index] as THREE.Color,
        threadNeutralColors[index] as THREE.Color,
        threadLightColors[index] as THREE.Color,
      ] as const,
  );
  const treeMaterials = threadLayerDefinitions.map((definition, layerIndex) => {
    const material = new LineMaterial({
      color:
        initialTheme === "light"
          ? lightPalette.thread
          : darkPalette.thread,
      linewidth: definition.linewidth,
      transparent: true,
      opacity: definition.opacity,
      blending: definition.blending,
      depthWrite: false,
      alphaToCoverage: false,
      toneMapped: false,
    });
    material.fog = false;
    material.color.copy(
      initialTheme === "light"
        ? threadLightColors[layerIndex]
        : threadDarkColors[layerIndex],
    );
    configureThreadFade(material, threadPulse, threadTheme);
    const layer = new LineSegments2(threadGeometry, material);
    layer.renderOrder = layerIndex + 1;
    world.add(layer);
    return material;
  });

  const starGeometry = new THREE.BufferGeometry();
  const starCount = 760;
  const starPositions = new Float32Array(starCount * 3);
  for (let index = 0; index < starCount; index += 1) {
    const offset = index * 3;
    starPositions[offset] = (random() - 0.5) * 110;
    starPositions[offset + 1] = 12 + random() * 46;
    starPositions[offset + 2] = -42 - random() * 68;
  }
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const starMaterial = createSoftPointMaterial(
    initialTheme === "light" ? lightPalette.star : darkPalette.star,
    2.1,
    initialTheme === "light" ? 0 : 0.62,
  );
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.62, 1, 0.008);
  composer.addPass(bloom);

  const pointer = new THREE.Vector2();
  const pointerCurrent = new THREE.Vector2();
  const projectedBase = new THREE.Vector3();
  const projectedBase2D = new THREE.Vector2();
  const baseWorld = new THREE.Vector3();
  const cameraLookMatrix = new THREE.Matrix4();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lightPulseState = { value: 0 };
  const lightPulseTimeline = reducedMotion
    ? null
    : gsap
        .timeline({ repeat: -1, yoyo: true })
        .to(lightPulseState, {
          value: 1,
          duration: 1.65,
          ease: "sine.inOut",
        });
  const starDriftTimeline = reducedMotion
    ? null
    : gsap.to(starMaterial.uniforms.driftTime, {
        value: 1_200,
        duration: 1_200,
        ease: "none",
        repeat: -1,
      });
  const paletteColors = {
    background: [
      new THREE.Color(darkPalette.background),
      new THREE.Color(TRANSITION_NEUTRALS.background),
      new THREE.Color(lightPalette.background),
    ],
    fog: [
      new THREE.Color(darkPalette.fog),
      new THREE.Color(TRANSITION_NEUTRALS.fog),
      new THREE.Color(lightPalette.fog),
    ],
    hemisphereSky: [
      new THREE.Color(darkPalette.hemisphereSky),
      new THREE.Color(TRANSITION_NEUTRALS.hemisphereSky),
      new THREE.Color(lightPalette.hemisphereSky),
    ],
    hemisphereGround: [
      new THREE.Color(darkPalette.hemisphereGround),
      new THREE.Color(TRANSITION_NEUTRALS.hemisphereGround),
      new THREE.Color(lightPalette.hemisphereGround),
    ],
    keyLight: [
      new THREE.Color(darkPalette.keyLight),
      new THREE.Color(TRANSITION_NEUTRALS.keyLight),
      new THREE.Color(lightPalette.keyLight),
    ],
    terrainEmissive: [
      new THREE.Color(darkPalette.terrainEmissive),
      new THREE.Color(TRANSITION_NEUTRALS.terrainEmissive),
      new THREE.Color(lightPalette.terrainEmissive),
    ],
    core: [
      new THREE.Color(darkPalette.core),
      new THREE.Color(TRANSITION_NEUTRALS.core),
      new THREE.Color(lightPalette.core),
    ],
    star: [
      new THREE.Color(darkPalette.star),
      new THREE.Color(TRANSITION_NEUTRALS.star),
      new THREE.Color(lightPalette.star),
    ],
  } as const;
  const duneDarkColors = darkPalette.duneFaces.map(
    (color) => new THREE.Color(color),
  );
  const duneLightColors = lightPalette.duneFaces.map(
    (color) => new THREE.Color(color),
  );
  let lastAppliedThemeMix = -1;
  let animationFrame = 0;
  let visible = !document.hidden;
  let disposed = false;
  let pointerActive = false;
  let tremorCurrent = 0;

  const updateSize = () => {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
    treeMaterials.forEach((material) => material.resolution.set(width, height));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const onPointerMove = (event: PointerEvent) => {
    pointerActive = true;
    pointer.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1,
    );
  };

  const onPointerOut = (event: PointerEvent) => {
    if (!event.relatedTarget) {
      pointerActive = false;
    }
  };

  const onVisibilityChange = () => {
    visible = !document.hidden;
  };

  const render = (time: number) => {
    if (disposed) {
      return;
    }

    animationFrame = requestAnimationFrame(render);
    if (!visible) {
      return;
    }

    pointerCurrent.lerp(pointer, reducedMotion ? 1 : 0.045);
    cameraCurve.getPointAt(motionState.journey, cameraPath.position);
    cameraTargetCurve.getPointAt(motionState.journey, cameraTarget);
    cameraLookMatrix.lookAt(cameraPath.position, cameraTarget, cameraPath.up);
    cameraPath.quaternion.setFromRotationMatrix(cameraLookMatrix);

    if (reducedMotion) {
      cameraParallax.rotation.set(0, 0, 0);
      tremorCurrent = 0;
    } else {
      cameraParallax.rotation.y = -pointerCurrent.x * 0.018;
      cameraParallax.rotation.x = -pointerCurrent.y * 0.012;
      world.updateWorldMatrix(true, false);
      camera.updateWorldMatrix(true, false);
      world.localToWorld(baseWorld.copy(base));
      projectedBase.copy(baseWorld).project(camera);
      projectedBase2D.set(projectedBase.x, projectedBase.y);
      const baseDistance = pointer.distanceTo(projectedBase2D);
      const tremorTarget = pointerActive
        ? 1 - THREE.MathUtils.smoothstep(baseDistance, 0.08, 0.7)
        : 0;
      tremorCurrent = THREE.MathUtils.lerp(tremorCurrent, tremorTarget, 0.075);
    }

    const timeSeconds = time * 0.001;
    const illumination = motionState.illumination;
    const lightPulse = lightPulseState.value * illumination;
    const afterglow = motionState.afterglow;
    const afterglowPulse = lightPulseState.value * afterglow;
    const themeMix = motionState.themeMix;
    const canopyLodProgress = smoothNoiseStep(
      THREE.MathUtils.clamp((motionState.journey - 0.06) / 0.5, 0, 1),
    );
    const fallLodProgress = smoothNoiseStep(
      THREE.MathUtils.clamp((motionState.journey - 0.52) / 0.34, 0, 1),
    );
    const nextVisibleThreadSegmentCount =
      baseThreadSegmentCount +
      Math.floor(detailCanopySegmentCount * canopyLodProgress) +
      Math.floor(detailFallSegmentCount * fallLodProgress);
    if (nextVisibleThreadSegmentCount !== visibleThreadSegmentCount) {
      threadGeometry.instanceCount = nextVisibleThreadSegmentCount;
      visibleThreadSegmentCount = nextVisibleThreadSegmentCount;
    }
    if (Math.abs(themeMix - lastAppliedThemeMix) > 0.0001) {
      interpolateThemeColor(
        sceneBackground,
        paletteColors.background,
        themeMix,
      );
      interpolateThemeColor(
        sceneFog.color,
        paletteColors.fog,
        themeMix,
      );
      sceneFog.density = THREE.MathUtils.lerp(0.0215, 0.0115, themeMix);
      interpolateThemeColor(
        hemisphereLight.color,
        paletteColors.hemisphereSky,
        themeMix,
      );
      interpolateThemeColor(
        hemisphereLight.groundColor,
        paletteColors.hemisphereGround,
        themeMix,
      );
      hemisphereLight.intensity = THREE.MathUtils.lerp(0.54, 0.72, themeMix);
      interpolateThemeColor(
        moonLight.color,
        paletteColors.keyLight,
        themeMix,
      );
      interpolateThemeColor(
        terrainMaterial.emissive,
        paletteColors.terrainEmissive,
        themeMix,
      );
      terrainMotion.themeMix.value = themeMix;
      interpolateThemeColor(
        coreLight.color,
        paletteColors.core,
        themeMix,
      );
      interpolateThemeColor(
        starMaterial.uniforms.pointColor.value,
        paletteColors.star,
        themeMix,
      );
      stars.visible = themeMix < 0.999;

      for (let index = 0; index < duneMaterials.length; index += 1) {
        duneMaterials[index].color.lerpColors(
          duneDarkColors[index],
          duneLightColors[index],
          themeMix,
        );
        duneMaterials[index].opacity = THREE.MathUtils.lerp(
          0.48,
          0.72,
          themeMix,
        );
      }

      for (let index = 0; index < treeMaterials.length; index += 1) {
        interpolateThemeColor(
          treeMaterials[index].color,
          threadPaletteColors[index],
          themeMix,
        );
      }

      threadTheme.value = themeMix;
      lastAppliedThemeMix = themeMix;
    }

    terrainMotion.time.value = timeSeconds;
    terrainMotion.strength.value = tremorCurrent;
    const darkCoreIntensity =
      9 +
      illumination * 18 +
      lightPulse * 9 +
      afterglow * 12 +
      afterglowPulse * 26 +
      tremorCurrent * (2 + Math.sin(timeSeconds * 15.5) * 1.2);
    const lightCoreIntensity = Math.max(
      0.12,
      1.1 -
        illumination * 0.28 -
        lightPulse * 0.08 -
        afterglow * 0.5 -
        afterglowPulse * 0.18 +
        tremorCurrent * 0.08,
    );
    coreLight.intensity = THREE.MathUtils.lerp(
      darkCoreIntensity,
      lightCoreIntensity,
      themeMix,
    );
    coreLight.distance = THREE.MathUtils.lerp(
      30 + illumination * 32 + afterglow * 18,
      16 + illumination * 4 + afterglow * 2,
      themeMix,
    );
    terrainMaterial.emissiveIntensity =
      (illumination * 0.2 +
        lightPulse * 0.07 +
        afterglow * 0.1 +
        afterglowPulse * 0.14) *
      THREE.MathUtils.lerp(1, 0.08, themeMix);
    const darkKeyLightIntensity =
      1.65 +
      illumination * 1.4 +
      lightPulse * 0.22 +
      afterglow * 0.8 +
      afterglowPulse * 0.65;
    const lightKeyLightIntensity = 2.35;
    moonLight.intensity = THREE.MathUtils.lerp(
      darkKeyLightIntensity,
      lightKeyLightIntensity,
      themeMix,
    );
    renderer.toneMappingExposure =
      THREE.MathUtils.lerp(1.04, 0.72, themeMix) +
      illumination * THREE.MathUtils.lerp(0.28, 0, themeMix) +
      lightPulse * THREE.MathUtils.lerp(0.07, 0, themeMix) +
      afterglow * THREE.MathUtils.lerp(0.18, 0, themeMix) +
      afterglowPulse * THREE.MathUtils.lerp(0.2, 0, themeMix);
    bloom.strength =
      THREE.MathUtils.lerp(0.62, 0.04, themeMix) +
      illumination * THREE.MathUtils.lerp(0.44, 0.02, themeMix) +
      lightPulse * THREE.MathUtils.lerp(0.12, 0, themeMix) +
      afterglow * THREE.MathUtils.lerp(0.18, 0.01, themeMix) +
      afterglowPulse * THREE.MathUtils.lerp(0.3, 0, themeMix);
    threadPulse.value =
      illumination * 0.1 +
      lightPulse * 0.42 +
      afterglow * 0.12 +
      afterglowPulse * 0.35;
    starMaterial.uniforms.pointOpacity.value =
      (0.62 +
        illumination * 0.12 +
        lightPulse * 0.045 +
        afterglow * 0.08 +
        afterglowPulse * 0.035) *
      (1 - themeMix);
    starMaterial.uniforms.pointSize.value =
      2.1 +
      illumination * 0.65 +
      lightPulse * 0.24 +
      afterglow * 0.18 +
      afterglowPulse * 0.12;
    composer.render();
  };

  window.addEventListener("resize", updateSize, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerout", onPointerOut, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  updateSize();
  animationFrame = requestAnimationFrame(render);

  return {
    motionState,
    treeMaterials,
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      lightPulseTimeline?.kill();
      starDriftTimeline?.kill();
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          disposeMaterial(object.material);
        }
        if (object instanceof THREE.Points) {
          object.geometry.dispose();
          disposeMaterial(object.material);
        }
      });
      composer.dispose();
      renderer.dispose();
    },
  };
}

function appendSegments(target: number[], path: Float32Array) {
  const pointCount = path.length / 3;
  for (let pointIndex = 0; pointIndex < pointCount - 1; pointIndex += 1) {
    const current = pointIndex * 3;
    const next = (pointIndex + 1) * 3;
    target.push(
      path[current],
      path[current + 1],
      path[current + 2],
      path[next],
      path[next + 1],
      path[next + 2],
    );
  }
}

function radialPoint(angle: number, radius: number, y: number, centerZ: number) {
  return new THREE.Vector3(
    Math.cos(angle) * radius,
    y,
    centerZ + Math.sin(angle) * radius,
  );
}

function createTerrainProfile(random: () => number): TerrainProfile {
  return {
    seed: Math.floor(random() * 2_147_483_647),
    phaseA: random() * Math.PI * 2,
    phaseB: random() * Math.PI * 2,
    phaseC: random() * Math.PI * 2,
    phaseD: random() * Math.PI * 2,
  };
}

function createTerrainLayer(
  definition: TerrainLayerDefinition,
  profile: TerrainProfile,
  material: THREE.MeshStandardMaterial,
) {
  const geometry = new THREE.PlaneGeometry(130, definition.depth, 164, definition.depthSegments);
  const positions = geometry.attributes.position;
  const colors = new THREE.BufferAttribute(new Float32Array(positions.count * 3), 3);
  const lightColors = new THREE.BufferAttribute(
    new Float32Array(positions.count * 3),
    3,
  );
  const shadow = new THREE.Color(definition.shadow);
  const highlight = new THREE.Color(definition.highlight);
  const lightShadow = new THREE.Color(definition.lightShadow);
  const lightHighlight = new THREE.Color(definition.lightHighlight);
  const color = new THREE.Color();
  const lightColor = new THREE.Color();

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const planeY = positions.getY(index);
    const worldZ = definition.centerZ - planeY;
    const layerProgress = THREE.MathUtils.clamp(
      (worldZ - (definition.centerZ - definition.depth * 0.5)) / definition.depth,
      0,
      1,
    );
    const ridgeEnvelope = Math.sin(layerProgress * Math.PI);
    const ridgeVariation =
      0.76 +
      fbm2D(
        x * 0.055,
        worldZ * 0.035,
        profile.seed + 1_923,
        3,
      ) *
        0.34;
    const ridgeDistance = Math.hypot(x * 0.9, worldZ + 18);
    const ridgeFlattening = THREE.MathUtils.smoothstep(ridgeDistance, 4, 11);
    const displacedHeight =
      terrainDisplacement(x, worldZ, profile) +
      definition.heightOffset +
      ridgeEnvelope * ridgeVariation * definition.ridgeHeight * ridgeFlattening;
    positions.setZ(index, displacedHeight);
  }

  geometry.computeVertexNormals();
  const normals = geometry.attributes.normal;
  for (let index = 0; index < positions.count; index += 1) {
    const displacedHeight = positions.getZ(index);
    const directionalShade = THREE.MathUtils.clamp(
      0.38 -
        normals.getX(index) * 0.32 +
        normals.getY(index) * 0.16 +
        normals.getZ(index) * 0.44,
      0,
      1,
    );
    const heightShade = THREE.MathUtils.clamp((displacedHeight + 1.6) / 3.8, 0, 1);
    const colorMix = THREE.MathUtils.clamp(
      0.12 + directionalShade * 0.62 + heightShade * 0.26,
      0,
      1,
    );
    color.copy(shadow).lerp(highlight, colorMix);
    lightColor.copy(lightShadow).lerp(lightHighlight, colorMix);
    colors.setXYZ(index, color.r, color.g, color.b);
    lightColors.setXYZ(index, lightColor.r, lightColor.g, lightColor.b);
  }

  geometry.setAttribute("color", colors);
  geometry.setAttribute("coordinateLightColor", lightColors);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -1.2, definition.centerZ);

  return new THREE.Mesh(geometry, material);
}

function terrainDisplacement(x: number, worldZ: number, profile: TerrainProfile) {
  const coordinateDistance = Math.hypot(x * 0.9, worldZ + 18);
  const coordinateFlattening = THREE.MathUtils.smoothstep(coordinateDistance, 3.2, 11.5);
  const warpX =
    (fbm2D(x * 0.018, worldZ * 0.018, profile.seed + 101, 3) - 0.5) * 18;
  const warpZ =
    (fbm2D(
      x * 0.016 + 31.7,
      worldZ * 0.019 - 14.2,
      profile.seed + 307,
      3,
    ) -
      0.5) *
    22;
  const warpedX = x + warpX;
  const warpedZ = worldZ + warpZ;
  const broadField =
    (fbm2D(warpedX * 0.034, warpedZ * 0.039, profile.seed + 619, 5) - 0.5) *
    2;
  const ridgeSource =
    fbm2D(
      warpedX * 0.052 + 9.8,
      warpedZ * 0.046 - 21.4,
      profile.seed + 1_021,
      4,
    ) *
      2 -
    1;
  const ridgedField = Math.pow(1 - Math.abs(ridgeSource), 2.65) - 0.26;
  const secondaryField =
    (fbm2D(
      warpedX * 0.088 - 18.1,
      warpedZ * 0.074 + 6.3,
      profile.seed + 1_409,
      3,
    ) -
      0.5) *
    2;
  const distanceScale = 0.88 + Math.min(1, Math.abs(worldZ + 18) / 72) * 0.18;
  const relief = THREE.MathUtils.lerp(0.1, 1, coordinateFlattening);
  const macroDunes =
    broadField * 0.98 +
    ridgedField * 1.38 +
    secondaryField * 0.2;
  const sandBreakup =
    (fbm2D(x * 0.33, worldZ * 0.29, profile.seed + 2_033, 2) - 0.5) * 0.055;

  return (
    macroDunes * relief * distanceScale +
    sandBreakup * THREE.MathUtils.lerp(0.05, 0.72, coordinateFlattening)
  );
}

function createDuneFace(
  centerZ: number,
  depth: number,
  color: THREE.ColorRepresentation,
  phase: number,
  profile: TerrainProfile,
) {
  const segmentCount = 164;
  const depthRowCount = 10;
  const width = 130;
  const rowStride = depthRowCount + 1;
  const positions = new Float32Array((segmentCount + 1) * rowStride * 3);
  const indices: number[] = [];

  for (let index = 0; index <= segmentCount; index += 1) {
    const progress = index / segmentCount;
    const x = THREE.MathUtils.lerp(-width * 0.5, width * 0.5, progress);
    const duneSeed = profile.seed + Math.floor(phase * 10_000);
    const broadCrest =
      (fbm2D(
        x * 0.021 + phase * 2.1,
        centerZ * 0.017,
        duneSeed + 43,
        4,
      ) -
        0.5) *
      2;
    const brokenCrest =
      (fbm2D(
        x * 0.049 - phase * 1.4,
        centerZ * 0.028 + 17.2,
        duneSeed + 137,
        3,
      ) -
        0.5) *
      2;
    const crestZ =
      centerZ +
      broadCrest * depth * 0.72 +
      brokenCrest * depth * 0.24;
    const frontDepth =
      depth *
      (0.82 +
        fbm2D(x * 0.038, centerZ * 0.021, duneSeed + 281, 3) * 0.36);
    const frontZ = crestZ + frontDepth;
    const crestLift =
      (fbm2D(
        x * 0.071 + 7.4,
        centerZ * 0.043 - phase,
        duneSeed + 419,
        4,
      ) -
        0.5) *
        0.82 +
      Math.pow(
        1 -
          Math.abs(
            fbm2D(x * 0.11, centerZ * 0.051, duneSeed + 563, 3) * 2 - 1,
          ),
        2.4,
      ) *
        0.24;

    for (let rowIndex = 0; rowIndex <= depthRowCount; rowIndex += 1) {
      const depthProgress = rowIndex / depthRowCount;
      const worldZ = THREE.MathUtils.lerp(crestZ, frontZ, depthProgress);
      const duneEnvelope = Math.pow(1 - depthProgress, 1.7);
      const interiorBreakup =
        (fbm2D(
          x * 0.083 + depthProgress * 2.7,
          worldZ * 0.061,
          duneSeed + 761,
          3,
        ) -
          0.5) *
        Math.sin(depthProgress * Math.PI) *
        0.16;
      const vertexIndex = index * rowStride + rowIndex;
      const vertexOffset = vertexIndex * 3;
      positions[vertexOffset] = x;
      positions[vertexOffset + 1] =
        terrainHeightAt(x, worldZ, profile) +
        0.035 +
        crestLift * duneEnvelope +
        interiorBreakup;
      positions[vertexOffset + 2] = worldZ;

      if (index < segmentCount && rowIndex < depthRowCount) {
        const nextX = vertexIndex + rowStride;
        indices.push(
          vertexIndex,
          vertexIndex + 1,
          nextX,
          vertexIndex + 1,
          nextX + 1,
          nextX,
        );
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 1,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
}

function terrainHeightAt(x: number, worldZ: number, profile: TerrainProfile) {
  return terrainDisplacement(x, worldZ, profile) - 1.2;
}

function fbm2D(
  x: number,
  z: number,
  seed: number,
  octaves: number,
) {
  let sampleX = x;
  let sampleZ = z;
  let amplitude = 0.5;
  let value = 0;
  let amplitudeTotal = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    value += valueNoise2D(sampleX, sampleZ, seed + octave * 1_013) * amplitude;
    amplitudeTotal += amplitude;
    const rotatedX = sampleX * 1.69 - sampleZ * 1.07 + 11.3;
    const rotatedZ = sampleX * 1.07 + sampleZ * 1.69 - 7.9;
    sampleX = rotatedX;
    sampleZ = rotatedZ;
    amplitude *= 0.52;
  }

  return value / amplitudeTotal;
}

function valueNoise2D(x: number, z: number, seed: number) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const xBlend = smoothNoiseStep(x - x0);
  const zBlend = smoothNoiseStep(z - z0);
  const top = THREE.MathUtils.lerp(
    hash2D(x0, z0, seed),
    hash2D(x0 + 1, z0, seed),
    xBlend,
  );
  const bottom = THREE.MathUtils.lerp(
    hash2D(x0, z0 + 1, seed),
    hash2D(x0 + 1, z0 + 1, seed),
    xBlend,
  );
  return THREE.MathUtils.lerp(top, bottom, zBlend);
}

function hash2D(x: number, z: number, seed: number) {
  let value =
    Math.imul(x, 374_761_393) ^
    Math.imul(z, 668_265_263) ^
    Math.imul(seed, 1_597_334_677);
  value = Math.imul(value ^ (value >>> 13), 1_274_126_177);
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_296;
}

function smoothNoiseStep(value: number) {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function fractalSigned(random: () => number, octaves: number) {
  let amplitude = 1;
  let amplitudeTotal = 0;
  let value = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    value += (random() * 2 - 1) * amplitude;
    amplitudeTotal += amplitude;
    amplitude *= 0.5;
  }

  return value / amplitudeTotal;
}

function vectorPath(points: THREE.Vector3[]) {
  const path = new Float32Array(points.length * 3);
  points.forEach((point, index) => {
    const offset = index * 3;
    path[offset] = point.x;
    path[offset + 1] = point.y;
    path[offset + 2] = point.z;
  });
  return path;
}

function createSoftPointMaterial(
  color: THREE.ColorRepresentation,
  size: number,
  opacity: number,
) {
  return new THREE.ShaderMaterial({
    uniforms: {
      driftTime: { value: 0 },
      pointColor: { value: new THREE.Color(color) },
      pointSize: { value: size },
      pointOpacity: { value: opacity },
    },
    vertexShader: `
      uniform float driftTime;
      uniform float pointSize;

      void main() {
        vec4 clipPosition = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec2 ndc = clipPosition.xy / clipPosition.w;
        float seed = fract(sin(dot(position, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float orbitSpeedA = mix(0.09, 0.19, seed);
        float orbitSpeedB = mix(0.025, 0.067, seed);
        float orbitPhaseA = driftTime * orbitSpeedA + seed * 31.0;
        float orbitPhaseB = driftTime * orbitSpeedB + seed * 71.0;
        vec2 orbitA = vec2(cos(orbitPhaseA), sin(orbitPhaseA));
        vec2 orbitB = vec2(cos(orbitPhaseB), sin(orbitPhaseB));
        vec2 drift =
          orbitA * mix(0.00012, 0.00048, seed) +
          orbitB * mix(0.00008, 0.00028, 1.0 - seed);
        ndc += drift;

        float twinkle = sin(
          driftTime * mix(0.22, 0.41, seed) +
          seed * 17.0
        );
        gl_PointSize = pointSize * (1.0 + twinkle * 0.045);
        clipPosition.xy = ndc * clipPosition.w;
        gl_Position = clipPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 pointColor;
      uniform float pointOpacity;

      void main() {
        float distanceToCenter = length(gl_PointCoord - vec2(0.5));
        float halo = 1.0 - smoothstep(0.08, 0.5, distanceToCenter);
        float core = 1.0 - smoothstep(0.0, 0.2, distanceToCenter);
        float alpha = (halo * 0.62 + core * 0.38) * pointOpacity;

        if (alpha < 0.003) {
          discard;
        }

        gl_FragColor = vec4(pointColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function configureThreadFade(
  material: LineMaterial,
  pulse: { value: number },
  theme: { value: number },
) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.threadPulse = pulse;
    shader.uniforms.threadThemeMix = theme;
    shader.vertexShader = `
      varying float vThreadDistance;
      ${shader.vertexShader}
    `.replace(
      "void main() {",
      `
        void main() {
          float threadStartDistance = length(vec2(instanceStart.x, instanceStart.z + 18.0));
          float threadEndDistance = length(vec2(instanceEnd.x, instanceEnd.z + 18.0));
          vThreadDistance = (
            position.y < 0.5
              ? threadStartDistance
              : threadEndDistance
          );
      `,
    );
    shader.fragmentShader = `
      varying float vThreadDistance;
      uniform float threadPulse;
      uniform float threadThemeMix;
      ${shader.fragmentShader}
    `
      .replace(
        "float alpha = opacity;",
        `
          float terminalFade = 1.0 - smoothstep(105.0, 280.0, vThreadDistance);
          float darkThreadContrast = mix(1.0, 3.4, threadThemeMix);
          float alpha = (
            opacity *
            terminalFade *
            (1.0 + threadPulse) *
            darkThreadContrast
          );
        `,
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `
          #include <clipping_planes_fragment>

          #ifndef WORLD_UNITS
            if (abs(vUv.y) > 0.999) discard;
          #endif
        `,
      );
  };
  material.customProgramCacheKey = () => "coordinate-thread-theme-fade-v4";
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }
  material.dispose();
}

function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffleInPlace<T>(values: T[], random: () => number) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const currentValue = values[index] as T;
    values[index] = values[swapIndex] as T;
    values[swapIndex] = currentValue;
  }
}

function interpolateThemeColor(
  target: THREE.Color,
  colors: readonly [THREE.Color, THREE.Color, THREE.Color],
  mix: number,
) {
  if (mix <= 0.5) {
    target.lerpColors(colors[0], colors[1], mix * 2);
    return;
  }

  target.lerpColors(colors[1], colors[2], (mix - 0.5) * 2);
}

function createThemeColorInterpolator(
  dark: string,
  neutral: string,
  light: string,
) {
  const darkToNeutral = gsap.utils.interpolate(dark, neutral);
  const neutralToLight = gsap.utils.interpolate(neutral, light);

  return (mix: number) =>
    mix <= 0.5
      ? darkToNeutral(mix * 2)
      : neutralToLight((mix - 0.5) * 2);
}

function setupTimeRewind({
  experience,
  button,
  label,
  hint,
  clickIndicator,
  index,
  rule,
  timeWarp,
  scrollTimeline,
  onRewindStart,
  onRewindComplete,
}: TimeRewindOptions) {
  const rings = Array.from(
    experience.querySelectorAll<HTMLElement>("[data-time-warp-ring]"),
  );
  const trigger = scrollTimeline.scrollTrigger;
  const forwardPlaybackSeconds = 6;
  const rewindRate = 5;
  let isRewinding = false;
  let rewindTimeline: gsap.core.Timeline | null = null;
  const clickIndicatorTimeline = gsap
    .timeline({ repeat: -1, repeatDelay: 0.14 })
    .fromTo(
      clickIndicator,
      { autoAlpha: 0.22, scale: 0.55 },
      {
        autoAlpha: 1,
        scale: 1,
        duration: 0.28,
        ease: "power2.out",
      },
    )
    .to(clickIndicator, {
      autoAlpha: 0,
      scale: 1.85,
      duration: 0.42,
      ease: "power2.in",
    });

  const hoverTimeline = gsap
    .timeline({ paused: true })
    .to(
      label,
      {
        y: -7,
        scale: 1.07,
        color: () =>
          getComputedStyle(experience)
            .getPropertyValue("--rewind-hover")
            .trim(),
        duration: 0.28,
        ease: "power4.out",
      },
      0,
    )
    .to(
      hint,
      {
        autoAlpha: 1,
        x: 5,
        color: () =>
          getComputedStyle(experience)
            .getPropertyValue("--rewind-hover")
            .trim(),
        letterSpacing: "0.34em",
        duration: 0.22,
        ease: "power3.out",
      },
      0.02,
    )
    .to(
      rule,
      {
        scaleX: 1.72,
        duration: 0.28,
        ease: "power4.out",
      },
      0.02,
    )
    .to(
      timeWarp,
      {
        autoAlpha: 0.09,
        scale: 0.76,
        duration: 0.28,
        ease: "power3.out",
      },
      0,
    )
    .to(
      rings,
      {
        autoAlpha: 0.2,
        scale: 0.68,
        duration: 0.32,
        ease: "power3.out",
        stagger: 0.035,
      },
      0,
    );

  const playHover = () => {
    if (!isRewinding) {
      hoverTimeline.invalidate().play();
    }
  };

  const reverseHover = () => {
    if (!isRewinding) {
      hoverTimeline.reverse();
    }
  };

  const finishRewind = () => {
    window.scrollTo(0, 0);
    scrollTimeline.progress(0).pause();
    onRewindComplete();
    trigger?.enable();
    ScrollTrigger.update();
    button.disabled = false;
    button.removeAttribute("aria-busy");
    if (index) {
      index.textContent = "01";
    }
    isRewinding = false;
    clickIndicatorTimeline.play(0);
    gsap.set([label, hint], { clearProps: "color,letterSpacing,transform" });
    gsap.set([timeWarp, ...rings], {
      clearProps: "opacity,visibility,transform",
    });
  };

  const rewind = (event: MouseEvent) => {
    event.preventDefault();
    if (isRewinding) {
      return;
    }

    isRewinding = true;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    clickIndicatorTimeline.pause(0);
    hoverTimeline.pause(0);
    rewindTimeline?.kill();
    trigger?.disable(false, true);
    scrollTimeline.pause();
    onRewindStart();

    const scrollableDistance = Math.max(
      1,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    const scrollProgress = THREE.MathUtils.clamp(
      window.scrollY / scrollableDistance,
      0,
      1,
    );
    const rewindDuration = Math.max(
      0.22,
      (forwardPlaybackSeconds / rewindRate) * scrollProgress,
    );
    const scrollProxy = { y: window.scrollY };
    const overlayExitAt = Math.max(0.14, rewindDuration - 0.12);

    rewindTimeline = gsap
      .timeline({ onComplete: finishRewind })
      .set(timeWarp, {
        autoAlpha: 0,
        rotation: -5,
        scale: 0.5,
      })
      .set(rings, {
        autoAlpha: 0,
        rotation: (index) => (index % 2 === 0 ? -7 : 7),
        scale: 0.5,
      })
      .to(
        label,
        {
          y: 4,
          scale: 0.96,
          duration: 0.12,
          ease: "power2.in",
        },
        0,
      )
      .to(
        timeWarp,
        {
          autoAlpha: 0.54,
          rotation: 2,
          scale: 1,
          duration: Math.min(0.34, rewindDuration * 0.42),
          ease: "power3.in",
        },
        0,
      )
      .to(
        rings,
        {
          autoAlpha: 0.64,
          rotation: (index) => (index % 2 === 0 ? 4 : -4),
          scale: 1.08,
          duration: Math.min(0.42, rewindDuration * 0.5),
          ease: "power3.inOut",
          stagger: 0.035,
        },
        0,
      )
      .to(
        scrollProxy,
        {
          y: 0,
          duration: rewindDuration,
          ease: "power3.inOut",
          onUpdate: () => window.scrollTo(0, scrollProxy.y),
        },
        0.05,
      )
      .to(
        scrollTimeline,
        {
          progress: 0,
          duration: rewindDuration,
          ease: "power3.inOut",
        },
        0.05,
      )
      .to(
        timeWarp,
        {
          autoAlpha: 0,
          rotation: 7,
          scale: 1.42,
          duration: 0.28,
          ease: "power3.out",
        },
        overlayExitAt,
      )
      .to(
        rings,
        {
          autoAlpha: 0,
          scale: 1.34,
          duration: 0.24,
          ease: "power3.out",
          stagger: 0.02,
        },
        overlayExitAt,
      );
  };

  button.addEventListener("mouseenter", playHover);
  button.addEventListener("mouseleave", reverseHover);
  button.addEventListener("focus", playHover);
  button.addEventListener("blur", reverseHover);
  button.addEventListener("click", rewind);

  return () => {
    clickIndicatorTimeline.kill();
    hoverTimeline.kill();
    rewindTimeline?.kill();
    if (isRewinding) {
      trigger?.enable();
    }
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.removeEventListener("mouseenter", playHover);
    button.removeEventListener("mouseleave", reverseHover);
    button.removeEventListener("focus", playHover);
    button.removeEventListener("blur", reverseHover);
    button.removeEventListener("click", rewind);
  };
}

function setupAboutDialog(scope: HTMLElement, cleanups: Array<() => void>) {
  const openButton = scope.querySelector<HTMLButtonElement>("[data-dialog-open]");
  const interfaceLayer = scope.querySelector<HTMLElement>("[data-coordinate-interface]");
  const dialog = scope.querySelector<HTMLElement>("[data-coordinate-dialog]");
  const veil = dialog?.querySelector<HTMLElement>("[data-dialog-veil]");
  const panel = dialog?.querySelector<HTMLElement>("[data-dialog-panel]");
  const grain = dialog?.querySelector<HTMLElement>("[data-dialog-grain]");
  const content = dialog?.querySelector<HTMLElement>("[data-dialog-content]");
  const closeButton = dialog?.querySelector<HTMLButtonElement>("[data-dialog-close]");

  if (
    !openButton ||
    !interfaceLayer ||
    !dialog ||
    !veil ||
    !panel ||
    !grain ||
    !content ||
    !closeButton
  ) {
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let activeTimeline: gsap.core.Timeline | null = null;
  let grainDriftTimeline: gsap.core.Timeline | null = null;

  const getOriginClip = () => {
    const rect = openButton.getBoundingClientRect();
    const top = Math.max(0, rect.top);
    const right = Math.max(0, window.innerWidth - rect.right);
    const bottom = Math.max(0, window.innerHeight - rect.bottom);
    const left = Math.max(0, rect.left);
    return `inset(${top}px ${right}px ${bottom}px ${left}px round 2px)`;
  };

  const finishClose = () => {
    dialog.hidden = true;
    gsap.set([dialog, veil, panel, grain, content, interfaceLayer], {
      clearProps: "all",
    });
    openButton.focus();
  };

  const startGrainDrift = () => {
    if (reducedMotion) {
      return;
    }

    grainDriftTimeline?.kill();
    grainDriftTimeline = gsap
      .timeline({ repeat: -1 })
      .to(grain, {
        xPercent: 1.2,
        yPercent: -0.65,
        duration: 6.4,
        ease: "sine.inOut",
      })
      .to(grain, {
        xPercent: 0.35,
        yPercent: 1.1,
        duration: 7.1,
        ease: "sine.inOut",
      })
      .to(grain, {
        xPercent: -1.4,
        yPercent: -1.1,
        duration: 7.8,
        ease: "sine.inOut",
      });
  };

  const closeDialog = () => {
    if (dialog.hidden) {
      return;
    }

    activeTimeline?.kill();
    grainDriftTimeline?.kill();
    grainDriftTimeline = null;
    const duration = reducedMotion ? 0.01 : 0.62;
    activeTimeline = gsap
      .timeline({ onComplete: finishClose })
      .to(content.children, {
        autoAlpha: 0,
        y: reducedMotion ? 0 : 14,
        duration: reducedMotion ? 0.01 : 0.2,
        stagger: reducedMotion ? 0 : 0.025,
        ease: "power2.in",
      })
      .to(
        panel,
        {
          clipPath: getOriginClip(),
          filter: reducedMotion ? "none" : "blur(5px)",
          duration,
          ease: "power4.inOut",
        },
        0.04,
      )
      .to(
        grain,
        {
          autoAlpha: 0,
          scale: reducedMotion ? 1 : 1.075,
          duration: reducedMotion ? 0.01 : 0.28,
          ease: "power2.in",
        },
        0,
      )
      .to(
        veil,
        {
          autoAlpha: 0,
          duration: duration * 0.72,
          ease: "power2.in",
        },
        0.05,
      )
      .to(
        interfaceLayer,
        {
          autoAlpha: 1,
          duration: reducedMotion ? 0.01 : duration * 0.42,
          ease: "power2.out",
        },
        reducedMotion ? 0 : duration * 0.56,
      );
  };

  const openDialog = () => {
    if (!dialog.hidden) {
      return;
    }

    activeTimeline?.kill();
    dialog.hidden = false;
    const duration = reducedMotion ? 0.01 : 0.78;

    gsap.set(dialog, { autoAlpha: 1 });
    gsap.set(veil, { autoAlpha: 0 });
    gsap.set(panel, {
      clipPath: reducedMotion ? "inset(0px)" : getOriginClip(),
      filter: reducedMotion ? "none" : "blur(9px)",
      willChange: "clip-path, filter",
    });
    gsap.set(grain, {
      autoAlpha: reducedMotion ? 0.1 : 0,
      xPercent: reducedMotion ? 0 : -1.4,
      yPercent: reducedMotion ? 0 : -1.1,
      scale: reducedMotion ? 1.04 : 1.075,
      willChange: reducedMotion ? "auto" : "transform, opacity",
    });
    gsap.set(content.children, { autoAlpha: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 24 });

    activeTimeline = gsap
      .timeline({
        onComplete: () => {
          gsap.set(panel, { clearProps: "clipPath,filter,willChange" });
          startGrainDrift();
          closeButton.focus();
        },
      })
      .to(
        veil,
        {
          autoAlpha: 1,
          duration: duration * 0.86,
          ease: "power2.out",
        },
        0,
      )
      .to(
        interfaceLayer,
        {
          autoAlpha: 0,
          duration: reducedMotion ? 0.01 : 0.2,
          ease: "power2.out",
        },
        0,
      )
      .to(
        panel,
        {
          clipPath: "inset(0px 0px 0px 0px round 0px)",
          filter: "blur(0px)",
          duration,
          ease: "power4.inOut",
        },
        0,
      )
      .to(
        grain,
        {
          autoAlpha: 0.12,
          xPercent: 0,
          yPercent: 0,
          scale: 1.04,
          duration: reducedMotion ? 0.01 : duration * 0.82,
          ease: "power2.out",
        },
        reducedMotion ? 0 : 0.08,
      )
      .to(
        content.children,
        {
          autoAlpha: 1,
          y: 0,
          duration: reducedMotion ? 0.01 : 0.54,
          stagger: reducedMotion ? 0 : 0.055,
          ease: "power3.out",
        },
        reducedMotion ? 0 : 0.38,
      );
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !dialog.hidden) {
      event.preventDefault();
      closeDialog();
      return;
    }

    if (event.key === "Tab" && !dialog.hidden) {
      event.preventDefault();
      closeButton.focus();
    }
  };
  const onVeilClick = () => closeDialog();

  openButton.addEventListener("click", openDialog);
  closeButton.addEventListener("click", closeDialog);
  veil.addEventListener("click", onVeilClick);
  document.addEventListener("keydown", onKeyDown);

  cleanups.push(() => {
    activeTimeline?.kill();
    grainDriftTimeline?.kill();
    openButton.removeEventListener("click", openDialog);
    closeButton.removeEventListener("click", closeDialog);
    veil.removeEventListener("click", onVeilClick);
    document.removeEventListener("keydown", onKeyDown);
    if (!dialog.hidden) {
      dialog.hidden = true;
    }
  });
}
