import gsap from "gsap";
import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import {
	calcBounds,
	drawCharacter,
	groupNodes,
	psdGroup,
	setupCanvas,
	walkPSD,
} from "./loader";
import { KokoroRig } from "./rig";
import { HAIR_TEMPLATE, POSE_TEMPLATES } from "./template";

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

const hairFront = groupNodes(nodes, psdGroup("頭"));
const hairBack = groupNodes(nodes, psdGroup("後ろ髪"));
const rigBounds = calcBounds(nodes);

const rig = new KokoroRig(app, nodes, {
	poseTemplate: POSE_TEMPLATES,
	bounds: rigBounds,
});
const hairFrontRig = new KokoroRig(app, hairFront.nodes, {
	poseTemplate: HAIR_TEMPLATE,
	bounds: rigBounds,
	parent: rig,
});
const hairBackRig = new KokoroRig(app, hairBack.nodes, {
	poseTemplate: HAIR_TEMPLATE,
	bounds: rigBounds,
	parent: rig,
});

const params = { breathing: 0, x: 0 };

gsap.to(params, {
	breathing: 1,
	duration: 1,
	repeat: -1,
	yoyo: true,
	delay: 1.5,
	ease: "sine.inOut",
});

window.addEventListener("pointermove", (e) => {
	params.x = Math.max(0, Math.min(1, e.clientX / window.innerWidth));
});

app.ticker.add(() => {
	rig.setPose([
		rig.lerpBlend("left", "right", params.x),
		rig.lerpBlend("normal", "breathing", params.breathing),
		POSE_TEMPLATES.swing,
	]);
	hairFrontRig.setPose([HAIR_TEMPLATE.swing]);
	hairBackRig.setPose([HAIR_TEMPLATE.swing]);
});
