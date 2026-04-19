import {
	byName,
	byPath,
	calcBounds,
	drawCharacter,
	groupNodes,
	HAIR_TEMPLATE,
	KokoroFace,
	KokoroRig,
	POSE_TEMPLATE,
	pipe,
	psdGroup,
	setupCanvas,
	walkPSD,
} from "@kokoro/rig";
import gsap from "gsap";
import { Container } from "pixi.js";
import { Viewport } from "pixi-viewport";

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
	show: byName("*ショート"),
	hide: pipe(psdGroup("ヘアピン:flipx"), byPath(["!後髪", "*デフォルト"])),
});

const nodes = drawCharacter(index);

const root = new Container();
for (const node of nodes) root.addChild(node.container);

root.scale.set(0.1);
viewport.addChild(root);

const hairFront = groupNodes(nodes, psdGroup("!前髪"));
const hairBack = groupNodes(nodes, psdGroup("!後髪"));
const arm = groupNodes(nodes, pipe(psdGroup("!手前腕"), psdGroup("胸装飾")));

const rigBounds = calcBounds(nodes);

const rig = new KokoroRig(app, nodes, {
	poseTemplate: POSE_TEMPLATE,
	bounds: rigBounds,
});
const armRig = new KokoroRig(app, arm.nodes, {
	poseTemplate: POSE_TEMPLATE,
	bounds: rigBounds,
	parent: rig,
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

const expression = new KokoroFace(nodes, ["*手前", "*閉じ", "*ん", "*あ半"]);

expression.apply({
	"*手前": true,
	"*閉じ": false,
	"*ん": true,
	"*あ半": false,
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
					"*手前": false,
					"*閉じ": true,
					"*ん": true,
					"*あ半": false,
				}),
		},
	).to(
		{},
		{
			duration: 0.1,
			onComplete: () =>
				expression.apply({
					"*手前": true,
					"*閉じ": false,
					"*ん": true,
					"*あ半": false,
				}),
		},
	);
}
setTimeout(blink, 1000);

function talk() {
	const tl = gsap.timeline({
		repeat: 5,
		onComplete: () => {
			expression.apply({
				"*手前": true,
				"*閉じ": false,
				"*ん": true,
				"*あ半": false,
			});
			setTimeout(talk, 3000 + Math.random() * 4000);
		},
	});
	tl.to(
		{},
		{
			duration: 0.1,
			onComplete: () =>
				expression.apply({
					"*手前": true,
					"*閉じ": false,
					"*ん": false,
					"*あ半": true,
				}),
		},
	).to(
		{},
		{
			duration: 0.1,
			onComplete: () =>
				expression.apply({
					"*手前": true,
					"*閉じ": false,
					"*ん": true,
					"*あ半": false,
				}),
		},
	);
}
setTimeout(talk, 2000);

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
	armRig.setPose([POSE_TEMPLATE.swing]);
	hairFrontRig.setPose([
		hairFrontRig.lerpBlend("leftFront", "rightFront", params.x),
		HAIR_TEMPLATE.swing,
	]);
	hairBackRig.setPose([
		hairBackRig.lerpBlend("leftBack", "rightBack", params.x),
		HAIR_TEMPLATE.swing,
	]);
});
