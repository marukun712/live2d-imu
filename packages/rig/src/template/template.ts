import type { Template } from "../rig/rig";
import { curve, getSpatialParams } from "../utils/utils";

export const POSE_TEMPLATE: Template = {
	left: (u, v) => {
		const { fromLeft, fromTop } = getSpatialParams(u, v);
		const w = curve.body(fromTop);
		const baseTx = -100;
		// 中央(u=0.5)ほど大きく変形する。係数を大きくするほど、中央がよりふくらむ。
		const center = Math.sin(fromLeft * Math.PI) * 5;
		const fakeParallax = -100 * center * curve.body(v);

		return {
			tx: baseTx + fakeParallax,
			ty: Math.abs(0.5 - u) * -15 * curve.body(v),
			w: w,
		};
	},
	right: (u, v) => {
		const { fromLeft, fromTop } = getSpatialParams(u, v);
		const w = curve.body(fromTop);
		const baseTx = 100;
		const center = Math.sin(fromLeft * Math.PI) * 5;
		const fakeParallax = 100 * center * curve.body(v);

		return {
			tx: baseTx + fakeParallax,
			ty: Math.abs(0.5 - u) * -15 * curve.body(v),
			w: w,
		};
	},
	up: (u, v) => {
		const { fromTop } = getSpatialParams(u, v);
		const w = curve.body(fromTop);
		return {
			tx: 0,
			ty: -40,
			w: w,
		};
	},
	down: (u, v) => {
		const { fromTop } = getSpatialParams(u, v);
		const w = curve.body(fromTop);
		return {
			tx: 0,
			ty: 0,
			w: w,
		};
	},
};
