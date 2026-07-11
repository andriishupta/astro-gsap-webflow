import { ScrollTrigger } from "../../lib/gsap.js";

ScrollTrigger.create({
  trigger: ".panel.tall",
  start: "top top",
  end: "+=600",
  pin: true,
});
