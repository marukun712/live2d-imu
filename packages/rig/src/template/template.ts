import type { Template } from "../rig/rig";
import { curve, getSpatialParams } from "../utils/utils";

export const POSE_TEMPLATES: Template = {
	left: (u, v) => {
		const { fromLeft, fromTop } = getSpatialParams(u, v);
		const w = curve.body(fromTop);
		const baseTx = -100;
		// 中央(u=0.5)ほど大きく変形する。係数を大きくするほど、中央がよりふくらむ。
		const centerBulge = Math.sin(fromLeft * Math.PI) * 2;
		const fakeParallax = -100 * centerBulge * curve.body(v);

		return {
			tx: baseTx + fakeParallax,
			ty: Math.abs(0.5 - u) * -15 * curve.body(v),
			rot: -0.05,
			w: w,
		};
	},
	right: (u, v) => {
		const { fromLeft, fromTop } = getSpatialParams(u, v);
		const w = curve.body(fromTop);
		const baseTx = 100;
		const centerBulge = Math.sin(fromLeft * Math.PI) * 2;
		const fakeParallax = 100 * centerBulge * curve.body(v);

		return {
			tx: baseTx + fakeParallax,
			ty: Math.abs(0.5 - u) * -15 * curve.body(v),
			rot: 0.05,
			w: w,
		};
	},
	up: (u, v) => {
		const { fromTop } = getSpatialParams(u, v);
		const w = curve.body(fromTop);
		return {
			tx: 0,
			ty: -200,
			rot: 0,
			w: w,
		};
	},
	down: (u, v) => {
		const { fromTop } = getSpatialParams(u, v);
		const w = curve.body(fromTop);
		return {
			tx: 0,
			ty: 0,
			rot: 0,
			w: w,
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
	swing: (_, v, t) => {
		const swing = Math.sin(t * 0.1);
		const w = curve.power1(v);
		return {
			tx: 300 * swing,
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
			tx: 300 * swing,
			ty: 10 * Math.abs(swing),
			rot: 0,
			w: w,
		};
	},
	// 前髪と後ろ髪で移動量をずらして、視差をつくる
	leftFront: (_, v) => ({ tx: -800, ty: 0, rot: -0.08, w: curve.hair(v) }),
	rightFront: (_, v) => ({ tx: 800, ty: 0, rot: 0.08, w: curve.hair(v) }),
	leftBack: (_, v) => ({ tx: 400, ty: 0, rot: -0.02, w: curve.hair(v) }),
	rightBack: (_, v) => ({ tx: -400, ty: 0, rot: 0.02, w: curve.hair(v) }),
};
