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

type GroupKey = keyof typeof GROUP_DEFS;
type VRef = { buf: PIXI.Buffer; data: Float32Array; i: number };

let grouped: Partial<Record<GroupKey, PIXI.Container>> = {};
let baseVertsMap = new Map<PIXI.Buffer, Float32Array>();
let baseBoundsMap = new Map<string, { gw: number; gh: number }>();
let activeHandles: PIXI.Graphics[] = [];
let selectedGroupKey: string | null = null;
const poses: Record<string, Record<string, number[][]>> = {};

function getMeshes(c: PIXI.Container): PIXI.MeshPlane[] {
	const out: PIXI.MeshPlane[] = [];
	function walk(node: PIXI.ContainerChild) {
		if (node instanceof PIXI.MeshPlane) out.push(node);
		else if (node instanceof PIXI.Container) node.children.forEach(walk);
	}
	c.children.forEach(walk);
	return out;
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
		const container = grouped[key as GroupKey];
		if (!container) return;
		const meshes = getMeshes(container);
		if (!meshes.length) return;

		const grid = GRID_PER_GROUP[key as GroupKey] ?? DEFAULT_GRID;
		const allVerts: (VRef & { wx: number; wy: number })[] = [];

		for (const mesh of meshes) {
			const buf = mesh.geometry.getBuffer("aPosition");
			const data = buf.data as Float32Array;
			for (let i = 0; i < data.length; i += 2) {
				allVerts.push({
					buf,
					data,
					i,
					wx: SCENE_SCALE * (mesh.x + data[i]!),
					wy: SCENE_SCALE * (mesh.y + data[i + 1]!),
				});
			}
		}

		const xs = allVerts.map((v) => v.wx);
		const ys = allVerts.map((v) => v.wy);
		const x0 = Math.min(...xs),
			x1 = Math.max(...xs);
		const y0 = Math.min(...ys),
			y1 = Math.max(...ys);
		const uniqueBufs = new Set(allVerts.map((v) => v.buf));
		const handleVerts: (VRef & { wx: number; wy: number })[][] = Array.from(
			{ length: grid * grid },
			() => [],
		);

		for (const v of allVerts) {
			let nearest = 0,
				minDist = Infinity;
			for (let hi = 0; hi < grid * grid; hi++) {
				const hx = x0 + ((x1 - x0) * (hi % grid)) / (grid - 1);
				const hy = y0 + ((y1 - y0) * Math.floor(hi / grid)) / (grid - 1);
				const d = (v.wx - hx) ** 2 + (v.wy - hy) ** 2;
				if (d < minDist) {
					minDist = d;
					nearest = hi;
				}
			}
			handleVerts[nearest]?.push(v);
		}

		for (let hi = 0; hi < grid * grid; hi++) {
			const verts = handleVerts[hi]!;
			const hx = x0 + ((x1 - x0) * (hi % grid)) / (grid - 1);
			const hy = y0 + ((y1 - y0) * Math.floor(hi / grid)) / (grid - 1);
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
					for (const v of verts) {
						v.data[v.i] += dx;
						v.data[v.i + 1] += dy;
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

	async function loadCharacter(url: string) {
		viewport.removeChildren();
		clearHandles();
		grouped = {};
		baseVertsMap = new Map();
		baseBoundsMap = new Map();
		selectedGroupKey = null;

		const index = await getPSDIndex(url, SKIP);
		const spriteNodes = drawCharacter(index);
		grouped = groupNodes(spriteNodes, GROUP_DEFS);

		const root = new PIXI.Container();
		for (const container of Object.values(grouped)) root.addChild(container);
		for (const node of spriteNodes) {
			if (!node.container.parent) root.addChild(node.container);
		}
		root.scale.set(SCENE_SCALE);
		viewport.addChild(root);

		for (const [key, container] of Object.entries(grouped) as [
			GroupKey,
			PIXI.Container,
		][]) {
			const wx: number[] = [],
				wy: number[] = [];
			for (const mesh of getMeshes(container)) {
				const buf = mesh.geometry.getBuffer("aPosition");
				const bv = Float32Array.from(buf.data as Float32Array);
				baseVertsMap.set(buf, bv);
				for (let i = 0; i < bv.length; i += 2) {
					wx.push(mesh.x + bv[i]!);
					wy.push(mesh.y + bv[i + 1]!);
				}
			}
			baseBoundsMap.set(key, {
				gw: Math.max(...wx) - Math.min(...wx) || 1,
				gh: Math.max(...wy) - Math.min(...wy) || 1,
			});
		}

		renderGroupList();
		viewport.fit();
	}

	resetBtn.addEventListener("click", () => {
		if (!selectedGroupKey) return;
		const container = grouped[selectedGroupKey as GroupKey];
		if (!container) return;
		for (const mesh of getMeshes(container)) {
			const buf = mesh.geometry.getBuffer("aPosition");
			const data = buf.data as Float32Array;
			const bv = baseVertsMap.get(buf);
			if (!bv) continue;
			data.set(bv);
			buf.update();
		}
		selectGroup(selectedGroupKey);
	});

	savePoseBtn.addEventListener("click", () => {
		const name = poseNameInput.value.trim();
		if (!name) return;
		const snapshot: Record<string, number[][]> = {};
		for (const [key, container] of Object.entries(grouped) as [
			GroupKey,
			PIXI.Container,
		][]) {
			const meshes = getMeshes(container);
			if (!meshes.length) continue;
			const { gw, gh } = baseBoundsMap.get(key) ?? { gw: 1, gh: 1 };
			snapshot[key] = meshes.map((mesh) => {
				const buf = mesh.geometry.getBuffer("aPosition");
				const data = buf.data as Float32Array;
				const bv = baseVertsMap.get(buf)!;
				const arr: number[] = [];
				for (let i = 0; i < data.length; i += 2) {
					arr.push((data[i]! - bv[i]!) / gw, (data[i + 1]! - bv[i + 1]!) / gh);
				}
				return arr;
			});
		}
		poses[name] = snapshot;
		poseNameInput.value = "";
		renderPoseList();
	});

	function applyPose(name: string) {
		const snapshot = poses[name];
		if (!snapshot) return;
		for (const [key, meshOffsets] of Object.entries(snapshot)) {
			const container = grouped[key as GroupKey];
			if (!container) continue;
			const { gw, gh } = baseBoundsMap.get(key) ?? { gw: 1, gh: 1 };
			getMeshes(container).forEach((mesh, mi) => {
				const arr = meshOffsets[mi];
				if (!arr) return;
				const buf = mesh.geometry.getBuffer("aPosition");
				const data = buf.data as Float32Array;
				const bv = baseVertsMap.get(buf)!;
				for (let i = 0; i < data.length; i += 2) {
					data[i] = bv[i]! + arr[i]! * gw;
					data[i + 1] = bv[i + 1]! + arr[i + 1]! * gh;
				}
				buf.update();
			});
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
