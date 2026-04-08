import type * as PIXI from "pixi.js";
import { Spring } from "wobble";

export const RIG_MAP = {
	head: { depth: 0.5 },
	eyeL: { depth: 0.55 },
	eyeR: { depth: 0.55 },
	body: { depth: 0.25 },
	forearmL: { depth: 0.24 },
	upperArmL: { depth: 0.24 },
	forearmR: { depth: 0.24 },
	upperArmR: { depth: 0.24 },
	legs: { depth: 0.1 },
	hairFront: { depth: 0.63 },
	hairSide: { depth: 0.51 },
	hairBack: { depth: 0.46 },
	handL: { depth: 0.24 },
	handR: { depth: 0.24 },
} as const;

export const SPRING_PRESETS = {
	hairFront: { stiffness: 60, damping: 30 },
	hairSide: { stiffness: 42, damping: 20 },
	hairBack: { stiffness: 28, damping: 14 },
};

export const DEFORM_MAP = {
	head: {
		turnRight: { x: 14, scaleX: 0.86 },
		turnLeft: { x: -14, scaleX: 0.86 },
		lookUp: { y: -8, scaleY: 0.95 },
		lookDown: { y: 6, scaleY: 1.02 },
	},
	hairFront: {
		turnRight: { x: 18, scaleX: 0.84 },
		turnLeft: { x: -18, scaleX: 0.84 },
	},
	hairSide: {
		turnRight: { x: 26, scaleX: 0.76 },
		turnLeft: { x: -26, scaleX: 0.76 },
	},
	hairBack: {
		turnRight: { x: 8, scaleX: 0.9 },
		turnLeft: { x: -8, scaleX: 0.9 },
	},
};

interface SpringOpts {
	stiffness: number;
	damping: number;
}

interface SpringState {
	x: Spring;
	valX: number;
}

interface ParallaxLayer {
	key: keyof typeof RIG_MAP;
	containers: PIXI.Container[];
	spring: SpringState | null;
}

export interface DeformKey {
	x?: number;
	y?: number;
	scaleX?: number;
	scaleY?: number;
	skewX?: number;
}

export interface DeformDef {
	turnLeft?: DeformKey;
	turnRight?: DeformKey;
	lookUp?: DeformKey;
	lookDown?: DeformKey;
}

export type RigMapValue = { depth: number };

function resolveDeform(def: DeformDef, cx: number, _cy: number): DeformKey {
	const zero: DeformKey = { x: 0, y: 0, scaleX: 1, scaleY: 1, skewX: 0 };
	const result = { ...zero };
	if (cx > 0 && def.turnRight) {
		const t = cx;
		result.x = (result.x ?? 0) + (def.turnRight.x ?? 0) * t;
		result.y = (result.y ?? 0) + (def.turnRight.y ?? 0) * t;
		result.scaleX = 1 + ((def.turnRight.scaleX ?? 1) - 1) * t;
		result.scaleY = 1 + ((def.turnRight.scaleY ?? 1) - 1) * t;
		result.skewX = (result.skewX ?? 0) + (def.turnRight.skewX ?? 0) * t;
	} else if (cx < 0 && def.turnLeft) {
		const t = -cx;
		result.x = (result.x ?? 0) + (def.turnLeft.x ?? 0) * t;
		result.y = (result.y ?? 0) + (def.turnLeft.y ?? 0) * t;
		result.scaleX = 1 + ((def.turnLeft.scaleX ?? 1) - 1) * t;
		result.scaleY = 1 + ((def.turnLeft.scaleY ?? 1) - 1) * t;
		result.skewX = (result.skewX ?? 0) + (def.turnLeft.skewX ?? 0) * t;
	}
	return result;
}

export interface KokoroRigOptions {
	rigMap: Record<keyof typeof RIG_MAP, RigMapValue>;
	springPresets?: Partial<Record<string, SpringOpts>>;
	deformMap?: Partial<Record<keyof typeof RIG_MAP, DeformDef>>;
}

export class KokoroRig {
	private readonly range: number;
	private readonly strength: number;
	private readonly layers: ParallaxLayer[] = [];

	private readonly rigMap: Record<keyof typeof RIG_MAP, RigMapValue>;
	private readonly springPresets: Partial<Record<string, SpringOpts>>;
	private readonly deformMap: Partial<Record<keyof typeof RIG_MAP, DeformDef>>;

	readonly current = { x: 0, y: 0 };
	private focus = { x: 0, y: 0, prevX: 0, prevY: 0 };

	constructor(
		app: PIXI.Application,
		containers: Record<keyof typeof RIG_MAP, PIXI.Container[]>,
		strength: number,
		range: number,
		{
			rigMap = RIG_MAP,
			springPresets = SPRING_PRESETS,
			deformMap = DEFORM_MAP,
		}: Partial<KokoroRigOptions> = {},
	) {
		this.range = range;
		this.strength = strength;
		this.rigMap = rigMap;
		this.springPresets = springPresets ?? {};
		this.deformMap = deformMap ?? {};
		app.ticker.add(() => this.tick());
		Object.entries(containers).forEach(([k, v]) => {
			if (v) this.add(k as keyof typeof RIG_MAP, v);
		});
	}

	setFocus(x: number, y: number) {
		this.focus.prevX = this.focus.x;
		this.focus.prevY = this.focus.y;
		this.focus.x = x;
		this.focus.y = y;
	}

	private add(key: keyof typeof RIG_MAP, containers: PIXI.Container[]) {
		for (const container of containers) {
			const b = container.getLocalBounds();
			container.pivot.set(b.x + b.width / 2, b.y + b.height / 2);
		}

		const springOpts = this.springPresets[key];
		let spring: SpringState | null = null;
		if (springOpts) {
			const state: SpringState = {
				x: new Spring({
					stiffness: springOpts.stiffness,
					damping: springOpts.damping,
				}),
				valX: 0,
			};
			state.x.onUpdate((s) => {
				state.valX = s.currentValue;
			});
			state.x.start();
			spring = state;
		}
		this.layers.push({ containers, key, spring });
	}

	private tick() {
		this.current.x += (this.focus.x - this.current.x) * 0.1;
		this.current.y += (this.focus.y - this.current.y) * 0.1;
		for (const { containers, spring, key } of this.layers) {
			const rigEntry = this.rigMap[key];
			if (!rigEntry) continue;

			const { depth } = rigEntry;
			const px = Math.max(
				-this.range,
				Math.min(this.range, this.current.x * this.strength * depth),
			);
			const py = Math.max(
				-this.range,
				Math.min(this.range, this.current.y * this.strength * depth),
			);

			for (const container of containers) {
				container.x = px + container.pivot.x;
				container.y = py + container.pivot.y;

				if (spring) {
					spring.x.updateConfig({ fromValue: spring.valX, toValue: px });
					container.skew.x = (spring.valX - px) * 0.005;
				}

				const deformDef = this.deformMap[key];
				if (deformDef) {
					const d = resolveDeform(deformDef, this.current.x, this.current.y);
					container.x += d.x ?? 0;
					container.y += d.y ?? 0;
					if (d.scaleX !== undefined) container.scale.x = d.scaleX;
					if (d.scaleY !== undefined) container.scale.y = d.scaleY;
					if (d.skewX !== undefined) container.skew.x = d.skewX;
				}
			}
		}
	}
}
