import { initializeCanvas } from "ag-psd";
import * as PIXI from "pixi.js";
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

	const app = new PIXI.Application();

	await app.init({
		resizeTo: window,
		backgroundColor: 0xffffff,
	});

	document.body.appendChild(app.canvas);

	const viewport = new Viewport({
		screenWidth: window.innerWidth,
		screenHeight: window.innerHeight,
		worldWidth: 1000,
		worldHeight: 1000,
		events: app.renderer.events,
	});

	app.stage.addChild(viewport);

	viewport.drag().pinch().wheel();

	const index = await getPSDIndex("/models/character.psd", SKIP);
	const nodes = drawCharacter(index);

	console.log(index.map((n) => n.path.join(" > ")));

	const root = new PIXI.Container();
	for (const node of nodes) root.addChild(node.container);
	root.scale.set(0.1);
	viewport.addChild(root);

	const containers = groupNodes(nodes, {
		head: pipe(psdGroup("帽子"), psdGroup("顔"), psdGroup("耳")),
		eyeL: psdGroup("瞳L"),
		eyeR: psdGroup("瞳"),
		body: pipe(
			psdGroup("襟裏"),
			psdGroup("体", ["脚"]),
			(n) => ["袖L1", "袖L2", "袖影L"].includes(n.name),
			(n) => ["袖R1", "袖R2", "袖影R"].includes(n.name),
		),
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

	const rig = new KokoroRig(app, containers, 400, 200);

	window.addEventListener("pointermove", (e: PointerEvent) => {
		const cx = window.innerWidth / 2;
		const cy = window.innerHeight / 2;
		rig.setFocus((e.clientX - cx) / cx, (e.clientY - cy) / cy);
	});
})();
