import { initializeCanvas, type Layer, readPsd } from "ag-psd";
import * as PIXI from "pixi.js";

function getLayers(children: Layer[]): Layer[] {
	return children.flatMap((layer) =>
		layer.children ? getLayers(layer.children) : [layer],
	);
}

function layerToJson(layer: Layer): object {
	return {
		name: layer.name,
		...(layer.children && { children: layer.children.map(layerToJson) }),
	};
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
		backgroundAlpha: 0,
	});

	const buf = await (await fetch("/models/character.psd")).arrayBuffer();
	const psd = readPsd(buf);
	console.log(psd.children?.map(layerToJson));

	getLayers(psd.children ?? []).forEach((layer) => {
		if (!layer.canvas) return;
		const sprite = new PIXI.Sprite(PIXI.Texture.from(layer.canvas));
		sprite.x = layer.left ?? 0;
		sprite.y = layer.top ?? 0;
		sprite.scale.set(0.15, 0.15);
		app.stage.addChild(sprite);
	});
})();
