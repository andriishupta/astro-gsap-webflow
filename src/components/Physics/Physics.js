import { gsap } from "../../lib/gsap.js";

const COLORS = ["#22d3ee", "#a855f7", "#ff5b3d", "#facc15", "#34d399"];
const PARTICLE_COUNT = 40;

const launcher = document.querySelector("[data-physics-launch]");
const stage = document.querySelector("[data-physics-stage]");

launcher?.addEventListener("click", () => {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const dot = document.createElement("span");
    dot.className = "particle";
    dot.style.background = COLORS[i % COLORS.length];
    stage.appendChild(dot);

    gsap.to(dot, {
      duration: 2 + Math.random() * 1.5,
      physics2D: {
        velocity: 350 + Math.random() * 350,
        angle: -90 + (Math.random() * 80 - 40),
        gravity: 600,
      },
      opacity: 0,
      ease: "none",
      onComplete: () => dot.remove(),
    });
  }
});
