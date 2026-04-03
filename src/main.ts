import { getProject, onChange } from "@theatre/core";
import { initializeCanvas, type Layer, readPsd } from "ag-psd";
import gsap from "gsap";
import * as PIXI from "pixi.js";
import { Container2d, Sprite2d } from "pixi-projection";

const LAYER_MAP = {
	hairBack: "後ろ髪",
	collar: "襟裏",
	armR: "腕/腕R",
	armL: "腕/腕L",
	legs: "体/脚/脚",
	skirt: "体/スカート[0]",
	skirtBelt: "体/スカート[1]",
	chest: "体/胸",
	hairFront: "顔/前髪",
	hairSide: "顔/前髪サイド",
	head: "顔/顔",
	ear: "耳",
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

function getLayers(children: Layer[]): Layer[] {
	return children.flatMap((l) =>
		l.hidden ? [] : l.children ? getLayers(l.children) : [l],
	);
}

function findChild(children: Layer[], segment: string): Layer | undefined {
	const match = segment.match(/^(.+)\[(\d+)\]$/);
	if (match) {
		const [, name, idx] = match;
		return children.filter((l) => l.name === name && !l.hidden)[Number(idx)];
	}
	return children.find((l) => l.name === segment && !l.hidden);
}

function resolveLayerByPath(
	children: Layer[],
	path: string,
): Layer | undefined {
	const [head, ...rest] = path.split("/");
	const found = findChild(children, head);
	if (!found) return undefined;
	return rest.length === 0
		? found
		: resolveLayerByPath(found.children ?? [], rest.join("/"));
}

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

	const resolvedToKey = new Map<Layer, keyof typeof LAYER_MAP>();
	for (const [key, path] of Object.entries(LAYER_MAP) as [
		keyof typeof LAYER_MAP,
		string,
	][]) {
		const layer = resolveLayerByPath(psd.children ?? [], path);
		if (layer) resolvedToKey.set(layer, key);
	}

	const containers = {} as Record<keyof typeof LAYER_MAP, Container2d>;

	function walkPsd(children: Layer[]) {
		for (const layer of children) {
			if (layer.hidden) continue;
			if (SKIP.has(layer.name ?? "")) continue;

			const key = resolvedToKey.get(layer);
			if (key) {
				const c = new Container2d();
				root.addChild(c);
				containers[key] = c;
				let lastSprite: Sprite2d | null = null;
				for (const l of getLayers([layer])) {
					if (!l.canvas) continue;
					const sprite = new Sprite2d(PIXI.Texture.from(l.canvas));
					sprite.x = l.left ?? 0;
					sprite.y = l.top ?? 0;
					sprite.alpha = l.opacity ?? 1;
					if (l.clipping && lastSprite) {
						const mask = new Sprite2d(lastSprite.texture);
						mask.x = lastSprite.x;
						mask.y = lastSprite.y;
						c.addChild(mask);
						sprite.mask = mask;
					}
					c.addChild(sprite);
					lastSprite = sprite;
				}
			} else if (layer.children) {
				walkPsd(layer.children);
			} else if (layer.canvas) {
				const sprite = new Sprite2d(PIXI.Texture.from(layer.canvas));
				sprite.x = layer.left ?? 0;
				sprite.y = layer.top ?? 0;
				sprite.alpha = layer.opacity ?? 1;
				root.addChild(sprite);
			}
		}
	}

	walkPsd(psd.children ?? []);

	const sheet = getProject("Character").sheet("Idle");
	const params = sheet.object("motion", {
		headCoeff: 0.5,
		armCoeff: 0.5,
	});

	let p = { headCoeff: 0.5, armCoeff: 0.5 };
	onChange(params.props, (v) => {
		p = v;
	});

	const v = { breath: 0, sway: 0 };

	gsap.to(v, {
		breath: 50,
		duration: 1,
		repeat: -1,
		yoyo: true,
		ease: "sine.inOut",
		onUpdate() {
			containers.chest.y = v.breath;
			containers.skirt.y = v.breath;
			containers.skirtBelt.y = v.breath;
			containers.armL.y = v.breath * p.armCoeff;
			containers.armR.y = v.breath * p.armCoeff;
		},
	});

	gsap.to(v, {
		sway: 2,
		duration: 1.5,
		repeat: -1,
		yoyo: true,
		ease: "sine.inOut",
		onUpdate() {
			containers.hairFront.skew.x = v.sway * 0.05;
			containers.hairBack.skew.x = v.sway * 0.01;
		},
	});
})();
