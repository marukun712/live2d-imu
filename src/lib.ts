import type { Layer, Psd } from "ag-psd";
import * as PIXI from "pixi.js";
import { Container2d, Sprite2d } from "pixi-projection";
import { Spring } from "wobble";

export interface LayerMap {
	head: { name: string; idx: number };
	eyeL: { name: string; idx: number };
	eyeR: { name: string; idx: number };
	body: { name: string; idx: number };
	shoulder: { name: string; idx: number };
	chest: { name: string; idx: number };
	forearmL: { name: string; idx: number };
	upperArmL: { name: string; idx: number };
	forearmR: { name: string; idx: number };
	upperArmR: { name: string; idx: number };
	legs: { name: string; idx: number };
	hairFront: { name: string; idx: number };
	hairSide: { name: string; idx: number };
	hairBack: { name: string; idx: number };
	[key: string]: { name: string; idx: number };
}

export interface SpringOpts {
	stiffness: number;
	damping: number;
}

export interface RigOpts {
	depth: number;
	spring?: Partial<SpringOpts> | false;
	pivot?: { rx: number; ry: number };
}

export interface Offset {
	x?: number;
	y?: number;
	rotation?: number;
}

interface SpringState {
	x: Spring;
	valX: number;
}

interface ParallaxLayer {
	container: PIXI.Container;
	opts: RigOpts;
	key: string;
	spring: SpringState | null;
}

const SPRING_PRESETS: Partial<Record<string, SpringOpts>> = {
	hairFront: { stiffness: 80, damping: 30 },
	hairSide: { stiffness: 80, damping: 30 },
	hairBack: { stiffness: 80, damping: 10 },
	chest: { stiffness: 40, damping: 2 },
	shoulder: { stiffness: 40, damping: 2 },
};

function resolveSpring(
	key: string,
	override?: Partial<SpringOpts> | false,
): SpringOpts | null {
	if (override === false) return null;
	const preset = SPRING_PRESETS[key];
	if (!preset && !override) return null;
	return { ...(preset ?? ({} as SpringOpts)), ...override };
}

export function buildContainers<T extends LayerMap>(
	psd: Psd,
	layerMap: T,
	skip: Set<string> = new Set(),
) {
	const findRigName = (name: string) =>
		Object.entries(layerMap)
			.filter(([_, v]) => v.name === name)
			.map(([k]) => k);

	const root = new Container2d();
	root.pivot.set(psd.width / 2, psd.height / 2);

	const groups = Object.keys(layerMap).reduce(
		(acc, k) => {
			acc[k as keyof T] = [];
			return acc;
		},
		{} as Record<keyof T, Container2d[]>,
	);

	function buildContainer(
		layer: Layer,
		state = { lastSprite: null as Sprite2d | null },
	) {
		const c = new Container2d();
		layer.children?.forEach((l) => {
			if (!l.name || l.hidden) return;
			const key = findRigName(l.name.trim())[0];
			if (l.children) {
				const child = buildContainer(l, state);
				if (key) groups[key].push(child);
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
				if (key) {
					const inner = new Container2d();
					inner.addChild(sprite);
					groups[key].push(inner);
					c.addChild(inner);
				} else {
					c.addChild(sprite);
				}
				state.lastSprite = sprite;
			}
		});
		return c;
	}

	psd.children?.forEach((l) => {
		if (!l.name || skip.has(l.name) || l.hidden) return;
		const c = buildContainer(l);
		const key = findRigName(l.name.trim())[0];
		if (key) groups[key].push(c);
		root.addChild(c);
	});

	const containers: Partial<{ [key in keyof T]: Container2d }> = {};
	Object.entries(layerMap).forEach(([key, { idx }]) => {
		const list = groups[key as keyof T];
		if (list?.[idx]) containers[key as keyof T] = list[idx];
	});

	return { root, containers };
}

export class KokoroRig {
	private readonly range: number;
	private readonly strength: number;
	private readonly layers: ParallaxLayer[] = [];
	private readonly offsets = new Map<string, Offset>();
	readonly current = { x: 0, y: 0 };
	private focus = { x: 0, y: 0, prevX: 0, prevY: 0 };

	private static readonly DEFAULT_PIVOTS: Record<
		string,
		{ rx: number; ry: number }
	> = {
		head: { rx: 0.5, ry: 1.0 },
		eyeL: { rx: 0.5, ry: 0.5 },
		eyeR: { rx: 0.5, ry: 0.5 },
		body: { rx: 0.5, ry: 0.0 },
		shoulder: { rx: 0.5, ry: 0.0 },
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

	constructor(app: PIXI.Application, strength: number, range: number) {
		this.range = range;
		this.strength = strength;
		app.ticker.add(() => this.tick());
	}

	setFocus(x: number, y: number) {
		this.focus.prevX = this.focus.x;
		this.focus.prevY = this.focus.y;
		this.focus.x = x;
		this.focus.y = y;
	}

	add(container: PIXI.Container, opts: RigOpts, key: string) {
		const pivot = opts.pivot ?? KokoroRig.DEFAULT_PIVOTS[key];
		const springOpts = resolveSpring(key, opts.spring);

		if (pivot || springOpts) {
			const b = container.getLocalBounds();
			container.pivot.set(
				b.x + b.width * (pivot?.rx ?? 0),
				b.y + b.height * (pivot?.ry ?? 0),
			);
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

		this.layers.push({ container, opts, key, spring });
	}

	setOffset(key: string, offset: Offset) {
		this.offsets.set(key, { ...this.offsets.get(key), ...offset });
	}

	getOffset(key: string) {
		return this.offsets.get(key);
	}

	private tick() {
		this.current.x += (this.focus.x - this.current.x) * 0.1;
		this.current.y += (this.focus.y - this.current.y) * 0.1;

		for (const { container, opts, key, spring } of this.layers) {
			const offset = this.offsets.get(key);

			const px = Math.max(
				-this.range,
				Math.min(this.range, this.current.x * this.strength * opts.depth),
			);
			const py = Math.max(
				-this.range,
				Math.min(this.range, this.current.y * this.strength * opts.depth),
			);

			container.x = px + container.pivot.x + (offset?.x ?? 0);
			container.y = py + container.pivot.y + (offset?.y ?? 0);
			container.rotation = offset?.rotation ?? 0;

			if (spring) {
				spring.x.updateConfig({ fromValue: spring.valX, toValue: px });
				container.skew.x = (spring.valX - px) * 0.002;
			}
		}
	}
}

export function buildRig<T extends string>(
	app: PIXI.Application,
	containers: Partial<Record<T, Container2d>>,
	depthMap: Partial<Record<T, RigOpts>>,
	strength: number,
	range: number,
) {
	const rig = new KokoroRig(app, strength, range);
	for (const [key, opts] of Object.entries(depthMap) as [T, RigOpts][]) {
		const c = containers[key];
		if (!c) continue;
		rig.add(c, opts, key);
	}
	return rig;
}
