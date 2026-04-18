import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import type { Template } from "./rig";

const curve = {
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
	arms: gsap.parseEase(
		CustomEase.create(
			"custom",
			"M0,0 C0.031,0.061 0,1 0.1,1 0.198,1 0.202,0 0.307,0 0.412,0 0.614,0 0.717,0 0.769,0 0.804,1 0.9,1 1,1 0.972,0 1,0 ",
		),
	),
};

function getSpatialParams(u: number, v: number) {
	return {
		fromTop: 1 - v,
		fromBottom: v,
		fromLeft: u,
		fromCenterX: u - 0.5,
		fromCenterY: Math.abs(0.5 - v) * 2,
		isUpperBody: v < 0.5,
	};
}

export const POSE_TEMPLATES: Template = {
	left: (u, v) => {
		const { fromLeft } = getSpatialParams(u, v);
		const faceDepth = curve.power2(1 - Math.abs(fromLeft - 0.5));
		return {
			tx: -40,
			ty: 0,
			rot: -0.3,
			w: faceDepth,
		};
	},
	right: (u, v) => {
		const { fromLeft } = getSpatialParams(u, v);
		const faceDepth = curve.power2(1 - Math.abs(fromLeft - 0.5));
		return {
			tx: 40,
			ty: 0,
			rot: 0.3,
			w: faceDepth,
		};
	},
	normal: () => {
		return {
			tx: 0,
			ty: 0,
			rot: 0,
			w: 0,
		};
	},
	breathing: (u, v) => {
		const { fromTop } = getSpatialParams(u, v);
		const w = curve.chest(fromTop);
		return {
			tx: 0,
			ty: 40,
			rot: 0,
			w,
		};
	},
	swing: (u, v, t) => {
		const { fromLeft } = getSpatialParams(u, v);
		const swing = Math.sin(t * 0.1);
		const w = curve.arms(fromLeft);
		return {
			tx: 50 * swing,
			ty: 10 * Math.abs(swing),
			rot: 0,
			w: w,
		};
	},
};

export const HAIR_TEMPLATE: Template = {
	swing: (_, v, t) => {
		const swing = Math.sin(t * 0.1);
		const w = curve.hair(v);
		return {
			tx: 3e2 * swing,
			ty: 10 * Math.abs(swing),
			rot: 0,
			w: w,
		};
	},
};
