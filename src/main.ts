import { initializeCanvas, type Layer, readPsd } from "ag-psd";
import gsap from "gsap";
import * as PIXI from "pixi.js";
import { Container2d, Sprite2d } from "pixi-projection";

interface ParallaxLayer {
	container: Container2d;
	depth: number;
}

class ParallaxRig {
	private readonly strength: number;
	private readonly layers: ParallaxLayer[] = [];
	private readonly mouse = { x: 0, y: 0 };
	private readonly current = { x: 0, y: 0 };

	constructor(app: PIXI.Application, strength: number) {
		this.strength = strength;

		app.stage.eventMode = "static";
		app.stage.on("pointermove", (e: PIXI.FederatedPointerEvent) => {
			const cx = app.screen.width / 2;
			const cy = app.screen.height / 2;
			this.mouse.x = (e.global.x - cx) / cx;
			this.mouse.y = (e.global.y - cy) / cy;
		});

		app.ticker.add(() => this.tick());
	}

	add(container: Container2d, depth: number): this {
		this.layers.push({ container, depth });
		return this;
	}

	private tick(): void {
		this.current.x += this.mouse.x - this.current.x;
		this.current.y += this.mouse.y - this.current.y;

		for (const { container, depth } of this.layers) {
			container.x = this.current.x * this.strength * depth;
			container.y = this.current.y * this.strength * depth;
		}
	}
}

const LAYER_MAP = {
	hairBack: "後ろ髪",
	collar: "襟裏",
	armR: "腕R",
	armL: "腕L",
	legs: "脚",
	skirt: "スカート",
	chest: "胸",
	hairFront: "前髪",
	hairSide: "前髪サイド",
	head: "顔",
	ear: "耳",
	hat: "帽子",
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

	function applyX(groups: Container2d[], value: number) {
		groups.forEach((g) => {
			g.x = value;
		});
	}

	function applyY(groups: Container2d[], value: number) {
		groups.forEach((g) => {
			g.y = value;
		});
	}

	function applySkewX(groups: Container2d[], value: number) {
		groups.forEach((g) => {
			g.skew.x = value;
		});
	}

	const v = { breath: 0, sway: 0 };

	gsap.to(v, {
		breath: 20,
		duration: 1.5,
		repeat: -1,
		yoyo: true,
		ease: "sine.inOut",
		onUpdate() {
			applyY(containers.chest, v.breath);
			applyY(containers.skirt, v.breath);
		},
	});

	gsap.to(v, {
		breath: 50,
		duration: 2.5,
		repeat: -1,
		yoyo: true,
		ease: "sine.inOut",
		onUpdate() {
			applyX(containers.armL, v.breath);
			applyX(containers.armR, -v.breath);
			applyY(containers.armL, v.breath);
			applyY(containers.armR, v.breath);
		},
	});

	gsap.to(v, {
		sway: 2,
		duration: 1.5,
		repeat: -1,
		yoyo: true,
		ease: "sine.inOut",
		onUpdate() {
			applySkewX(containers.hairFront, v.sway * 0.015);
			applySkewX(containers.hairBack, v.sway * 0.015);
		},
	});

	const rig = new ParallaxRig(app, 200);

	const DEPTH_MAP: Partial<Record<keyof typeof LAYER_MAP, number>> = {
		hairBack: 0.1,
		armR: 0.3,
		armL: 0.3,
		chest: 0.3,
		ear: 0.5,
		head: 0.5,
		hat: 0.5,
		hairSide: 0.7,
		hairFront: 1.0,
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
