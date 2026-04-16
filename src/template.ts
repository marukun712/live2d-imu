import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import type { Template } from "./rig";

const curve = {
	power1: gsap.parseEase("power1.out"),
	power2: gsap.parseEase("power2.out"),
	power3: gsap.parseEase("power3.out"),
	power4: gsap.parseEase("power4.out"),
	inOut: gsap.parseEase("sine.inOut"),
	head: gsap.parseEase(
		CustomEase.create(
			"custom",
			"M0,0 C0.188,0 0.774,-0.003 0.774,-0.003 0.774,-0.003 0.882,0.996 1,0.996 ",
		),
	),
	body: gsap.parseEase(
		CustomEase.create(
			"custom",
			"M0,0 C0.188,0 0.4,-0.003 0.4,-0.003 0.4,-0.003 0.882,0.996 1,0.996 ",
		),
	),
	chest: gsap.parseEase(
		CustomEase.create("custom", "M0,0 C0.25,0 0.25,1 0.5,1 0.75,1 0.75,0 1,0"),
	),
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
		const { fromTop } = getSpatialParams(u, v);
		const w = curve.chest(fromTop);
		return {
			tx: -50,
			ty: 0,
			rot: -Math.PI / 12,
			w,
		};
	},
	right: (u, v) => {
		const { fromTop } = getSpatialParams(u, v);
		const w = curve.chest(fromTop);
		return {
			tx: 50,
			ty: 0,
			rot: Math.PI / 12,
			w,
		};
	},
};
