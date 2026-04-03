import { getProject, onChange } from "@theatre/core";
import { initializeCanvas, type Layer, readPsd } from "ag-psd";
import gsap from "gsap";
import * as PIXI from "pixi.js";
import { Container2d, Sprite2d } from "pixi-projection";

const LAYER_MAP = {
	head: "顔",
	ear: "耳",
	hat: "帽子",
	body: "体",
	arm: "腕",
	hairBack: "後ろ髪",
	collar: "襟裏",
} as const;

const PSDNAME_TO_KEY = Object.fromEntries(
	Object.entries(LAYER_MAP).map(([k, v]) => [v, k]),
) as Record<string, keyof typeof LAYER_MAP>;

function getLayers(children: Layer[]): Layer[] {
	return children.flatMap((l) =>
		l.hidden ? [] : l.children ? getLayers(l.children) : [l],
	);
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

	const containers = {} as Record<keyof typeof LAYER_MAP, Container2d>;

	console.log(psd.children);

	for (const top of psd.children?.filter((c) => !c.hidden) ?? []) {
		const key = PSDNAME_TO_KEY[top.name as string];
		if (!key) continue;

		const c = new Container2d();
		root.addChild(c);
		containers[key] = c;

		let lastSprite: Sprite2d | null = null;
		for (const layer of getLayers([top])) {
			if (!layer.canvas) continue;
			const sprite = new Sprite2d(PIXI.Texture.from(layer.canvas));
			sprite.x = layer.left ?? 0;
			sprite.y = layer.top ?? 0;
			sprite.alpha = layer.opacity ?? 1;
			if (layer.clipping && lastSprite) {
				const mask = new Sprite2d(lastSprite.texture);
				mask.x = lastSprite.x;
				mask.y = lastSprite.y;
				c.addChild(mask);
				sprite.mask = mask;
			}
			c.addChild(sprite);
			lastSprite = sprite;
		}
	}

	const sheet = getProject("Character").sheet("Idle");
	const params = sheet.object("motion", {
		headCoeff: 0.6,
		armCoeff: 1.5,
		swayScale: 0.01,
	});

	let p = { headCoeff: 0.6, armCoeff: 0.8, swayScale: 0.014 };
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
			for (const key of ["head", "ear", "hat", "collar"] as const)
				containers[key].y = v.breath * p.headCoeff;
			containers.body.y = v.breath;
			containers.arm.y = v.breath * p.armCoeff;
		},
	});

	gsap.to(v, {
		sway: 2,
		duration: 1.5,
		repeat: -1,
		yoyo: true,
		ease: "sine.inOut",
		onUpdate() {
			containers.hairBack.skew.x = v.sway * p.swayScale;
		},
	});
})();
