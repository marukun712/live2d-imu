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
	"口A", // 口Bを使用するため
	"照れ", // デフォルト非表示
	"汗", // デフォルト非表示
	"青ざめ", // デフォルト非表示
	"ハート", // デフォルト非表示
	"しいたけ", // デフォルト非表示
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
	// 頭部：顔・耳・目・口・眉を含む
	head: pipe(
		psdGroup("顔"),
		psdGroup("髪"),
		psdGroup("目→"),
		psdGroup("目←"),
		psdGroup("耳→"),
		psdGroup("耳←"),
		psdGroup("口B"),
		psdGroup("眉"),
		byName("襟"),
		byName("頭頂部影"),
	),
	// 胴体：胸・スカート・首・肩を含む（腕と脚は除外）
	body: pipe(
		byName("胴体"),
		psdGroup("首"),
		psdGroup("肩"),
		psdGroup("おっぱい"),
		psdGroup("スカート"),
		byName("スカート影"),
		byName("ひらひら→"),
		byName("ひらひら←"),
		byName("横後髪→"),
		byName("横後髪←"),
		byName("後頭部"),
		psdGroup("尻尾"),
	),
	// 胸部
	chest: psdGroup("おっぱい"),
	// 左上腕（今回は該当レイヤーなし）
	upperArmL: () => false,
	// 左前腕・左手
	forearmL: pipe(psdGroup("袖←"), byName("手←")),
	// 右上腕（今回は該当レイヤーなし）
	upperArmR: () => false,
	// 右前腕・右手
	forearmR: pipe(psdGroup("袖→"), byName("手→")),
	// 脚
	legs: psdGroup("脚"),
	// 前髪
	hairFront: pipe(
		byName("前髪中央"),
		byName("サイド前髪→"),
		byName("サイド前髪←"),
	),
	// サイドの髪
	hairSide: pipe(
		byName("サイド触覚→"),
		byName("サイド触覚←"),
		byName("横前毛→"),
		byName("横前毛←"),
		byName("お花飾り"),
		psdGroup("紐アクセ"),
	),
	// 後ろ髪
	hairBack: () => false,
});

const groups = groupNodes(nodes, {
	// 左目
	eyeL: psdGroup("目←"),
	// 右目
	eyeR: psdGroup("目→"),
	// 左瞳（目→の中の目玉グループ）
	pupilL: (n) => n.path.includes("目←") && n.path.includes("目玉"),
	// 右瞳（目←の中の目玉グループ）
	pupilR: (n) => n.path.includes("目→") && n.path.includes("目玉"),
	// 口（開いている状態の口B）
	mouth: psdGroup("口B"),
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
