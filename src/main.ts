import {
	byName,
	calcBounds,
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
			tx: 300 * swing,
			ty: 10 * Math.abs(swing),
			rot: 0,
			w: w,
		};
	},
	// 前髪と後ろ髪で移動量をずらして、視差をつくる
	leftFront: (_, v) => ({ tx: -1000, ty: 0, rot: -0.08, w: curve.body(v) }),
	rightFront: (_, v) => ({ tx: 1000, ty: 0, rot: 0.08, w: curve.body(v) }),
	leftBack: (_, v) => ({ tx: 500, ty: 0, rot: -0.02, w: curve.body(v) }),
	rightBack: (_, v) => ({ tx: -500, ty: 0, rot: 0.02, w: curve.body(v) }),
};

export const EYE_TEMPLATE: Template = {
	left: () => ({ tx: -15, ty: 0, rot: -0, w: 1 }),
	right: () => ({ tx: 15, ty: 0, rot: 0, w: 1 }),
	up: () => ({ tx: 0, ty: 8, rot: -0, w: 1 }),
	down: () => ({ tx: 0, ty: -8, rot: 0, w: 1 }),
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

const rigBounds = calcBounds(nodes);

const rig = new KokoroRig(app, nodes, {
	poseTemplate: POSE_TEMPLATE,
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
const eyeLRig = new KokoroRig(app, eyeL.nodes, {
	poseTemplate: EYE_TEMPLATE,
	bounds: rigBounds,
	parent: rig,
});
const eyeRRig = new KokoroRig(app, eyeR.nodes, {
	poseTemplate: EYE_TEMPLATE,
	bounds: rigBounds,
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
		rig.lerpBlend("normal", "breathing", params.breathing),
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
});
