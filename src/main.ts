import { initializeCanvas, type Layer, readPsd } from "ag-psd";
import gsap from "gsap";
import * as PIXI from "pixi.js";
import { Container2d, Sprite2d } from "pixi-projection";

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
		breath: 50,
		duration: 1.5,
		repeat: -1,
		yoyo: true,
		ease: "sine.inOut",
		onUpdate() {
			applyY(containers.chest, v.breath * 0.7);
			applyY(containers.skirt, v.breath * 0.7);
			applyY(containers.armL, v.breath * 0.7);
			applyY(containers.armR, v.breath * 0.7);
		},
	});

	gsap.to(v, {
		sway: 2,
		duration: 1.5,
		repeat: -1,
		yoyo: true,
		ease: "sine.inOut",
		onUpdate() {
			applySkewX(containers.hairFront, v.sway * 0.01);
			applySkewX(containers.hairBack, v.sway * 0.01);
		},
	});
})();
