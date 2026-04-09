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
import type { BONE_NAME } from "./rig";

const SKIP = new Set([
	"背景(インポート時削除)",
	"見本_クレジット表記",
	"はじめに",
	"表情差分用パーツ",
	"表情見本",
	"透かし見本",
]);

const GROUP_DEFS = {
	head: pipe(psdGroup("顔"), psdGroup("耳")),
	eyeL: psdGroup("瞳L"),
	eyeR: psdGroup("瞳"),
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
} as const;

const SCENE_SCALE = 0.1;
const HANDLE_PX = 5;

const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const groupListEl = document.getElementById("groupList") as HTMLDivElement;
const mainEl = document.getElementById("main") as HTMLDivElement;

let nodes: SpriteNode[] = [];
let verts: number[] = [];
let idx: Record<BONE_NAME, { start: number; end: number }> = {} as never;
let nodeRanges = new Map<SpriteNode, { start: number; end: number }>();
let activeHandles: PIXI.Graphics[] = [];

function applyVerts() {
	for (const node of nodes) {
		const r = nodeRanges.get(node);
		if (!r) continue;
		const buf = node.sprite.geometry.getBuffer("aPosition");
		const data = buf.data as Float32Array;
		for (let i = 0; i < r.end - r.start; i++) data[i] = verts[r.start + i]!;
		buf.update();
	}
}

function vertWorldPos(vi: number): { wx: number; wy: number } {
	for (const node of nodes) {
		const r = nodeRanges.get(node);
		if (!r || vi < r.start || vi >= r.end) continue;
		return {
			wx: SCENE_SCALE * (node.sprite.x + verts[vi]!),
			wy: SCENE_SCALE * (node.sprite.y + verts[vi + 1]!),
		};
	}
	return { wx: 0, wy: 0 };
}

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
	app.stage.eventMode = "static";
	app.stage.hitArea = app.screen;

	const viewport = new Viewport({
		screenWidth: mainEl.clientWidth,
		screenHeight: mainEl.clientHeight,
		events: app.renderer.events,
	});
	app.stage.addChild(viewport);
	viewport.drag().pinch().wheel();

	app.ticker.add(() => {
		const s = HANDLE_PX / viewport.scale.x;
		for (const h of activeHandles) h.scale.set(s);
	});

	function clearHandles() {
		for (const h of activeHandles) {
			viewport.removeChild(h);
			h.destroy();
		}
		activeHandles = [];
	}

	function selectGroup(key: BONE_NAME) {
		clearHandles();
		groupListEl
			.querySelectorAll("button")
			.forEach((b) => b.classList.toggle("active", b.textContent === key));

		const { start, end } = idx[key];
		for (let vi = start; vi < end; vi += 2) {
			const { wx, wy } = vertWorldPos(vi);
			const g = new PIXI.Graphics()
				.circle(0, 0, 1)
				.fill({ color: 0x00ccff, alpha: 0.9 });
			g.x = wx;
			g.y = wy;
			g.eventMode = "static";
			g.cursor = "pointer";
			const capturedVi = vi;
			g.on("pointerdown", (e: PIXI.FederatedPointerEvent) => {
				e.stopPropagation();
				viewport.plugins.pause("drag");
				let prev = e.getLocalPosition(viewport);
				const onMove = (ev: PIXI.FederatedPointerEvent) => {
					const pos = ev.getLocalPosition(viewport);
					const dx = (pos.x - prev.x) / SCENE_SCALE;
					const dy = (pos.y - prev.y) / SCENE_SCALE;
					prev = pos;
					verts[capturedVi]! += dx;
					verts[capturedVi + 1]! += dy;
					applyVerts();
					g.x += dx * SCENE_SCALE;
					g.y += dy * SCENE_SCALE;
				};
				const onUp = () => {
					viewport.plugins.resume("drag");
					app.stage.off("pointermove", onMove);
					app.stage.off("pointerup", onUp);
				};
				app.stage.on("pointermove", onMove);
				app.stage.on("pointerup", onUp);
			});
			viewport.addChild(g);
			activeHandles.push(g);
		}
	}

	fileInput.addEventListener("change", async () => {
		const file = fileInput.files?.[0];
		if (!file) return;
		const url = URL.createObjectURL(file);
		viewport.removeChildren();
		clearHandles();

		const layers = await walkPSD(url, SKIP);
		nodes = drawCharacter(layers);
		({ verts, idx, nodeRanges } = groupNodes(nodes, GROUP_DEFS));

		const root = new PIXI.Container();
		for (const node of nodes) root.addChild(node.container);
		root.scale.set(SCENE_SCALE);
		viewport.addChild(root);
		viewport.fit();
		URL.revokeObjectURL(url);

		groupListEl.innerHTML = "";
		for (const key of Object.keys(idx) as BONE_NAME[]) {
			const btn = document.createElement("button");
			btn.textContent = key;
			btn.onclick = () => selectGroup(key);
			groupListEl.appendChild(btn);
		}
	});
})();
