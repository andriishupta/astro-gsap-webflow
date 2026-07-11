import { gsap } from "../../lib/gsap.js";

gsap.to("#planet", {
  motionPath: {
    path: "#motion-path",
    align: "#motion-path",
    alignOrigin: [0.5, 0.5],
  },
  duration: 4,
  repeat: -1,
  ease: "power1.inOut",
  yoyo: true,
});
