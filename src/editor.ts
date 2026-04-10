import { initializeCanvas } from "ag-psd";
import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import {
	byName,
	drawCharacter,
	groupNodes,
	pipe,
	psdGroup,
	walkPSD,
} from "./loader";
import {
	BONE_LIST,
	type BONE_NAME,
	type GridOffsets,
	KokoroRig,
	POSE_TEMPLATES,
	type Point,
	type Template,
} from "./rig";

const SKIP = new Set([
	"背景(インポート時削除)",
	"見本_クレジット表記",
	"はじめに",
	"表情差分用パーツ",
	"表情見本",
	"透かし見本",
]);

(async () => {
	initializeCanvas((w, h) => {
		const c = document.createElement("canvas");
		c.width = w;
		c.height = h;
		return c;
	});

	const viewEl = document.getElementById("view");
	const jsonOutEl = document.getElementById("json-out");
	const copyBtnEl = document.getElementById("copy-btn");
	const boneSelectEl = document.getElementById("bone-select");
	const poseSelectEl = document.getElementById("pose-select");
	const gridHost = document.getElementById("grid-editor");

	if (
		!(viewEl instanceof HTMLElement) ||
		!(jsonOutEl instanceof HTMLTextAreaElement) ||
		!(copyBtnEl instanceof HTMLButtonElement) ||
		!(boneSelectEl instanceof HTMLSelectElement) ||
		!(poseSelectEl instanceof HTMLSelectElement) ||
		!(gridHost instanceof SVGElement)
	)
		throw new Error("DOM not ready");

	const app = new PIXI.Application();
	await app.init({ resizeTo: viewEl, backgroundColor: 0x222222 });
	viewEl.appendChild(app.canvas);

	const viewport = new Viewport({
		screenWidth: window.innerWidth,
		screenHeight: window.innerHeight,
		events: app.renderer.events,
	});

	app.stage.addChild(viewport);
	viewport.drag().pinch().wheel();

	const index = await walkPSD("/models/character.psd", SKIP);
	const nodes = drawCharacter(index);

	const root = new PIXI.Container();
	for (const n of nodes) root.addChild(n.container);
	root.scale.set(0.1);
	viewport.addChild(root);

	const { verts, idx, nodeRanges } = groupNodes(nodes, {
		head: pipe(psdGroup("顔"), psdGroup("耳"), psdGroup("瞳L"), psdGroup("瞳")),
		body: pipe(psdGroup("襟裏"), psdGroup("体", ["脚"]), (n) =>
			["袖L1", "袖L2", "袖影L", "袖R1", "袖R2", "袖影R"].includes(n.name),
		),
		forearmL: pipe(byName("前腕L"), psdGroup("手L")),
		upperArmL: byName("上腕L"),
		forearmR: pipe(byName("前腕R"), psdGroup("手R")),
		upperArmR: byName("上腕R"),
		legs: psdGroup("脚"),
		hairFront: psdGroup("前髪"),
		hairSide: psdGroup("前髪サイド"),
		hairBack: psdGroup("後ろ髪"),
	});

	const rig = new KokoroRig(app, nodes, verts, idx, nodeRanges);

	const gridApp = new PIXI.Application();
	await gridApp.init({
		width: gridHost.clientWidth,
		height: gridHost.clientHeight,
		backgroundColor: 0x111111,
	});

	gridHost.replaceWith(gridApp.canvas);

	const gridLayer = new PIXI.Container();
	const scale = Math.min(
		gridApp.screen.width / 1000,
		gridApp.screen.height / 1000,
	);
	gridLayer.scale.set(scale);
	gridLayer.position.set(gridApp.screen.width / 2, gridApp.screen.height / 2);
	gridApp.stage.addChild(gridLayer);

	const template: Template = POSE_TEMPLATES;
	let currentPose = "";
	let activeBone: BONE_NAME = "head";
	let dragIdx = -1;

	boneSelectEl.innerHTML = "";
	for (const b of BONE_LIST) {
		const o = document.createElement("option");
		o.value = b;
		o.textContent = b;
		boneSelectEl.appendChild(o);
	}
	boneSelectEl.value = "head";

	poseSelectEl.innerHTML = "";
	for (const k of Object.keys(POSE_TEMPLATES)) {
		const o = document.createElement("option");
		o.value = k;
		o.textContent = k;
		poseSelectEl.appendChild(o);
	}

	const getBase = (i: number): [number, number] => [
		-300 + (i % 3) * 300,
		-300 + Math.floor(i / 3) * 300,
	];

	const loadPose = (pose: Partial<Record<BONE_NAME, GridOffsets>>) => {
		for (const bone of BONE_LIST) {
			const val = pose[bone];
			const grid = rig.grid[bone];
			if (!val) {
				for (let i = 0; i < 9; i++) grid[i] = [0, 0];
			} else if (typeof val[0] === "number") {
				for (let i = 0; i < 9; i++)
					grid[i] = [val[0] as number, val[1] as number];
			} else {
				for (let i = 0; i < 9; i++)
					grid[i] = (val[i] as Point).slice() as Point;
			}
		}
	};

	const savePose = () => {
		const out: Partial<Record<BONE_NAME, GridOffsets>> = {};
		for (const bone of BONE_LIST) {
			const pts = rig.grid[bone];
			const same = pts.every((p) => p[0] === pts[0][0] && p[1] === pts[0][1]);
			out[bone] = same ? pts[0] : pts;
		}
		template[currentPose] = out;
		jsonOutEl.value = JSON.stringify(template, null, 2);
	};

	const lines: PIXI.Graphics[] = [];
	const points: PIXI.Graphics[] = [];

	for (let i = 0; i < 12; i++) {
		const g = new PIXI.Graphics();
		gridLayer.addChild(g);
		lines.push(g);
	}

	for (let i = 0; i < 9; i++) {
		const g = new PIXI.Graphics();
		g.eventMode = "static";
		g.cursor = "pointer";
		g.on("pointerdown", () => (dragIdx = i));
		gridLayer.addChild(g);
		points.push(g);
	}

	const pairs = [
		[0, 1],
		[1, 2],
		[3, 4],
		[4, 5],
		[6, 7],
		[7, 8],
		[0, 3],
		[3, 6],
		[1, 4],
		[4, 7],
		[2, 5],
		[5, 8],
	];

	const drawGrid = () => {
		const pts = rig.grid[activeBone];

		pairs.forEach(([i, j], k) => {
			const g = lines[k];
			const [x1, y1] = getBase(i);
			const [x2, y2] = getBase(j);
			g.clear();
			g.moveTo(x1 + pts[i][0], y1 + pts[i][1]);
			g.lineTo(x2 + pts[j][0], y2 + pts[j][1]);
			g.stroke({ color: 0x555555, width: 10 / scale });
		});

		pts.forEach((p, i) => {
			const [bx, by] = getBase(i);
			const g = points[i];
			g.clear();
			g.circle(bx + p[0], by + p[1], 32);
			g.fill(i === 4 ? 0x00aaff : 0xffffff);
		});
	};

	gridApp.stage.eventMode = "static";

	gridApp.stage.on("pointermove", (e: PIXI.FederatedPointerEvent) => {
		if (dragIdx === -1) return;
		const pos = e.getLocalPosition(gridLayer);
		const [bx, by] = getBase(dragIdx);
		rig.grid[activeBone][dragIdx] = [
			Math.round(pos.x - bx),
			Math.round(pos.y - by),
		];
		drawGrid();
		savePose();
	});

	window.addEventListener("pointerup", () => {
		dragIdx = -1;
	});

	currentPose = Object.keys(template)[0] ?? "";
	poseSelectEl.value = currentPose;
	loadPose(POSE_TEMPLATES[currentPose]);

	boneSelectEl.onchange = () => {
		activeBone = boneSelectEl.value as BONE_NAME;
		drawGrid();
	};

	poseSelectEl.onchange = () => {
		currentPose = poseSelectEl.value;
		loadPose(POSE_TEMPLATES[currentPose]);
		drawGrid();
		savePose();
	};

	copyBtnEl.onclick = () => navigator.clipboard.writeText(jsonOutEl.value);

	drawGrid();
	savePose();
})();
