import { initializeCanvas, readPsd } from "ag-psd";
import * as PIXI from "pixi.js";
import { Container2d } from "pixi-projection";
import { Pane } from "tweakpane";
import {
	byName,
	drawCharacter,
	getPSDIndex,
	groupNodes,
	psdGroup,
} from "./loader";
import { KokoroRig } from "./rig";

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

	const index = getPSDIndex(psd, SKIP);
	const nodes = drawCharacter(index);

	console.log(index);

	const root = new Container2d();
	for (const node of nodes) root.addChild(node.container);
	root.scale.set(0.12);
	root.x = app.screen.width / 2;
	root.y = app.screen.height / 2;
	app.stage.addChild(root);

	const containers = groupNodes(nodes, {
		head: psdGroup(psd, "顔"),
		eyeL: byName("瞳L"),
		eyeR: psdGroup(psd, "瞳"),
		body: byName("胴体"),
		shoulder: psdGroup(psd, "腕"),
		chest: psdGroup(psd, "胸"),
		forearmL: byName("前腕L"),
		upperArmL: byName("上腕L"),
		forearmR: byName("前腕R"),
		upperArmR: byName("上腕R"),
		legs: psdGroup(psd, "脚"),
		hairFront: psdGroup(psd, "前髪"),
		hairSide: psdGroup(psd, "前髪サイド"),
		hairBack: psdGroup(psd, "後ろ髪"),
		handL: psdGroup(psd, "手L"),
		handR: psdGroup(psd, "手R"),
	});

	console.log(containers);

	const rig = new KokoroRig(app, containers, 200, 40);

	const params = {
		focusX: 0,
		focusY: 0,
	};

	const pane = new Pane();

	const focusFolder = pane.addFolder({ title: "Focus" });
	focusFolder
		.addBinding(params, "focusX", { min: -1, max: 1, label: "X" })
		.on("change", () => rig.setFocus(params.focusX, params.focusY));
	focusFolder
		.addBinding(params, "focusY", { min: -1, max: 1, label: "Y" })
		.on("change", () => rig.setFocus(params.focusX, params.focusY));
})();
