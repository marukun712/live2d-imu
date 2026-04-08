import type * as PIXI from "pixi.js";

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

interface ParallaxLayer {
	key: keyof typeof RIG_MAP;
	containers: PIXI.Container[];
}

type RigMapValue = { depth: number };

interface KokoroRigOptions {
	rigMap: Record<keyof typeof RIG_MAP, RigMapValue>;
}

export class KokoroRig {
	private readonly range: number;
	private readonly strength: number;
	private readonly layers: ParallaxLayer[] = [];

	private readonly rigMap: Record<keyof typeof RIG_MAP, RigMapValue>;

	readonly current = { x: 0, y: 0 };
	private focus = { x: 0, y: 0, prevX: 0, prevY: 0 };
	private time = 0;

	constructor(
		app: PIXI.Application,
		containers: Record<keyof typeof RIG_MAP, PIXI.Container[]>,
		strength: number,
		range: number,
		{ rigMap = RIG_MAP }: Partial<KokoroRigOptions> = {},
	) {
		this.range = range;
		this.strength = strength;
		this.rigMap = rigMap;
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
		this.layers.push({ key, containers });
	}

	private tick() {
		this.time += 0.05;
		this.current.x += (this.focus.x - this.current.x) * 0.1;
		this.current.y += (this.focus.y - this.current.y) * 0.1;

		for (const { containers, key } of this.layers) {
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
				container.scale.set(1);
				container.skew.set(0);

				if (key.startsWith("hair")) {
					const plane = container.children[
						container.children.length - 1
					] as PIXI.MeshPlane;
					const buffer = plane.geometry.getBuffer("aPosition");

					for (let i = 0; i < buffer.data.length; i += 2) {
						const w = i / buffer.data.length;
						buffer.data[i] += Math.sin(this.time - w * 5) * w * 0.5;
					}
					buffer.update();
				}
			}
		}
	}
}
