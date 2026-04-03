import { initializeCanvas, type Layer, readPsd } from "ag-psd";
import * as PIXI from "pixi.js";

function getLayers(children: Layer[]): Layer[] {
	return children.flatMap((layer) => {
		if (layer.hidden) return [];
		return layer.children ? getLayers(layer.children) : [layer];
	});
}

const LAYER_MAP = {
	head: "顔",
	ear: "耳",
	hat: "帽子",
	body: "体",
	arm: "腕",
	hairBack: "後ろ髪",
	collar: "襟裏",
} satisfies Record<string, string>;

const PSDNAME_TO_KEY = Object.fromEntries(
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

	const psd = readPsd(
		await (await fetch("/models/character.psd")).arrayBuffer(),
	);
	const filtered = psd.children?.filter((c) => !c.hidden) ?? [];

	const root = new PIXI.Container();
	root.scale.set(0.15);
	app.stage.addChild(root);

	const g = {} as Record<keyof typeof LAYER_MAP, PIXI.Container>;

	for (const top of filtered) {
		const key = PSDNAME_TO_KEY[top.name as string];
		const c = new PIXI.Container();
		if (key) {
			g[key] = c;
		} else {
			continue;
		}
		root.addChild(c);
		let lastSprite: PIXI.Sprite | null = null;
		for (const layer of getLayers([top])) {
			if (!layer.canvas || layer.hidden) continue;
			if (!layer.left && !layer.top && !layer.right && !layer.bottom) continue;
			const sprite = new PIXI.Sprite(PIXI.Texture.from(layer.canvas));
			sprite.x = layer.left ?? 0;
			sprite.y = layer.top ?? 0;
			sprite.alpha = layer.opacity ?? 1;
			if (layer.clipping && lastSprite) {
				const mask = new PIXI.Sprite(lastSprite.texture);
				mask.x = lastSprite.x;
				mask.y = lastSprite.y;
				c.addChild(mask);
				sprite.mask = mask;
			}
			c.addChild(sprite);
			lastSprite = sprite;
		}
	}
})();
