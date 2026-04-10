import { initializeCanvas } from "ag-psd";
import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import {
	byName,
	drawCharacter,
	groupNodes,
	pipe,
	psdGroup,
	type SpriteNode,
	walkPSD,
} from "./loader";
import { type BONE_NAME, KokoroRig } from "./rig";

const SKIP = new Set([
	"背景(インポート時削除)",
	"見本_クレジット表記",
	"はじめに",
	"表情差分用パーツ",
	"表情見本",
	"透かし見本",
]);

const GROUP_DEFS = {
	head: pipe(psdGroup("顔"), psdGroup("耳"), psdGroup("瞳L"), psdGroup("瞳")),
	body: pipe(
		psdGroup("襟裏"),
		psdGroup("体", ["脚"]),
		(n) => ["袖L1", "袖L2", "袖影L"].includes(n.name),
		(n) => ["袖R1", "袖R2", "袖影R"].includes(n.name),
	),
	forearmL: pipe(byName("前腕L"), psdGroup("手L")),
	upperArmL: byName("上腕L"),
	forearmR: pipe(byName("前腕R"), psdGroup("手R")),
	upperArmR: byName("上腕R"),
	legs: psdGroup("脚"),
	hairFront: psdGroup("前髪"),
	hairSide: psdGroup("前髪サイド"),
	hairBack: psdGroup("後ろ髪"),
};

const POSE_TEMPLATES: Record<
	string,
	Partial<Record<BONE_NAME, [number, number]>>
> = {
	normal: {},
	left: {
		head: [-40, 0],
		hairFront: [-80, 0],
		hairSide: [-60, 0],
		hairBack: [40, 0],
		body: [-20, 0],
		legs: [-10, 0],
	},
	right: {
		head: [40, 0],
		hairFront: [80, 0],
		hairSide: [60, 0],
		hairBack: [-20, 0],
		body: [20, 0],
		legs: [10, 0],
	},
};

const SCENE_SCALE = 0.1;

const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const mainEl = document.getElementById("main") as HTMLDivElement;

let nodes: SpriteNode[] = [];
let verts: number[] = [];
let idx: Record<BONE_NAME, { start: number; end: number }> = {} as never;
let nodeRanges = new Map<SpriteNode, { start: number; end: number }>();
let rig: KokoroRig;

const templateUI = document.createElement("div");
templateUI.style.cssText =
	"position:absolute;top:10px;right:10px;display:flex;gap:5px;z-index:10;";
mainEl.appendChild(templateUI);

(async () => {
	initializeCanvas((w, h) => {
		const c = document.createElement("canvas");
		c.width = w;
		c.height = h;
		return c;
	});

	const app = new PIXI.Application();
	await app.init({ resizeTo: mainEl, background: 0x111111, antialias: true });
	mainEl.appendChild(app.canvas as HTMLCanvasElement);

	const viewport = new Viewport({
		screenWidth: mainEl.clientWidth,
		screenHeight: mainEl.clientHeight,
		events: app.renderer.events,
	});

	viewport.drag().pinch().wheel();
	app.stage.addChild(viewport);

	function applyTemplate(name: string) {
		const tpl = POSE_TEMPLATES[name];
		for (const key of Object.keys(idx) as BONE_NAME[]) {
			if (!rig.offsets[key]) continue;
			const offset = tpl[key] || [0, 0];
			rig.offsets[key].x = offset[0];
			rig.offsets[key].y = offset[1];
		}
	}

	fileInput.addEventListener("change", async () => {
		const file = fileInput.files?.[0];
		if (!file) return;

		const url = URL.createObjectURL(file);
		viewport.removeChildren();

		const layers = await walkPSD(url, SKIP);
		nodes = drawCharacter(layers);
		({ verts, idx, nodeRanges } = groupNodes(nodes, GROUP_DEFS));

		rig = new KokoroRig(app, nodes, verts, idx, nodeRanges);

		const root = new PIXI.Container();
		for (const node of nodes) root.addChild(node.container);
		root.scale.set(SCENE_SCALE);
		viewport.addChild(root);
		viewport.fit();

		URL.revokeObjectURL(url);

		templateUI.innerHTML = "";
		for (const name of Object.keys(POSE_TEMPLATES)) {
			const btn = document.createElement("button");
			btn.textContent = name;
			btn.onclick = () => applyTemplate(name);
			templateUI.appendChild(btn);
		}
	});
})();
