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
  };
  treeMaterials: LineMaterial[];
  dispose: () => void;
};

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
  depthSegments: number;
};

const root = document.querySelector<HTMLElement>("[data-coordinate-experience]");

if (root) {
  void initExperience(root);
}

async function initExperience(experience: HTMLElement) {
  const canvas = experience.querySelector<HTMLCanvasElement>("[data-coordinate-canvas]");
  const loader = experience.querySelector<HTMLElement>("[data-coordinate-loader]");
  const loaderLabel = experience.querySelector<HTMLElement>("[data-loader-label]");
  const loaderLine = experience.querySelector<HTMLElement>("[data-loader-line]");
  const intro = experience.querySelector<HTMLElement>("[data-coordinate-intro]");
  const scrollCue = experience.querySelector<HTMLElement>("[data-coordinate-scroll-cue]");
  const scrollWheel = experience.querySelector<HTMLElement>("[data-coordinate-scroll-wheel]");
  const progress = experience.querySelector<HTMLElement>("[data-coordinate-progress]");
  const index = experience.querySelector<HTMLElement>("[data-coordinate-index]");
  const chapters = {
    approach: experience.querySelector<HTMLElement>('[data-coordinate-chapter="approach"]'),
    convergence: experience.querySelector<HTMLElement>(
      '[data-coordinate-chapter="convergence"]',
    ),
    afterglow: experience.querySelector<HTMLElement>('[data-coordinate-chapter="afterglow"]'),
  };

  if (
    !canvas ||
    !loader ||
    !loaderLabel ||
    !loaderLine ||
    !intro ||
    !scrollCue ||
    !progress ||
    !chapters.approach ||
    !chapters.convergence ||
    !chapters.afterglow
  ) {
    return;
  }

  const cleanups: Array<() => void> = [];
  const motion = gsap.matchMedia();
  const context = gsap.context(() => undefined, experience);
  setupAboutDialog(experience, cleanups);

  try {
    const sceneController = createScene(canvas);
    cleanups.push(sceneController.dispose);

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
          scrub: 1.15,
          invalidateOnRefresh: true,
          onUpdate: ({ progress: scrollProgress }) => {
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
        .to(intro, { autoAlpha: 0, y: -72, scale: 0.92, duration: 0.16 }, 0.04)
        .to(scrollCue, { autoAlpha: 0, y: 22, duration: 0.1 }, 0.03)
        .fromTo(
          chapters.approach,
          { autoAlpha: 0, y: 32 },
          { autoAlpha: 1, y: 0, duration: 0.1 },
          0.16,
        )
        .to(chapters.approach, { autoAlpha: 0, y: -24, duration: 0.1 }, 0.29)
        .addLabel("approach", 0.32)
        .to(sceneController.treeMaterials[0], { opacity: 0.006, duration: 0.28 }, 0.34)
        .to(sceneController.treeMaterials[1], { opacity: 0.0095, duration: 0.28 }, 0.34)
        .to(sceneController.treeMaterials[2], { opacity: 0.0042, duration: 0.28 }, 0.34)
        .fromTo(
          chapters.convergence,
          { autoAlpha: 0, y: 32 },
          { autoAlpha: 1, y: 0, duration: 0.1 },
          0.4,
        )
        .to(chapters.convergence, { autoAlpha: 0, y: -24, duration: 0.1 }, 0.57)
        .addLabel("convergence", 0.6)
        .to(sceneController.treeMaterials[0], { opacity: 0.009, duration: 0.36 }, 0.64)
        .to(sceneController.treeMaterials[1], { opacity: 0.014, duration: 0.36 }, 0.64)
        .to(sceneController.treeMaterials[2], { opacity: 0.0064, duration: 0.36 }, 0.64)
        .fromTo(
          chapters.afterglow,
          { autoAlpha: 0, y: 36 },
          { autoAlpha: 1, y: 0, duration: 0.12 },
          0.7,
        )
        .addLabel("afterglow", 0.78);

      return () => {
        scrollCueTimeline?.kill();
        scrollTimeline.scrollTrigger?.kill();
        scrollTimeline.kill();
      };
    });

    motion.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set([chapters.approach, chapters.convergence, chapters.afterglow], {
        autoAlpha: 0,
      });
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

function createScene(canvas: HTMLCanvasElement): SceneController {
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
  scene.background = new THREE.Color(0x051a40);
  scene.fog = new THREE.FogExp2(0x051a40, 0.0215);

  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 620);
  const cameraPath = new THREE.Group();
  const cameraParallax = new THREE.Group();
  const motionState = {
    journey: 0,
    illumination: 0,
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

  scene.add(new THREE.HemisphereLight(0x628fd0, 0x01030a, 0.54));
  const moonLight = new THREE.DirectionalLight(0x9ecfff, 1.65);
  moonLight.position.set(-8, 20, 12);
  scene.add(moonLight);

  const terrainMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x08265d,
    emissiveIntensity: 0,
    roughness: 1,
    metalness: 0,
    vertexColors: true,
    flatShading: false,
  });
  const terrainMotion = {
    strength: { value: 0 },
    time: { value: 0 },
  };
  terrainMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.coordinateTremorStrength = terrainMotion.strength;
    shader.uniforms.coordinateTremorTime = terrainMotion.time;
    shader.vertexShader = `
      uniform float coordinateTremorStrength;
      uniform float coordinateTremorTime;
      ${shader.vertexShader}
    `.replace(
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
  };
  terrainMaterial.customProgramCacheKey = () => "coordinate-terrain-tremor-v3";

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
        shadow: 0x02091d,
        highlight: 0x2872b5,
        depthSegments: 220,
      },
      terrainProfile,
      terrainMaterial,
    ),
  );
  world.add(
    createDuneFace(10, 9, 0x0a2b63, terrainProfile.phaseA, terrainProfile),
    createDuneFace(-1, 8, 0x0c306b, terrainProfile.phaseB, terrainProfile),
    createDuneFace(-12, 10, 0x0e3573, terrainProfile.phaseC, terrainProfile),
    createDuneFace(-34, 14, 0x103a7a, terrainProfile.phaseD, terrainProfile),
  );

  const threadSegments: number[] = [];
  const base = new THREE.Vector3(0, terrainHeightAt(0, -18, terrainProfile) + 0.08, -18);
  const coreLight = new THREE.PointLight(0xb9e4ff, 9, 30, 1.8);
  coreLight.position.set(base.x, base.y + 1.1, base.z);
  world.add(coreLight);

  const angularSectionCount = 720;
  const angularSectionArc = (Math.PI * 2) / angularSectionCount;
  const smokeSpreadArc = (Math.PI * 2) / 120;
  const angularOffset = random() * Math.PI * 2;
  const intersectionRandom = mulberry32(184_731);
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

      appendSegments(threadSegments, vectorPath(canopyPoints));
      appendSegments(threadSegments, vectorPath(waterfallPoints));
      appendSegments(threadSegments, vectorPath(fallingPoints));
    }
  }

  const threadGeometry = new LineSegmentsGeometry();
  threadGeometry.setPositions(new Float32Array(threadSegments));
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
  const treeMaterials = threadLayerDefinitions.map((definition, layerIndex) => {
    const material = new LineMaterial({
      color: 0xc4e8ff,
      linewidth: definition.linewidth,
      transparent: true,
      opacity: definition.opacity,
      blending: definition.blending,
      depthWrite: false,
      alphaToCoverage: false,
      toneMapped: false,
    });
    material.fog = false;
    material.color.multiplyScalar(definition.brightness);
    configureThreadFade(material, threadPulse);
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
  const starMaterial = createSoftPointMaterial(0x91c9ff, 2.1, 0.62);
  scene.add(new THREE.Points(starGeometry, starMaterial));

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
    terrainMotion.time.value = timeSeconds;
    terrainMotion.strength.value = tremorCurrent;
    coreLight.intensity =
      9 +
      illumination * 18 +
      lightPulse * 9 +
      tremorCurrent * (2 + Math.sin(timeSeconds * 15.5) * 1.2);
    coreLight.distance = 30 + illumination * 32;
    terrainMaterial.emissiveIntensity = illumination * 0.2 + lightPulse * 0.07;
    moonLight.intensity = 1.65 + illumination * 1.4 + lightPulse * 0.22;
    renderer.toneMappingExposure = 1.04 + illumination * 0.28 + lightPulse * 0.07;
    bloom.strength = 0.62 + illumination * 0.44 + lightPulse * 0.12;
    threadPulse.value = illumination * 0.1 + lightPulse * 0.42;
    starMaterial.uniforms.pointOpacity.value =
      0.62 + illumination * 0.12 + lightPulse * 0.045;
    starMaterial.uniforms.pointSize.value =
      2.1 + illumination * 0.65 + lightPulse * 0.24;

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
  const shadow = new THREE.Color(definition.shadow);
  const highlight = new THREE.Color(definition.highlight);
  const color = new THREE.Color();

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
    colors.setXYZ(index, color.r, color.g, color.b);
  }

  geometry.setAttribute("color", colors);
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
) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.threadPulse = pulse;
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
      ${shader.fragmentShader}
    `
      .replace(
        "float alpha = opacity;",
        `
          float terminalFade = 1.0 - smoothstep(105.0, 280.0, vThreadDistance);
          float alpha = opacity * terminalFade * (1.0 + threadPulse);
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
  material.customProgramCacheKey = () => "coordinate-thread-distance-fade-v3";
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
