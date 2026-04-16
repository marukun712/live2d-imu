import gsap from "gsap";
import type { Template } from "./rig";

const curve = {
	power1: gsap.parseEase("power1.out"),
	power2: gsap.parseEase("power2.out"),
	power3: gsap.parseEase("power3.out"),
	power4: gsap.parseEase("power4.out"),
	inOut: gsap.parseEase("sine.inOut"),
};

function getSpatialParams(u: number, v: number) {
	return {
		fromTop: 1 - v,
		fromBottom: v,
		fromCenterX: u - 0.5,
		fromCenterY: Math.abs(0.5 - v) * 2,
		isUpperBody: v < 0.5,
	};
}

export const POSE_TEMPLATES: Template = {
	left: (u, v) => {
		const { fromTop, fromCenterX } = getSpatialParams(u, v);
		const depth = curve.power4(fromTop);
		return [-50 * depth, 6 * depth * fromCenterX];
	},

	right: (u, v) => {
		const { fromTop, fromCenterX } = getSpatialParams(u, v);
		const depth = curve.power4(fromTop);
		return [50 * depth, -6 * depth * fromCenterX];
	},

	up: (u, v) => {
		const { fromTop } = getSpatialParams(u, v);
		const depth = curve.power1(fromTop);
		return [0, -40 * depth];
	},

	down: (u, v) => {
		const { fromTop } = getSpatialParams(u, v);
		const depth = curve.power1(fromTop);
		return [0, 40 * depth];
	},
};
