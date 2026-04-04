import { initializeCanvas, type Layer, readPsd } from "ag-psd";
import * as PIXI from "pixi.js";
import { Container2d, Sprite2d } from "pixi-projection";

interface SpringOpts {
	stiffness: number;
}

interface RigOpts {
	depth: number;
	spring?: Partial<SpringOpts>;
}

interface ParallaxLayer {
	container: PIXI.Container;
	opts: RigOpts;
	spring: { x: number; vx: number };
}

const DEFAULT_SPRING: SpringOpts = {
	stiffness: 0.05,
};

class ParallaxRig {
	private readonly range: number;
	private readonly strength: number;
	private readonly layers: ParallaxLayer[] = [];
	readonly current = { x: 0, y: 0 };
	private readonly mouse = { x: 0, y: 0, prevX: 0 };

	constructor(app: PIXI.Application, strength: number, range: number) {
		this.range = range;
		this.strength = strength;
		window.addEventListener("pointermove", (e: PointerEvent) => {
			const cx = window.innerWidth / 2;
			const cy = window.innerHeight / 2;
			this.mouse.x = (e.clientX - cx) / cx;
			this.mouse.y = (e.clientY - cy) / cy;
		});
		app.ticker.add(() => this.tick());
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
		this.current.x += this.mouse.x - this.current.x;
		this.current.y += this.mouse.y - this.current.y;

		const vx = this.mouse.x - this.mouse.prevX;
		this.mouse.prevX = this.mouse.x;

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

const LAYER_MAP = {
	head: "顔",
	eyeR: "瞳",
	eyeL: "瞳L",
	chest: "胸",
	arm: "腕",
	legs: "脚",
	hairFront: "前髪",
	hairSide: "前髪サイド",
	hairBack: "後ろ髪",
	ear: "耳",
	collar: "襟裏",
	skirt: "スカート",
	earringsL: "ピアスL",
	earringsR: "ピアスR",
	ribbon: "胸リボン",
	hat: "帽子",
} as const;

const SKIP = new Set([
	"背景(インポート時削除)",
	"見本_クレジット表記",
	"はじめに",
	"表情差分用パーツ",
	"表情見本",
	"透かし見本",
]);

const DEPTH_MAP: Partial<Record<keyof typeof LAYER_MAP, RigOpts>> = {
	head: { depth: 0.5 },
	eyeR: { depth: 0.1 },
	eyeL: { depth: 0.1 },
	chest: { depth: 0.3, spring: { stiffness: 0.05 } },
	arm: { depth: 0.3 },
	skirt: { depth: 0.3 },
	ear: { depth: 0.5 },
	hat: { depth: 0.2 },
	hairFront: { depth: 0.8, spring: { stiffness: 0.1 } },
	hairSide: { depth: 0.7, spring: { stiffness: 0.1 } },
	hairBack: { depth: 0.3, spring: { stiffness: 0.1 } },
	earringsL: {
		depth: 0.8,
		spring: { stiffness: 0.05 },
	},
	earringsR: {
		depth: 0.8,
		spring: { stiffness: 0.05 },
	},
	ribbon: { depth: 0.8, spring: { stiffness: 0.05 } },
};

const NAME_TO_KEY = Object.fromEntries(
	Object.entries(LAYER_MAP).map(([k, v]) => [v, k]),
) as Record<string, keyof typeof LAYER_MAP>;

(async () => {
	initializeCanvas((width, height) => {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		return canvas;
	});

	const view = document.createElement("canvas");
	document.body.appendChild(view);

	const app = new PIXI.Application({
		view,
		resizeTo: window,
		backgroundColor: 0xffffff,
	});

	const res = await fetch("/models/character.psd");
	const psd = readPsd(await res.arrayBuffer());

	const root = new Container2d();
	root.scale.set(0.12);
	root.pivot.set(psd.width / 2, psd.height / 2);
	root.x = app.screen.width / 2;
	root.y = app.screen.height / 2;
	app.stage.addChild(root);

	const containers = {} as Record<keyof typeof LAYER_MAP, Container2d[]>;
	Object.keys(LAYER_MAP).forEach((k) => {
		containers[k as keyof typeof LAYER_MAP] = [];
	});

	psd.children?.forEach((l) => {
		const name = l.name;
		if (!name || SKIP.has(name) || l.hidden) return;
		const c = buildContainer(l);
		const key = NAME_TO_KEY[name.trim()];
		if (key) containers[key].push(c);
		root.addChild(c);
	});

	function buildContainer(
		layer: Layer,
		state = { lastSprite: null as Sprite2d | null },
	): Container2d {
		const c = new Container2d();
		layer.children?.forEach((l) => {
			if (!l.name || l.hidden) return;
			const key = NAME_TO_KEY[l.name.trim()];
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

	const rig = new ParallaxRig(app, 200, 20);

	for (const [key, opts] of Object.entries(DEPTH_MAP) as [
		keyof typeof LAYER_MAP,
		RigOpts,
	][]) {
		containers[key].forEach((c) => {
			rig.add(c, opts);
		});
	}
})();
