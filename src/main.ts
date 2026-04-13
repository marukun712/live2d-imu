import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import {
	drawCharacter,
	groupNodes,
	rigNodes,
	setupCanvas,
	walkPSD,
} from "./loader";
import { KokoroFace, KokoroRig } from "./rig";
import { POSE_TEMPLATES } from "./template";

const SKIP = new Set([]);

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

const { verts, idx, nodeRanges } = rigNodes(nodes);

const groups = groupNodes(nodes);

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
