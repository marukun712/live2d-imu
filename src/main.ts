import { initializeCanvas, type Layer, readPsd } from "ag-psd";
import * as PIXI from "pixi.js";
import { Container2d, Sprite2d } from "pixi-projection";

interface ParallaxLayer {
	container: PIXI.Container;
	depth: number;
}

class ParallaxRig {
	private readonly range: number;
	private readonly strength: number;
	private readonly layers: ParallaxLayer[] = [];
	private readonly mouse = { x: 0, y: 0 };
	readonly current = { x: 0, y: 0 };

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

	add(container: PIXI.Container, depth: number): this {
		this.layers.push({ container, depth });
		return this;
	}

	get displacement() {
		return {
			x: this.current.x * this.strength,
			y: this.current.y * this.strength,
		};
	}

	private tick(): void {
		this.current.x += this.mouse.x - this.current.x;
		this.current.y += this.mouse.y - this.current.y;

		for (const { container, depth } of this.layers) {
			container.x = Math.max(
				-this.range,
				Math.min(this.range, this.current.x * this.strength * depth),
			);
			container.y = Math.max(
				-this.range,
				Math.min(this.range, this.current.y * this.strength * depth),
			);
		}
	}
}

const LAYER_MAP = {
	hairBack: "後ろ髪",
	collar: "襟裏",
	arm: "腕",
	legs: "脚",
	skirt: "スカート",
	chest: "胸",
	hairFront: "前髪",
	hairSide: "前髪サイド",
	head: "顔",
	ear: "耳",
	hat: "帽子",
	eyeR: "瞳",
	eyeL: "瞳L",
} as const;

const NAME_TO_KEY = Object.fromEntries(
	Object.entries(LAYER_MAP).map(([k, v]) => [v, k]),
) as Record<string, keyof typeof LAYER_MAP>;

const SKIP = new Set([
	"背景(インポート時削除)",
	"見本_クレジット表記",
	"はじめに",
	"表情差分用パーツ",
	"表情見本",
	"透かし見本",
]);

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
	const rig = new ParallaxRig(app, 200, 30);

	const DEPTH_MAP: Partial<Record<keyof typeof LAYER_MAP, number>> = {
		eyeR: 0.1,
		eyeL: 0.1,
		hat: 0.2,
		hairBack: 0.3,
		arm: 0.3,
		chest: 0.3,
		skirt: 0.3,
		ear: 0.5,
		head: 0.5,
		hairSide: 0.7,
		hairFront: 0.8,
	};

	for (const [key, depth] of Object.entries(DEPTH_MAP) as [
		keyof typeof LAYER_MAP,
		number,
	][]) {
		containers[key].forEach((c) => {
			rig.add(c, depth);
		});
	}
})();
