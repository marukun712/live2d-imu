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
	forearmL: pipe(byName("前腕L"), psdGroup("手L")),
	upperArmL: byName("上腕L"),
	forearmR: pipe(byName("前腕R"), psdGroup("手R")),
	upperArmR: byName("上腕R"),
	legs: psdGroup("脚"),
	hairFront: psdGroup("前髪"),
	hairSide: psdGroup("前髪サイド"),
	hairBack: psdGroup("後ろ髪"),
} as const;

const GRID_PER_GROUP: Partial<Record<keyof typeof GROUP_DEFS, number>> = {
	body: 6,
	legs: 6,
};

const DEFAULT_GRID = 3;
const SCENE_SCALE = 0.1;
const HANDLE_PX = 6;

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

type VertRef = { buf: PIXI.Buffer; data: Float32Array; i: number };

let nodes: SpriteNode[] = [];
let grouped: Partial<Record<keyof typeof GROUP_DEFS, PIXI.Container[]>> = {};
let containerNodeMap = new Map<PIXI.Container, SpriteNode>();
let baseVertsMap = new Map<string, Float32Array>();
let activeHandles: PIXI.Graphics[] = [];
let selectedGroupKey: string | null = null;

const poses: Record<string, Record<string, Record<string, number[]>>> = {};

const nodeKey = (n: SpriteNode) => n.path.join("/");
const getMesh = (c: PIXI.Container) =>
	c.children[c.children.length - 1] as PIXI.MeshPlane;
const meshBuf = (c: PIXI.Container) => {
	const mesh = getMesh(c);
	const buf = mesh.geometry.getBuffer("aPosition");
	return { mesh, buf, data: buf.data as Float32Array };
};

function collectVerts(containers: PIXI.Container[]) {
	const vrefs: VertRef[] = [];
	const wx: number[] = [],
		wy: number[] = [];
	for (const c of containers) {
		const { mesh, buf, data } = meshBuf(c);
		for (let i = 0; i < data.length; i += 2) {
			vrefs.push({ buf, data, i });
			wx.push(SCENE_SCALE * (mesh.x + data[i]!));
			wy.push(SCENE_SCALE * (mesh.y + data[i + 1]!));
		}
	}
	const x0 = Math.min(...wx),
		x1 = Math.max(...wx);
	const y0 = Math.min(...wy),
		y1 = Math.max(...wy);
	return { vrefs, wx, wy, x0, y0, x1, y1 };
}

function gaussWeights(
	hx: number,
	hy: number,
	wx: number[],
	wy: number[],
	sigma: number,
) {
	return wx.map((x, i) =>
		Math.exp(-((x - hx) ** 2 + (wy[i]! - hy) ** 2) / sigma ** 2),
	);
}

function computeBaseGroupBounds(containers: PIXI.Container[]) {
	const wx: number[] = [],
		wy: number[] = [];
	for (const c of containers) {
		const { mesh } = meshBuf(c);
		const node = containerNodeMap.get(c);
		if (!node) continue;
		const bv = baseVertsMap.get(nodeKey(node));
		if (!bv) continue;
		for (let i = 0; i < bv.length; i += 2) {
			wx.push(mesh.x + bv[i]!);
			wy.push(mesh.y + bv[i + 1]!);
		}
	}
	const x0 = Math.min(...wx),
		x1 = Math.max(...wx);
	const y0 = Math.min(...wy),
		y1 = Math.max(...wy);
	return { x0, y0, gw: x1 - x0, gh: y1 - y0 };
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

	function selectGroup(key: string) {
		selectedGroupKey = key;
		clearHandles();
		renderGroupList();
		const containers = grouped[key as keyof typeof GROUP_DEFS] ?? [];
		if (!containers.length) return;
		const { vrefs, wx, wy, x0, y0, x1, y1 } = collectVerts(containers);
		if (!vrefs.length) return;
		const grid = GRID_PER_GROUP[key as keyof typeof GROUP_DEFS] ?? DEFAULT_GRID;
		const sigma = Math.max(x1 - x0, y1 - y0) / (grid - 1);
		const uniqueBufs = new Set(vrefs.map((v) => v.buf));
		for (let gy = 0; gy < grid; gy++) {
			for (let gx = 0; gx < grid; gx++) {
				const hx = x0 + ((x1 - x0) * gx) / (grid - 1);
				const hy = y0 + ((y1 - y0) * gy) / (grid - 1);
				const weights = gaussWeights(hx, hy, wx, wy, sigma);
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
						vrefs.forEach((v, i) => {
							v.data[v.i] += dx * weights[i]!;
							v.data[v.i + 1] += dy * weights[i]!;
						});
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
			const { data } = meshBuf(node.container);
			baseVertsMap.set(nodeKey(node), Float32Array.from(data));
		}
		root.scale.set(SCENE_SCALE);
		viewport.addChild(root);
		grouped = groupNodes(nodes, GROUP_DEFS);
		renderGroupList();
		viewport.fit();
	}

	resetBtn.addEventListener("click", () => {
		if (!selectedGroupKey) return;
		for (const c of grouped[selectedGroupKey as keyof typeof GROUP_DEFS] ??
			[]) {
			const node = containerNodeMap.get(c);
			if (!node) continue;
			const bv = baseVertsMap.get(nodeKey(node));
			if (!bv) continue;
			const { buf, data } = meshBuf(c);
			data.set(bv);
			buf.update();
		}
		selectGroup(selectedGroupKey);
	});

	savePoseBtn.addEventListener("click", () => {
		const name = poseNameInput.value.trim();
		if (!name) return;
		const groupOffsets: Record<string, Record<string, number[]>> = {};
		for (const [groupKey, containers] of Object.entries(grouped) as [
			keyof typeof GROUP_DEFS,
			PIXI.Container[],
		][]) {
			if (!containers.length) continue;
			const { gw, gh } = computeBaseGroupBounds(containers);
			if (gw === 0 || gh === 0) continue;
			const nodeOffsets: Record<string, number[]> = {};
			for (const c of containers) {
				const node = containerNodeMap.get(c);
				if (!node) continue;
				const bv = baseVertsMap.get(nodeKey(node));
				if (!bv) continue;
				const { data } = meshBuf(c);
				const arr: number[] = [];
				for (let i = 0; i < data.length; i += 2) {
					arr.push((data[i]! - bv[i]!) / gw);
					arr.push((data[i + 1]! - bv[i + 1]!) / gh);
				}
				nodeOffsets[nodeKey(node)] = arr;
			}
			groupOffsets[groupKey] = nodeOffsets;
		}
		poses[name] = groupOffsets;
		poseNameInput.value = "";
		renderPoseList();
	});

	function applyPose(name: string) {
		const groupOffsets = poses[name];
		if (!groupOffsets) return;
		for (const [groupKey, nodeOffsets] of Object.entries(groupOffsets)) {
			const containers = grouped[groupKey as keyof typeof GROUP_DEFS] ?? [];
			if (!containers.length) continue;
			const { gw, gh } = computeBaseGroupBounds(containers);
			if (gw === 0 || gh === 0) continue;
			for (const c of containers) {
				const node = containerNodeMap.get(c);
				if (!node) continue;
				const arr = nodeOffsets[nodeKey(node)];
				const bv = baseVertsMap.get(nodeKey(node));
				if (!arr || !bv) continue;
				const { buf, data } = meshBuf(c);
				for (let i = 0; i < data.length; i += 2) {
					data[i] = bv[i]! + arr[i]! * gw;
					data[i + 1] = bv[i + 1]! + arr[i + 1]! * gh;
				}
				buf.update();
			}
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
			div.append(span, delBtn);
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
