import { gsap, Draggable } from "../../lib/gsap.js";

gsap.to("[data-box]", {
  rotation: 360,
  backgroundColor: "#ff5b3d",
  scrollTrigger: {
    trigger: "[data-box]",
    start: "top 80%",
    end: "bottom 20%",
    scrub: true,
  },
});

Draggable.create("[data-drag]", {
  type: "x,y",
  inertia: true,
  bounds: "body",
});
