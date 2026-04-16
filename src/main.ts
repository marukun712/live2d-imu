import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import { drawCharacter, setupCanvas, walkPSD } from "./loader";
import { KokoroRig } from "./rig";
import { POSE_TEMPLATES } from "./template";

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

const index = await walkPSD("/models/character.psd");
const nodes = drawCharacter(index);

const root = new PIXI.Container();
for (const node of nodes) root.addChild(node.container);

root.scale.set(0.1);
viewport.addChild(root);

const rig = new KokoroRig(app, nodes, {
	poseTemplate: POSE_TEMPLATES,
});

window.addEventListener("pointermove", (e) => {
	const tx = Math.max(0, Math.min(1, e.clientX / window.innerWidth));
	rig.setPose([rig.lerpBlend("left", "right", tx)]);
});
