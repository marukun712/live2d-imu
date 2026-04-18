import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";

export const curve = {
	power1: gsap.parseEase("power1.in"),
	power2: gsap.parseEase("power2.in"),
	power3: gsap.parseEase("power3.in"),
	power4: gsap.parseEase("power4.in"),
	inOut: gsap.parseEase("sine.inOut"),
	head: gsap.parseEase(
		CustomEase.create(
			"custom",
			"M0,0 C0.188,0 0.774,-0.003 0.774,-0.003 0.774,-0.003 0.882,0.996 1,0.996",
		),
	),
	body: gsap.parseEase(
		CustomEase.create(
			"custom",
			"M0,0 C0.188,0 0.4,-0.003 0.4,-0.003 0.4,-0.003 0.882,0.996 1,0.996",
		),
	),
	chest: gsap.parseEase(
		CustomEase.create("custom", "M0,0 C0.35,0 0.55,1 0.6,1 0.7,1 0.8,0 1,0"),
	),
	hair: CustomEase.create(
		"custom",
		"M0,0 C0.067,0.132 0.336,0.049 0.6,0.3 0.742,0.436 0.822,1 1,1",
	),
};

export function getSpatialParams(u: number, v: number) {
	return {
		fromTop: 1 - v,
		fromBottom: v,
		fromLeft: u,
		fromCenterX: u - 0.5,
		fromCenterY: Math.abs(0.5 - v) * 2,
		isUpperBody: v < 0.5,
	};
}

export function getCylinderWeight(u: number, angle: number) {
	const fov = Math.PI;
	const theta = (u - 0.5) * fov;

	const origX = Math.sin(theta);
	const newX = Math.sin(theta + angle);

	const centerDiff = Math.sin(angle);
	return (newX - origX) / centerDiff;
}
