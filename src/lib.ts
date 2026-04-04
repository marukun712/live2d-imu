import type { Layer, Psd } from "ag-psd";
import * as PIXI from "pixi.js";
import { Container2d, Sprite2d } from "pixi-projection";

export interface SpringOpts {
	stiffness: number;
}
export interface RigOpts {
	depth: number;
	spring?: Partial<SpringOpts>;
}

interface ParallaxLayer {
	container: PIXI.Container;
	opts: RigOpts;
	spring: { x: number; vx: number };
}

const DEFAULT_SPRING: SpringOpts = { stiffness: 0.05 };

export function buildContainers<T extends Record<string, string>>(
	psd: Psd,
	layerMap: T,
	skip: Set<string> = new Set(),
): {
	root: Container2d;
	containers: Record<keyof T, Container2d[]>;
} {
	const nameToKey = Object.fromEntries(
		Object.entries(layerMap).map(([k, v]) => [v, k]),
	) as Record<string, keyof T>;

	const root = new Container2d();
	root.pivot.set(psd.width / 2, psd.height / 2);

	const containers = Object.keys(layerMap).reduce(
		(acc, k) => {
			acc[k as keyof T] = [];
			return acc;
		},
		{} as Record<keyof T, Container2d[]>,
	);

	function buildContainer(
		layer: Layer,
		state = { lastSprite: null as Sprite2d | null },
	): Container2d {
		const c = new Container2d();
		layer.children?.forEach((l) => {
			if (!l.name || l.hidden) return;
			const key = nameToKey[l.name.trim()];
			if (l.children) {
				const child = buildContainer(l, state);
				if (key) containers[key].push(child);
				c.addChild(child);
			} else {
				if (!l.canvas) return;
				const sprite = new Sprite2d(PIXI.Texture.from(l.canvas));
				sprite.x = l.left ?? 0;
				sprite.y = l.top ?? 0;
				if (l.clipping && state.lastSprite) {
					const mask = new Sprite2d(state.lastSprite.texture);
					mask.x = state.lastSprite.x;
					mask.y = state.lastSprite.y;
					c.addChild(mask);
					sprite.mask = mask;
				}
				c.addChild(sprite);
				state.lastSprite = sprite;
			}
		});
		return c;
	}

	psd.children?.forEach((l) => {
		if (!l.name || skip.has(l.name) || l.hidden) return;
		const c = buildContainer(l);
		const key = nameToKey[l.name.trim()];
		if (key) containers[key].push(c);
		root.addChild(c);
	});

	return { root, containers };
}

export class KokoroRig {
	private readonly range: number;
	private readonly strength: number;
	private readonly layers: ParallaxLayer[] = [];
	readonly current = { x: 0, y: 0 };
	private force = { x: 0, y: 0, prevX: 0 };

	constructor(app: PIXI.Application, strength: number, range: number) {
		this.range = range;
		this.strength = strength;
		app.ticker.add(() => this.tick());
	}

	setForce(x: number, y: number): void {
		this.force.prevX = this.force.x;
		this.force.x = x;
		this.force.y = y;
	}

	add(container: PIXI.Container, opts: RigOpts): this {
		if (opts.spring) {
			const bounds = container.getLocalBounds();
			container.pivot.set(bounds.x + bounds.width / 4, bounds.y);
		}
		this.layers.push({ container, opts, spring: { x: 0, vx: 0 } });
		return this;
	}

	private tick(): void {
		this.current.x += this.force.x - this.current.x;
		this.current.y += this.force.y - this.current.y;
		const vx = this.force.x - this.force.prevX;

		for (const { container, opts, spring } of this.layers) {
			container.x = Math.max(
				-this.range,
				Math.min(this.range, this.current.x * this.strength * opts.depth),
			);
			container.y = Math.max(
				-this.range,
				Math.min(this.range, this.current.y * this.strength * opts.depth),
			);
			if (opts.spring) {
				const bounds = container.getLocalBounds();
				container.pivot.set(bounds.x + bounds.width / 4, bounds.y);
				container.x += container.pivot.x;
				container.y += container.pivot.y;
				const s = { ...DEFAULT_SPRING, ...opts.spring };
				spring.vx += vx * 100;
				spring.vx += -spring.x * s.stiffness;
				spring.vx *= 0.5;
				spring.x += spring.vx;
				container.skew.x = spring.x * opts.depth * 0.01;
			}
		}
	}
}

export function buildRig<T extends string>(
	app: PIXI.Application,
	containers: Record<T, Container2d[]>,
	depthMap: Partial<Record<T, RigOpts>>,
	strength: number,
	range: number,
): KokoroRig {
	const rig = new KokoroRig(app, strength, range);
	for (const [key, opts] of Object.entries(depthMap) as [T, RigOpts][]) {
		containers[key]?.forEach((c) => {
			rig.add(c, opts);
		});
	}
	return rig;
}
