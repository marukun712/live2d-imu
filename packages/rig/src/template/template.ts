import type { Template } from "../rig/rig";
import { curve, getSpatialParams } from "../utils/utils";

export const POSE_TEMPLATE: Template = {
	left: (u, v) => {
		const { fromLeft, fromTop } = getSpatialParams(u, v);
		const w = curve.upperBody(fromTop);
		const baseTx = -100;
		// 中央(u=0.5)ほど大きく変形する。係数を大きくするほど、中央がよりふくらむ。
		const centerBulge = Math.sin(fromLeft * Math.PI) * 2;
		const fakeParallax = -100 * centerBulge * curve.upperBody(v);

		return {
			tx: baseTx + fakeParallax,
			ty: Math.abs(0.5 - u) * -15 * curve.upperBody(v),
			rot: -0.05,
			w: w,
		};
	},
	right: (u, v) => {
		const { fromLeft, fromTop } = getSpatialParams(u, v);
		const w = curve.upperBody(fromTop);
		const baseTx = 100;
		const centerBulge = Math.sin(fromLeft * Math.PI) * 2;
		const fakeParallax = 100 * centerBulge * curve.upperBody(v);

		return {
			tx: baseTx + fakeParallax,
			ty: Math.abs(0.5 - u) * -15 * curve.upperBody(v),
			rot: 0.05,
			w: w,
		};
	},
	up: (u, v) => {
		const { fromTop } = getSpatialParams(u, v);
		const w = curve.upperBody(fromTop);
		return {
			tx: 0,
			ty: -50,
			rot: 0,
			w: w,
		};
	},
	down: (u, v) => {
		const { fromTop } = getSpatialParams(u, v);
		const w = curve.upperBody(fromTop);
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
};
