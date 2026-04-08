import { initializeCanvas } from "ag-psd";
import * as THREE from "three";
import {
	byName,
	drawCharacter3D,
	getPSDMeta,
	groupMeshes,
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

const SCENE_SCALE = 0.1;
const FOV = 30;

(async () => {
	initializeCanvas((w, h) => {
		const c = document.createElement("canvas");
		c.width = w;
		c.height = h;
		return c;
	});

	const {
		width: PSD_W,
		height: PSD_H,
		layers,
	} = await getPSDMeta("/models/character.psd", SKIP);

	const renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setPixelRatio(window.devicePixelRatio);
	document.body.appendChild(renderer.domElement);

	const scene = new THREE.Scene();

	const camera = new THREE.PerspectiveCamera(
		FOV,
		window.innerWidth / window.innerHeight,
	);

	const sceneH = PSD_H * SCENE_SCALE;
	const cameraZ = sceneH / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));

	camera.position.z = cameraZ;

	const nodes = drawCharacter3D(layers, PSD_W, PSD_H, SCENE_SCALE);
	for (const { mesh } of nodes) scene.add(mesh);

	const RIG_MAP = {
		head: { depth: 6 },
		eyeL: { depth: 6.5 },
		eyeR: { depth: 6.5 },
		hairFront: { depth: 7 },
		hairSide: { depth: 6 },
		hairBack: { depth: 3 },
		legs: { depth: 0, move: 0.5 },
		body: { depth: 3 },
		chest: { depth: 4 },
		forearmL: { depth: 3 },
		forearmR: { depth: 3 },
	} as const;

	const meshGroups = groupMeshes<keyof typeof RIG_MAP>(nodes, {
		head: pipe(psdGroup("帽子"), psdGroup("顔"), psdGroup("耳")),
		eyeL: psdGroup("瞳L"),
		eyeR: psdGroup("瞳"),
		body: pipe(
			psdGroup("襟裏"),
			psdGroup("体", ["脚"]),
			(n) => ["袖L1", "袖L2", "袖影L"].includes(n.name),
			(n) => ["袖R1", "袖R2", "袖影R"].includes(n.name),
			byName("上腕L"),
			byName("上腕R"),
		),
		chest: psdGroup("胸"),
		forearmL: pipe(byName("前腕L"), psdGroup("手L")),
		forearmR: pipe(byName("前腕R"), psdGroup("手R")),
		legs: psdGroup("脚"),
		hairFront: psdGroup("前髪"),
		hairSide: psdGroup("前髪サイド"),
		hairBack: psdGroup("後ろ髪"),
	});

	const rig = new KokoroRig(RIG_MAP, meshGroups, camera, 200);

	window.addEventListener("pointermove", (e) => {
		rig.setFocus(
			(e.clientX - window.innerWidth / 2) / (window.innerWidth / 2),
			(e.clientY - window.innerHeight / 2) / (window.innerHeight / 2),
		);
	});

	window.addEventListener("resize", () => {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
	});

	(function animate() {
		requestAnimationFrame(animate);
		rig.tick();

		renderer.render(scene, camera);
	})();
})();
