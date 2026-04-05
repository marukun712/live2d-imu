import { initializeCanvas, readPsd } from "ag-psd";
import * as PIXI from "pixi.js";
import { Pane } from "tweakpane";
import { KokoroAnim } from "./anim";
import { buildContainers, buildRig, type LayerMap, type RigOpts } from "./lib";

const LAYER_MAP = {
	head: { name: "顔", idx: 0 },
	eyeL: { name: "瞳L", idx: 1 },
	eyeR: { name: "瞳", idx: 0 },
	body: { name: "胴体", idx: 0 },
	shoulder: { name: "腕", idx: 0 },
	chest: { name: "胸", idx: 0 },
	forearmL: { name: "前腕L", idx: 0 },
	upperArmL: { name: "上腕L", idx: 0 },
	forearmR: { name: "前腕R", idx: 0 },
	upperArmR: { name: "上腕R", idx: 0 },
	legs: { name: "脚", idx: 0 },
	hairFront: { name: "前髪", idx: 0 },
	hairSide: { name: "前髪サイド", idx: 0 },
	hairBack: { name: "後ろ髪", idx: 0 },
	handL: { name: "手L", idx: 0 },
	handR: { name: "手R", idx: 0 },
	eyebrowsL: { name: "眉毛L", idx: 0 },
	eyebrowsR: { name: "眉毛R", idx: 0 },
	skirt: { name: "スカート", idx: 0 },
	collar: { name: "シャツ襟", idx: 0 },
	earringsL: { name: "ピアスL", idx: 0 },
	earringsR: { name: "ピアスR", idx: 0 },
	belt1: { name: "スカートベルト", idx: 0 },
	belt2: { name: "スカートウェスト", idx: 0 },
	buckle1: { name: "バックル", idx: 0 },
	buckle2: { name: "バックル金具", idx: 0 },
	ribbon: { name: "胸リボン", idx: 0 },
	hat: { name: "帽子", idx: 0 },
} as const satisfies LayerMap;

const RIG_MAP: Partial<Record<keyof typeof LAYER_MAP, RigOpts>> = {
	head: { depth: 0.5 },
	eyeL: { depth: 0.1 },
	eyeR: { depth: 0.1 },
	body: { depth: 0.3 },
	shoulder: { depth: 0.3 },
	chest: { depth: 0.3 },
	forearmL: { depth: 0.3 },
	upperArmL: { depth: 0.3 },
	forearmR: { depth: 0.3 },
	upperArmR: { depth: 0.3 },
	legs: { depth: 0.2 },
	hairFront: { depth: 0.5 },
	hairSide: { depth: 0.5 },
	hairBack: { depth: 0.2 },
	handL: { depth: 0.3 },
	handR: { depth: 0.3 },
	eyebrowsL: { depth: 0.5 },
	eyebrowsR: { depth: 0.5 },
	skirt: { depth: 0.3 },
	collar: { depth: 0.3 },
	earringsL: { depth: 0.8 },
	earringsR: { depth: 0.8 },
	belt1: { depth: 0.3 },
	belt2: { depth: 0.3 },
	buckle1: { depth: 0.3 },
	buckle2: { depth: 0.3 },
	ribbon: { depth: 0.3 },
	hat: { depth: 0.2 },
};

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

	const { root, containers } = buildContainers(psd, LAYER_MAP, SKIP);
	root.scale.set(0.12);
	root.x = app.screen.width / 2;
	root.y = app.screen.height / 2;
	app.stage.addChild(root);

	const rig = buildRig(app, containers, RIG_MAP, 200, 40);
	const anim = new KokoroAnim(rig, {
		eyeL: containers.eyeL,
		eyeR: containers.eyeR,
	}).attach(app);

	const PARAM_RANGES = {
		headX: [-30, 30],
		headY: [-20, 20],
		headTilt: [-0.3, 0.3],
		eyeX: [-5, 5],
		eyeY: [-3, 3],
		eyeOpenL: [0, 1],
		eyeOpenR: [0, 1],
		bodyX: [-15, 15],
		bodyY: [-10, 10],
		breathe: [0, 1],
		hairSway: [-1, 1],
		armLAngle: [-0.5, 0.5],
		armRAngle: [-0.5, 0.5],
	} as const;

	const pane = new Pane();
	for (const [key, [min, max]] of Object.entries(PARAM_RANGES)) {
		pane.addBinding(anim.params, key as keyof typeof anim.params, { min, max });
	}
})();
