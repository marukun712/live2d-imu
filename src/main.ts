import gsap from "gsap";
import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import {
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

const hairFront = groupNodes(nodes, psdGroup("前髪"));
const hairBack = groupNodes(nodes, psdGroup("髪"));

const rig = new KokoroRig(app, nodes, {
	poseTemplate: POSE_TEMPLATES,
});
const hairFrontRig = new KokoroRig(app, hairFront.nodes, {
	poseTemplate: HAIR_TEMPLATE,
});
const hairBackRig = new KokoroRig(app, hairBack.nodes, {
	poseTemplate: HAIR_TEMPLATE,
});

const params = { hairFront: 0, hairBack: 0, breathing: 0, x: 0 };

gsap.to(params, {
	hairFront: 1,
	duration: 1,
	repeat: -1,
	delay: 0.5,
	ease: "none",
});

gsap.to(params, {
	hairBack: 1,
	duration: 1,
	repeat: -1,
	delay: 1.0,
	ease: "none",
});

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
	]);
	hairFrontRig.setPose([HAIR_TEMPLATE.swing]);
	hairBackRig.setPose([HAIR_TEMPLATE.swing]);
});
