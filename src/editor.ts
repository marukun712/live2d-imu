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
	type SpriteNode,
} from "./loader";

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
} as const;

const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const groupListEl = document.getElementById("groupList") as HTMLDivElement;
const resetBtn = document.getElementById("resetBtn") as HTMLButtonElement;
const savePoseBtn = document.getElementById("savePoseBtn") as HTMLButtonElement;
const poseNameInput = document.getElementById(
	"poseNameInput",
) as HTMLInputElement;
const poseListEl = document.getElementById("poseList") as HTMLDivElement;
const exportBtn = document.getElementById("exportBtn") as HTMLButtonElement;
const outputEl = document.getElementById("output") as HTMLPreElement;
const mainEl = document.getElementById("main") as HTMLDivElement;

const SCENE_SCALE = 0.1;
const HANDLE_SCREEN_PX = 6;
const GRID = 3;

let nodes: SpriteNode[] = [];
let grouped: Partial<Record<keyof typeof GROUP_DEFS, PIXI.Container[]>> = {};
let containerNodeMap = new Map<PIXI.Container, SpriteNode>();
let baseVertsMap = new Map<string, Float32Array>();
let activeHandles: PIXI.Graphics[] = [];
let selectedGroupKey: string | null = null;

const poses: Record<string, Record<string, number[]>> = {};

function nodeKey(n: SpriteNode) {
	return n.path.join("/");
}

function getMesh(container: PIXI.Container): PIXI.MeshPlane {
	return container.children[container.children.length - 1] as PIXI.MeshPlane;
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

	window.addEventListener("resize", () =>
		viewport.resize(mainEl.clientWidth, mainEl.clientHeight),
	);

	app.ticker.add(() => {
		const s = HANDLE_SCREEN_PX / viewport.scale.x;
		for (const h of activeHandles) h.scale.set(s);
	});

	function clearHandles() {
		for (const h of activeHandles) {
			viewport.removeChild(h);
			h.destroy();
		}
		activeHandles = [];
	}

	function selectGroup(key: string) {
		selectedGroupKey = key;
		clearHandles();
		renderGroupList();

		const containers = grouped[key as keyof typeof GROUP_DEFS] ?? [];

		type VRef = { buf: PIXI.Buffer; data: Float32Array; vi: number };
		const vrefs: VRef[] = [];
		const vworld: [number, number][] = [];
		let x0 = Infinity,
			y0 = Infinity,
			x1 = -Infinity,
			y1 = -Infinity;

		for (const container of containers) {
			const mesh = getMesh(container);
			const buf = mesh.geometry.getBuffer("aPosition");
			const data = buf.data as Float32Array;
			for (let i = 0; i < data.length; i += 2) {
				const wx = SCENE_SCALE * (mesh.x + (data[i] ?? 0));
				const wy = SCENE_SCALE * (mesh.y + (data[i + 1] ?? 0));
				vrefs.push({ buf, data, vi: i });
				vworld.push([wx, wy]);
				x0 = Math.min(x0, wx);
				y0 = Math.min(y0, wy);
				x1 = Math.max(x1, wx);
				y1 = Math.max(y1, wy);
			}
		}

		if (vrefs.length === 0) return;

		const sigma = Math.max(x1 - x0, y1 - y0) / (GRID - 1);
		const uniqueBufs = new Set(vrefs.map((v) => v.buf));

		for (let gy = 0; gy < GRID; gy++) {
			for (let gx = 0; gx < GRID; gx++) {
				const hx = x0 + ((x1 - x0) * gx) / (GRID - 1);
				const hy = y0 + ((y1 - y0) * gy) / (GRID - 1);

				const weights = vworld.map(([wx, wy]) => {
					const d2 = (wx - hx) ** 2 + (wy - hy) ** 2;
					return Math.exp(-d2 / (sigma * sigma));
				});

				const g = new PIXI.Graphics()
					.circle(0, 0, 1)
					.fill({ color: 0x00ccff, alpha: 0.9 });
				g.x = hx;
				g.y = hy;
				g.eventMode = "static";
				g.cursor = "pointer";

				g.on("pointerdown", (e: PIXI.FederatedPointerEvent) => {
					e.stopPropagation();
					viewport.plugins.pause("drag");
					let prev = e.getLocalPosition(viewport);

					const onMove = (ev: PIXI.FederatedPointerEvent) => {
						const pos = ev.getLocalPosition(viewport);
						const dx = (pos.x - prev.x) / SCENE_SCALE;
						const dy = (pos.y - prev.y) / SCENE_SCALE;
						prev = pos;

						for (let i = 0; i < vrefs.length; i++) {
							const v = vrefs[i]!;
							const w = weights[i]!;
							v.data[v.vi] += dx * w;
							v.data[v.vi + 1] += dy * w;
						}
						for (const buf of uniqueBufs) buf.update();

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
	}

	async function loadCharacter(url: string) {
		viewport.removeChildren();
		clearHandles();
		nodes = [];
		grouped = {};
		containerNodeMap = new Map();
		baseVertsMap = new Map();
		selectedGroupKey = null;

		const index = await getPSDIndex(url, SKIP);
		nodes = drawCharacter(index);

		const root = new PIXI.Container();
		for (const node of nodes) {
			root.addChild(node.container);
			containerNodeMap.set(node.container, node);
			const mesh = getMesh(node.container);
			const buf = mesh.geometry.getBuffer("aPosition");
			baseVertsMap.set(
				nodeKey(node),
				Float32Array.from(buf.data as Float32Array),
			);
		}
		root.scale.set(SCENE_SCALE);
		viewport.addChild(root);

		grouped = groupNodes(nodes, GROUP_DEFS);
		renderGroupList();
		viewport.fit();
	}

	resetBtn.addEventListener("click", () => {
		if (!selectedGroupKey) return;
		const containers =
			grouped[selectedGroupKey as keyof typeof GROUP_DEFS] ?? [];
		for (const container of containers) {
			const node = containerNodeMap.get(container);
			if (!node) continue;
			const bv = baseVertsMap.get(nodeKey(node));
			if (!bv) continue;
			const mesh = getMesh(container);
			const buf = mesh.geometry.getBuffer("aPosition");
			const data = buf.data as Float32Array;
			for (let i = 0; i < bv.length; i++) data[i] = bv[i] ?? 0;
			buf.update();
		}
		selectGroup(selectedGroupKey);
	});

	savePoseBtn.addEventListener("click", () => {
		const name = poseNameInput.value.trim();
		if (!name) return;
		const offsets: Record<string, number[]> = {};
		for (const node of nodes) {
			const bv = baseVertsMap.get(nodeKey(node));
			if (!bv) continue;
			const mesh = getMesh(node.container);
			const buf = mesh.geometry.getBuffer("aPosition");
			const data = buf.data as Float32Array;
			const tw = (mesh.texture as PIXI.Texture).width;
			const th = (mesh.texture as PIXI.Texture).height;
			const arr: number[] = [];
			for (let i = 0; i < data.length; i += 2) {
				arr.push(((data[i] ?? 0) - (bv[i] ?? 0)) / tw);
				arr.push(((data[i + 1] ?? 0) - (bv[i + 1] ?? 0)) / th);
			}
			offsets[nodeKey(node)] = arr;
		}
		poses[name] = offsets;
		poseNameInput.value = "";
		renderPoseList();
	});

	function applyPose(name: string) {
		const offsets = poses[name];
		if (!offsets) return;
		for (const node of nodes) {
			const arr = offsets[nodeKey(node)];
			const bv = baseVertsMap.get(nodeKey(node));
			if (!arr || !bv) continue;
			const mesh = getMesh(node.container);
			const buf = mesh.geometry.getBuffer("aPosition");
			const data = buf.data as Float32Array;
			const tw = (mesh.texture as PIXI.Texture).width;
			const th = (mesh.texture as PIXI.Texture).height;
			for (let i = 0; i < data.length; i += 2) {
				data[i] = (bv[i] ?? 0) + (arr[i] ?? 0) * tw;
				data[i + 1] = (bv[i + 1] ?? 0) + (arr[i + 1] ?? 0) * th;
			}
			buf.update();
		}
		if (selectedGroupKey) selectGroup(selectedGroupKey);
	}

	function renderGroupList() {
		groupListEl.innerHTML = "";
		for (const key of Object.keys(grouped)) {
			const btn = document.createElement("button");
			btn.textContent = key;
			if (key === selectedGroupKey) btn.classList.add("active");
			btn.onclick = () => selectGroup(key);
			groupListEl.appendChild(btn);
		}
	}

	function renderPoseList() {
		poseListEl.innerHTML = "";
		for (const name of Object.keys(poses)) {
			const div = document.createElement("div");
			div.className = "pose-item";
			const span = document.createElement("span");
			span.textContent = name;
			span.title = name;
			span.onclick = () => applyPose(name);
			const delBtn = document.createElement("button");
			delBtn.textContent = "×";
			delBtn.onclick = () => {
				delete poses[name];
				renderPoseList();
			};
			div.appendChild(span);
			div.appendChild(delBtn);
			poseListEl.appendChild(div);
		}
	}

	exportBtn.addEventListener("click", () => {
		outputEl.textContent = JSON.stringify(poses, null, 2);
	});

	fileInput.addEventListener("change", async () => {
		const file = fileInput.files?.[0];
		if (!file) return;
		const url = URL.createObjectURL(file);
		await loadCharacter(url);
		URL.revokeObjectURL(url);
	});
})();
