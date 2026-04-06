import { initializeCanvas, readPsd } from "ag-psd";
import * as PIXI from "pixi.js";
import { Container2d } from "pixi-projection";
import { Viewport } from "pixi-viewport";
import {
	byName,
	drawCharacter,
	getPSDIndex,
	groupNodes,
	pipe,
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

	const viewport = new Viewport({
		screenWidth: window.innerWidth,
		screenHeight: window.innerHeight,
		worldWidth: 1000,
		worldHeight: 1000,
		events: app.renderer.events,
	});

	app.stage.addChild(viewport);

	viewport.drag().pinch().wheel();

	const res = await fetch("/models/character.psd");
	const psd = readPsd(await res.arrayBuffer());

	const index = getPSDIndex(psd, SKIP);
	const nodes = drawCharacter(index);

	console.log(index.map((n) => n.path.join(" > ")));

	const root = new Container2d();
	for (const node of nodes) root.addChild(node.container);
	root.scale.set(0.1);
	viewport.addChild(root);

	const containers = groupNodes(nodes, {
		head: pipe(psdGroup("帽子"), psdGroup("顔")),
		eyeL: psdGroup("瞳L"),
		eyeR: psdGroup("瞳"),
		body: pipe(
			byName("胴体"),
			psdGroup("スカート"),
			byName("スカートウェスト"),
		),
		shoulderL: (n) => ["袖L1", "袖L2", "袖影L"].includes(n.name),
		shoulderR: (n) => ["袖R1", "袖R2", "袖影R"].includes(n.name),
		chest: psdGroup("胸"),
		forearmL: byName("前腕L"),
		upperArmL: byName("上腕L"),
		forearmR: byName("前腕R"),
		upperArmR: byName("上腕R"),
		legs: psdGroup("脚"),
		hairFront: psdGroup("前髪"),
		hairSide: psdGroup("前髪サイド"),
		hairBack: psdGroup("後ろ髪"),
		handL: psdGroup("手L"),
		handR: psdGroup("手R"),
	});

	const rig = new KokoroRig(app, containers, 400, 30);

	window.addEventListener("pointermove", (e: PointerEvent) => {
		const cx = window.innerWidth / 2;
		const cy = window.innerHeight / 2;
		rig.setFocus((e.clientX - cx) / cx, (e.clientY - cy) / cy);
	});
})();
