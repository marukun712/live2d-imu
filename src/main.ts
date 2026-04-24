import {
	byName,
	curve,
	drawCharacter,
	groupNodes,
	KokoroFace,
	KokoroRig,
	POSE_TEMPLATE,
	pipe,
	psdGroup,
	setupCanvas,
	type Template,
	walkPSD,
} from "@kokoro/rig";
import gsap from "gsap";
import { Container } from "pixi.js";
import { Viewport } from "pixi-viewport";

export const HAIR_TEMPLATE: Template = {
	swing: (_, v, t) => {
		const swing = Math.sin(t * 0.05);
		const w = curve.body(v);
		return {
			tx: 40 * swing,
			ty: 0,
			w: w,
		};
	},
	leftFront: () => ({ tx: -20, ty: 0, w: 1 }),
	rightFront: () => ({ tx: 20, ty: 0, w: 1 }),
	leftBack: () => ({ tx: 10, ty: 0, w: 1 }),
	rightBack: () => ({ tx: -10, ty: 0, w: 1 }),
};

export const ARM_TEMPLATE: Template = {
	swing: (_, v, t) => {
		const swing = Math.sin(t * 0.05);
		const w = curve.hair(v);
		return {
			tx: 30 * swing,
			ty: 0,
			w: w,
		};
	},
};

export const EYE_TEMPLATE: Template = {
	left: () => ({ tx: -10, ty: 0, w: 1 }),
	right: () => ({ tx: 10, ty: 0, w: 1 }),
	up: () => ({ tx: 0, ty: 5, w: 1 }),
	down: () => ({ tx: 0, ty: -5, w: 1 }),
};

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

const index = await walkPSD("/models/character.psd", {
	show: byName("口　閉じ"),
	hide: byName("笑顔　口"),
});

const nodes = drawCharacter(index);

const root = new Container();
for (const node of nodes) root.addChild(node.container);

root.scale.set(0.1);
viewport.addChild(root);

const hairFront = groupNodes(
	nodes,
	pipe(psdGroup("前　髪"), psdGroup("もみあげ")),
);
const hairBack = groupNodes(nodes, psdGroup("後　髪"));
const eyeL = groupNodes(
	nodes,
	pipe(psdGroup("左　瞳"), psdGroup("左　ハイライト")),
);
const eyeR = groupNodes(
	nodes,
	pipe(psdGroup("右　瞳"), psdGroup("右　ハイライト")),
);

const skirt = groupNodes(nodes, psdGroup("スカート"));
const ribbon = groupNodes(nodes, psdGroup("リボン"));
const leftArm = groupNodes(nodes, psdGroup("左腕"));
const rightArm = groupNodes(nodes, psdGroup("右腕"));

const rig = new KokoroRig(app, nodes, {
	poseTemplate: POSE_TEMPLATE,
});
const hairFrontRig = new KokoroRig(app, hairFront.nodes, {
	poseTemplate: HAIR_TEMPLATE,
	parent: rig,
});
const hairBackRig = new KokoroRig(app, hairBack.nodes, {
	poseTemplate: HAIR_TEMPLATE,
	parent: rig,
});
const eyeLRig = new KokoroRig(app, eyeL.nodes, {
	poseTemplate: EYE_TEMPLATE,
	parent: rig,
});
const eyeRRig = new KokoroRig(app, eyeR.nodes, {
	poseTemplate: EYE_TEMPLATE,
	parent: rig,
});
const skirtRig = new KokoroRig(app, skirt.nodes, {
	poseTemplate: HAIR_TEMPLATE,
	parent: rig,
});
const ribbonRig = new KokoroRig(app, ribbon.nodes, {
	poseTemplate: HAIR_TEMPLATE,
	parent: rig,
});
const leftArmRig = new KokoroRig(app, leftArm.nodes, {
	poseTemplate: ARM_TEMPLATE,
	parent: rig,
});
const rightArmRig = new KokoroRig(app, rightArm.nodes, {
	poseTemplate: ARM_TEMPLATE,
	parent: rig,
});

const expression = new KokoroFace(nodes, [
	"左　目　閉じ",
	"右　目　閉じ",
	"左　ハイライト",
	"右　ハイライト",
	"左　まつ毛",
	"右　まつ毛",
	"左　瞳",
	"右　瞳",
	"左　白目",
	"右　白目",
]);

expression.apply({
	"左　目　閉じ": false,
	"右　目　閉じ": false,
	"左　ハイライト": true,
	"右　ハイライト": true,
	"左　まつ毛": true,
	"右　まつ毛": true,
	"左　瞳": true,
	"右　瞳": true,
	"左　白目": true,
	"右　白目": true,
});

function blink() {
	const tl = gsap.timeline({
		onComplete: () => setTimeout(blink, 2000 + Math.random() * 3000),
	});
	tl.to(
		{},
		{
			duration: 0.07,
			onComplete: () =>
				expression.apply({
					"左　目　閉じ": true,
					"右　目　閉じ": true,
					"左　ハイライト": false,
					"右　ハイライト": false,
					"左　まつ毛": false,
					"右　まつ毛": false,
					"左　瞳": false,
					"右　瞳": false,
					"左　白目": false,
					"右　白目": false,
				}),
		},
	).to(
		{},
		{
			duration: 0.1,
			onComplete: () =>
				expression.apply({
					"左　目　閉じ": false,
					"右　目　閉じ": false,
					"左　ハイライト": true,
					"右　ハイライト": true,
					"左　まつ毛": true,
					"右　まつ毛": true,
					"左　瞳": true,
					"右　瞳": true,
					"左　白目": true,
					"右　白目": true,
				}),
		},
	);
}
setTimeout(blink, 1000);

const params = { breathing: 0, x: 0.5, y: 0.5 };

gsap.to(params, {
	breathing: 1,
	duration: 1.2,
	ease: "sine.inOut",
	repeat: 0,
	yoyo: true,
});

function randomMove() {
	gsap.to(params, {
		x: Math.random(),
		y: Math.random(),
		duration: 1.0 + Math.random() * 1.5,
		ease: "sine.inOut",
		onComplete: randomMove,
	});
}
randomMove();

app.ticker.add(() => {
	rig.setPose([
		rig.lerpBlend("left", "right", params.x),
		rig.lerpBlend("up", "down", params.y),
	]);
	hairFrontRig.setPose([
		hairFrontRig.lerpBlend("leftFront", "rightFront", params.x),
		HAIR_TEMPLATE.swing,
	]);
	hairBackRig.setPose([
		hairBackRig.lerpBlend("leftBack", "rightBack", params.x),
		HAIR_TEMPLATE.swing,
	]);
	eyeLRig.setPose([
		eyeLRig.lerpBlend("left", "right", params.x),
		eyeLRig.lerpBlend("up", "down", params.y),
	]);
	eyeRRig.setPose([
		eyeRRig.lerpBlend("left", "right", params.x),
		eyeRRig.lerpBlend("up", "down", params.y),
	]);
	skirtRig.setPose([HAIR_TEMPLATE.swing]);
	ribbonRig.setPose([HAIR_TEMPLATE.swing]);
	leftArmRig.setPose([ARM_TEMPLATE.swing]);
	rightArmRig.setPose([ARM_TEMPLATE.swing]);
});
