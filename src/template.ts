import type { Template } from "./rig";

export const POSE_TEMPLATES: Template = {
	left: (u, v) => {
		const depth = (1 - v) ** 1.2;
		return [-35 * depth, 6 * depth * (u - 0.5)];
	},

	right: (u, v) => {
		const depth = (1 - v) ** 1.2;
		return [35 * depth, -6 * depth * (u - 0.5)];
	},

	up: (_u, v) => [0, -40 * (1 - v) ** 0.8],

	down: (_u, v) => [0, 40 * (1 - v) ** 0.8],

	leanLeft: (u, v) => {
		const dx = v < 0.5 ? -100 * (1 - 2 * v) : 25 * (2 * v - 1);
		const tilt = 35 * (u - 0.5) * (1 - 2 * v);
		return [dx, tilt];
	},

	leanRight: (u, v) => {
		const dx = v < 0.5 ? 100 * (1 - 2 * v) : -25 * (2 * v - 1);
		const tilt = -35 * (u - 0.5) * (1 - 2 * v);
		return [dx, tilt];
	},
};
