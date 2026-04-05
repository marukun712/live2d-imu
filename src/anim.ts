import gsap from "gsap";
import type * as PIXI from "pixi.js";
import type { KokoroRig } from "./lib";

const PARAM_DEFS = {
	headX: { min: -30, max: 30, default: 0 },
	headY: { min: -20, max: 20, default: 0 },
	headTilt: { min: -0.3, max: 0.3, default: 0 },
	eyeX: { min: -5, max: 5, default: 0 },
	eyeY: { min: -3, max: 3, default: 0 },
	bodyX: { min: -15, max: 15, default: 0 },
	bodyY: { min: -10, max: 10, default: 0 },
	breathe: { min: 0, max: 1, default: 0 },
	hairSway: { min: -1, max: 1, default: 0 },
	armLAngle: { min: -0.5, max: 0.5, default: 0 },
	armRAngle: { min: -0.5, max: 0.5, default: 0 },
} satisfies Record<string, { min: number; max: number; default: number }>;

export type ParamKey = keyof typeof PARAM_DEFS;
export type ParamValues = { [K in ParamKey]: number };

export class KokoroAnim {
	private readonly rig: KokoroRig;
	readonly params: ParamValues;
	private tickerFn: (() => void) | null = null;

	constructor(rig: KokoroRig) {
		this.rig = rig;
		this.params = Object.fromEntries(
			Object.entries(PARAM_DEFS).map(([k, v]) => [k, v.default]),
		) as ParamValues;
	}

	attach(app: PIXI.Application) {
		this.tickerFn = () => this.apply();
		app.ticker.add(this.tickerFn);
		return this;
	}

	detach(app: PIXI.Application) {
		if (this.tickerFn) app.ticker.remove(this.tickerFn);
		this.tickerFn = null;
		return this;
	}

	apply() {
		for (const key of Object.keys(PARAM_DEFS) as ParamKey[]) {
			const { min, max } = PARAM_DEFS[key];
			this.params[key] = Math.max(min, Math.min(max, this.params[key]));
		}

		const p = this.params;

		this.rig.setOffset("head", {
			x: p.headX,
			y: p.headY,
			rotation: p.headTilt,
		});
		this.rig.setOffset("eyeL", {
			x: p.headX * 0.3 + p.eyeX,
			y: p.headY * 0.3 + p.eyeY,
		});
		this.rig.setOffset("eyeR", {
			x: p.headX * 0.3 + p.eyeX,
			y: p.headY * 0.3 + p.eyeY,
		});
		this.rig.setOffset("hairFront", {
			x: p.headX * 0.8,
			y: p.headY * 0.8,
			rotation: p.headTilt + p.hairSway * 0.05,
		});
		this.rig.setOffset("hairSide", {
			x: p.headX * 0.9,
			y: p.headY * 0.9,
			rotation: p.headTilt + p.hairSway * 0.08,
		});
		this.rig.setOffset("hairBack", {
			x: p.headX * 0.6,
			y: p.headY * 0.6,
			rotation: p.headTilt + p.hairSway * 0.03,
		});

		const breatheY = p.breathe * -8;
		this.rig.setOffset("body", { x: p.bodyX, y: p.bodyY });
		this.rig.setOffset("chest", { x: p.bodyX, y: p.bodyY + breatheY });
		this.rig.setOffset("shoulder", { x: p.bodyX, y: p.bodyY });
		this.rig.setOffset("legs", { x: p.bodyX * 0.3, y: 0 });

		this.rig.setOffset("upperArmL", {
			x: p.bodyX,
			y: p.bodyY,
			rotation: p.armLAngle,
		});
		this.rig.setOffset("forearmL", {
			x: p.bodyX,
			y: p.bodyY,
			rotation: p.armLAngle * 0.5,
		});
		this.rig.setOffset("upperArmR", {
			x: p.bodyX,
			y: p.bodyY,
			rotation: p.armRAngle,
		});
		this.rig.setOffset("forearmR", {
			x: p.bodyX,
			y: p.bodyY,
			rotation: p.armRAngle * 0.5,
		});
	}

	to(params: Partial<ParamValues>, vars: gsap.TweenVars = {}) {
		return gsap.to(this.params, { ...params, ...vars });
	}

	reset(duration = 0.4) {
		const defaults = Object.fromEntries(
			Object.entries(PARAM_DEFS).map(([k, v]) => [k, v.default]),
		);
		return duration > 0
			? gsap.to(this.params, { ...defaults, duration, ease: "power2.out" })
			: (() => {
					Object.assign(this.params, defaults);
					return this;
				})();
	}
}

export const Motion = {
	idle(anim: KokoroAnim) {
		return gsap.timeline({ repeat: -1, yoyo: true }).to(anim.params, {
			breathe: 1,
			duration: 2.5,
			ease: "sine.inOut",
		});
	},

	lookAt(anim: KokoroAnim, nx: number, ny: number, duration = 0.4) {
		return gsap.to(anim.params, {
			headX: nx * 30,
			headY: ny * 20,
			eyeX: nx * 3,
			eyeY: ny * 2,
			duration,
			ease: "power2.out",
		});
	},

	nod(anim: KokoroAnim, count = 2) {
		const tl = gsap.timeline();
		for (let i = 0; i < count; i++) {
			tl.to(anim.params, { headY: 15, duration: 0.18, ease: "power1.in" }).to(
				anim.params,
				{ headY: 0, duration: 0.28, ease: "power1.out" },
			);
		}
		return tl;
	},

	shake(anim: KokoroAnim, count = 3) {
		const tl = gsap.timeline();
		for (let i = 0; i < count; i++) {
			tl.to(anim.params, {
				headX: -20,
				headTilt: -0.12,
				duration: 0.14,
				ease: "power1.inOut",
			}).to(anim.params, {
				headX: 20,
				headTilt: 0.12,
				duration: 0.14,
				ease: "power1.inOut",
			});
		}
		tl.to(anim.params, {
			headX: 0,
			headTilt: 0,
			duration: 0.2,
			ease: "power2.out",
		});
		return tl;
	},

	wave(anim: KokoroAnim) {
		return gsap
			.timeline()
			.to(anim.params, { armRAngle: 0.45, duration: 0.25, ease: "power2.out" })
			.to(
				anim.params,
				{
					armRAngle: -0.1,
					duration: 0.18,
					ease: "sine.inOut",
					repeat: 5,
					yoyo: true,
				},
				">",
			)
			.to(anim.params, { armRAngle: 0, duration: 0.35, ease: "power2.inOut" });
	},

	sway(anim: KokoroAnim) {
		return gsap.timeline({ repeat: -1, yoyo: true }).to(anim.params, {
			bodyX: 6,
			headX: 8,
			hairSway: 0.4,
			armLAngle: 0.05,
			armRAngle: -0.05,
			duration: 3,
			ease: "sine.inOut",
		});
	},
};
