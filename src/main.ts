import { initializeCanvas, readPsd } from "ag-psd";
import * as PIXI from "pixi.js";
import { Pane } from "tweakpane";
import { buildContainers, buildRig, type LayerMap, type RigOpts } from "./lib";

const LAYER_MAP = {
	head: "顔",
	eyeR: "瞳",
	eyeL: "瞳L",
	chest: "胸",
	forearmL: "前腕L",
	upperArmL: "上腕L",
	forearmR: "前腕R",
	upperArmR: "上腕R",
	legs: "脚",
	hairFront: "前髪",
	hairSide: "前髪サイド",
	hairBack: "後ろ髪",
	skirt: "スカート",
	earringsL: "ピアスL",
	earringsR: "ピアスR",
	ribbon: "胸リボン",
	hat: "帽子",
} as const satisfies LayerMap;

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
	forearmL: { depth: 0.3 },
	upperArmL: { depth: 0.3 },
	forearmR: { depth: 0.3 },
	upperArmR: { depth: 0.3 },
	hairFront: { depth: 0.8, spring: { stiffness: 0.1 } },
	hairSide: { depth: 0.7, spring: { stiffness: 0.1 } },
	hairBack: { depth: 0.3, spring: { stiffness: 0.1 } },
	skirt: { depth: 0.3 },
	earringsL: { depth: 0.8, spring: { stiffness: 0.05 } },
	earringsR: { depth: 0.8, spring: { stiffness: 0.05 } },
	ribbon: { depth: 0.8, spring: { stiffness: 0.05 } },
	hat: { depth: 0.2 },
};

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

	const rig = buildRig(app, containers, DEPTH_MAP, 200, 20);

	const pane = new Pane();

	const focus = { x: 0, y: 0 };
	const focusFolder = pane.addFolder({ title: "focus" });
	focusFolder.addBinding(focus, "x", { min: -20, max: 20 });
	focusFolder.addBinding(focus, "y", { min: -20, max: 20 });
	focusFolder.on("change", () => rig.setForcus(focus.x, focus.y));

	for (const key of Object.keys(DEPTH_MAP) as (keyof typeof DEPTH_MAP)[]) {
		const offset = { x: 0, y: 0, rotation: 0 };
		const folder = pane.addFolder({ title: key, expanded: false });
		folder.addBinding(offset, "x", { min: -100, max: 100 });
		folder.addBinding(offset, "y", { min: -100, max: 100 });
		folder.addBinding(offset, "rotation", { min: -1, max: 1 });
		folder.on("change", () => rig.setOffset(key, offset));
	}
})();
