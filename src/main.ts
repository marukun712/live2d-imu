import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import {
	byName,
	drawCharacter,
	groupNodes,
	pipe,
	psdGroup,
	rigNodes,
	setupCanvas,
	walkPSD,
} from "./loader";
import { KokoroFace, KokoroRig } from "./rig";
import { POSE_TEMPLATES } from "./template";

const SKIP = new Set([
	"涙_R",
	"涙_L",
	"照れ線L",
	"照れ線R",
	"肩B_L",
	"肩B_R",
	"腕B_L",
	"腕B_R",
	"手B_L",
	"手B_R",
	"手（振り）B_R",
]);

const app = await setupCanvas(document.body);

const viewport = new Viewport({
	screenWidth: window.innerWidth,
	screenHeight: window.innerHeight,
	worldWidth: 1000,
	worldHeight: 1000,
	events: app.renderer.events,
});
app.stage.addChild(viewport);
viewport.drag().pinch().wheel();

const index = await walkPSD("/models/character.psd", SKIP);
const nodes = drawCharacter(index);

const root = new PIXI.Container();
for (const node of nodes) root.addChild(node.container);
root.scale.set(0.1);
viewport.addChild(root);

const { verts, idx, nodeRanges } = rigNodes(nodes, {
	head: pipe(psdGroup("顔"), psdGroup("耳"), psdGroup("帽子")),
	body: pipe(
		psdGroup("襟裏"),
		psdGroup("体", ["脚"]),
		(n) => ["袖L1", "袖L2", "袖影L"].includes(n.name),
		(n) => ["袖R1", "袖R2", "袖影R"].includes(n.name),
	),
	chest: psdGroup("胸"),
	forearmL: pipe(byName("前腕L"), psdGroup("手L")),
	upperArmL: byName("上腕L"),
	forearmR: pipe(byName("前腕R"), psdGroup("手R")),
	upperArmR: byName("上腕R"),
	legs: psdGroup("脚"),
	hairFront: psdGroup("前髪"),
	hairSide: psdGroup("前髪サイド"),
	hairBack: psdGroup("後ろ髪"),
});

const groups = groupNodes(nodes, {
	eyeL: psdGroup("目L"),
	eyeR: psdGroup("目R"),
	pupilL: psdGroup("瞳L"),
	pupilR: psdGroup("瞳"),
	mouth: psdGroup("口"),
});

const rig = new KokoroRig(app, nodes, verts, idx, nodeRanges, POSE_TEMPLATES);
const face = new KokoroFace(groups);

window.addEventListener("pointermove", (e) => {
	const tx = Math.max(0, Math.min(1, e.clientX / window.innerWidth));
	const ty = Math.max(0, Math.min(1, e.clientY / window.innerHeight));
	face.setFocus(tx, ty);
	rig.setPose([
		rig.calcTween("up", "down", ty),
		rig.calcTween("left", "right", tx),
		rig.calcTween("leanLeft", "leanRight", tx),
	]);
	rig.updateSway();
});
