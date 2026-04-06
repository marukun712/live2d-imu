import type * as PIXI from "pixi.js";
import { AFFINE, type Container2d } from "pixi-projection";
import { Spring } from "wobble";

export const RIG_MAP = {
	head: { depth: 0.3, turn: 0.2 },
	eyeL: { depth: 0.5, turn: 0.2 },
	eyeR: { depth: 0.5, turn: 0.2 },
	body: { depth: 0.3, turn: 0.2 },
	shoulderL: { depth: 0.3, turn: 0.2 },
	shoulderR: { depth: 0.3, turn: 0.2 },
	chest: { depth: 0.3, turn: 0.2 },
	forearmL: { depth: 0.3, turn: 0 },
	upperArmL: { depth: 0.3, turn: 0 },
	forearmR: { depth: 0.3, turn: 0 },
	upperArmR: { depth: 0.3, turn: 0 },
	legs: { depth: 0.2, turn: 0.05 },
	hairFront: { depth: 0.3, turn: 0.3 },
	hairSide: { depth: 0.3, turn: 0.35 },
	hairBack: { depth: 0.2, turn: 0.1 },
	handL: { depth: 0.3, turn: 0 },
	handR: { depth: 0.3, turn: 0 },
} satisfies Record<string, { depth: number; turn?: number; lean?: number }>;

export const DEFAULT_PIVOTS: Record<string, { rx: number; ry: number }> = {
	head: { rx: 0.5, ry: 1.0 },
	eyeL: { rx: 0.5, ry: 0.5 },
	eyeR: { rx: 0.5, ry: 0.5 },
	body: { rx: 0.5, ry: 0.0 },
	shoulderL: { rx: 0.5, ry: 0.0 },
	shoulderR: { rx: 0.5, ry: 0.0 },
	chest: { rx: 0.5, ry: 0.0 },
	forearmL: { rx: 0.5, ry: 0.0 },
	upperArmL: { rx: 0.5, ry: 0.0 },
	forearmR: { rx: 0.5, ry: 0.0 },
	upperArmR: { rx: 0.5, ry: 0.0 },
	legs: { rx: 0.5, ry: 0.0 },
	hairFront: { rx: 0.5, ry: 0.0 },
	hairSide: { rx: 0.5, ry: 0.0 },
	hairBack: { rx: 0.5, ry: 0.0 },
};

export const SPRING_PRESETS: Partial<Record<string, SpringOpts>> = {
	hairFront: { stiffness: 80, damping: 40 },
	hairSide: { stiffness: 80, damping: 40 },
	hairBack: { stiffness: 80, damping: 40 },
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
	containers: Container2d[];
	spring: SpringState | null;
}

export class KokoroRig {
	private readonly range: number;
	private readonly strength: number;
	private readonly layers: ParallaxLayer[] = [];

	readonly current = { x: 0, y: 0 };
	private focus = { x: 0, y: 0, prevX: 0, prevY: 0 };

	constructor(
		app: PIXI.Application,
		containers: Partial<Record<keyof typeof RIG_MAP, Container2d[]>>,
		strength: number,
		range: number,
	) {
		this.range = range;
		this.strength = strength;
		app.ticker.add(() => this.tick());
		Object.entries(containers).forEach(([k, v]) => {
			this.add(k as keyof typeof RIG_MAP, v);
		});
	}

	setFocus(x: number, y: number) {
		this.focus.prevX = this.focus.x;
		this.focus.prevY = this.focus.y;
		this.focus.x = x;
		this.focus.y = y;
	}

	private add(key: keyof typeof RIG_MAP, containers: Container2d[]) {
		const pivot = DEFAULT_PIVOTS[key];
		const springOpts = SPRING_PRESETS[key];

		for (const container of containers) {
			if (pivot || springOpts) {
				const b = container.getLocalBounds();
				container.pivot.set(
					b.x + b.width * (pivot?.rx ?? 0),
					b.y + b.height * (pivot?.ry ?? 0),
				);
			}
		}

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
		this.current.x += this.focus.x - this.current.x;
		this.current.y += this.focus.y - this.current.y;

		for (const { containers, spring, key } of this.layers) {
			const { depth, turn } = RIG_MAP[key];
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
				if (turn) {
					container.proj.affine = AFFINE.AXIS_X;
					container.proj.setAxisX(
						{
							x: 1.0 - Math.abs(this.current.x) * turn,
							y: this.current.x * turn * 0.3,
						},
						1,
					);
				}
				if (spring) {
					spring.x.updateConfig({ fromValue: spring.valX, toValue: px });
					container.skew.x = (spring.valX - px) * 0.002;
				}
			}
		}
	}
}
