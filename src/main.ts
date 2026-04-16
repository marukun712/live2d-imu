import gsap from "gsap";
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

const anim = {
	lookX: 0.5,
	lookY: 0.5,
	leanX: 0.5,
};

app.ticker.add(() => {
	rig.setPose([
		rig.calcBlend("left", "right", anim.lookX),
		rig.calcBlend("up", "down", anim.lookY),
		rig.calcBlend("leanLeft", "leanRight", anim.leanX),
	]);
});

function rand(min: number, max: number) {
	return min + Math.random() * (max - min);
}

function later(delay: number, fn: () => void) {
	gsap.delayedCall(delay, fn);
}

function scheduleGaze() {
	gsap.to(anim, {
		lookX: () => rand(0.0, 1.0),
		lookY: () => rand(0.0, 1.0),
		duration: () => rand(0.4, 1.2),
		ease: "sine.inOut",
		onComplete: scheduleGaze,
	});
}

function scheduleLean() {
	gsap.to(anim, {
		leanX: () => rand(0.0, 1.0),
		duration: () => rand(0.6, 1.5),
		ease: "sine.inOut",
		onUpdate: () => rig.updateSway(),
		onComplete: scheduleLean,
	});
}

later(0.5, () => {
	scheduleGaze();
	scheduleLean();
});
