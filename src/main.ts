import gsap from "gsap";
import * as PIXI from "pixi.js";
import { Viewport } from "pixi-viewport";
import {
	byName,
	drawCharacter,
	groupNodes,
	pipe,
	psdGroup,
	rigNodes,
	setupCanvas,
	walkPSD,
} from "./loader";
import { KokoroFace, KokoroRig } from "./rig";
import { POSE_TEMPLATES } from "./template";

const SKIP = new Set(["口A", "照れ", "汗", "青ざめ", "ハート", "しいたけ"]);

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

const { verts, idx, nodeRanges } = rigNodes(nodes, {
	head: pipe(
		psdGroup("顔"),
		psdGroup("髪"),
		psdGroup("目→"),
		psdGroup("目←"),
		psdGroup("耳→"),
		psdGroup("耳←"),
		psdGroup("口B"),
		psdGroup("眉"),
		byName("襟"),
		byName("頭頂部影"),
	),
	body: pipe(
		byName("胴体"),
		psdGroup("首"),
		psdGroup("肩"),
		psdGroup("おっぱい"),
		psdGroup("スカート"),
		byName("スカート影"),
		byName("ひらひら→"),
		byName("ひらひら←"),
		byName("横後髪→"),
		byName("横後髪←"),
		byName("後頭部"),
		psdGroup("尻尾"),
	),
	chest: psdGroup("おっぱい"),
	upperArmL: () => false,
	forearmL: pipe(psdGroup("袖←"), byName("手←")),
	upperArmR: () => false,
	forearmR: pipe(psdGroup("袖→"), byName("手→")),
	legs: psdGroup("脚"),
	hairFront: pipe(
		byName("前髪中央"),
		byName("サイド前髪→"),
		byName("サイド前髪←"),
	),
	hairSide: pipe(
		byName("サイド触覚→"),
		byName("サイド触覚←"),
		byName("横前毛→"),
		byName("横前毛←"),
		byName("お花飾り"),
		psdGroup("紐アクセ"),
	),
	hairBack: () => false,
});

const groups = groupNodes(nodes, {
	eyeL: psdGroup("目←"),
	eyeR: psdGroup("目→"),
	pupilL: (n) => n.path.includes("目←") && n.path.includes("目玉"),
	pupilR: (n) => n.path.includes("目→") && n.path.includes("目玉"),
	mouth: psdGroup("口B"),
});

const rig = new KokoroRig(app, nodes, verts, idx, nodeRanges, POSE_TEMPLATES);
const face = new KokoroFace(groups);

const anim = {
	lookX: 0.5,
	lookY: 0.5,
	leanX: 0.5,
	eyeOpenL: 1,
	eyeOpenR: 1,
	mouthOpen: 0,
};

app.ticker.add(() => {
	face.setFocus(anim.lookX, anim.lookY);
	face.setOpenEyeL(anim.eyeOpenL);
	face.setOpenEyeR(anim.eyeOpenR);
	face.setOpenMouth(anim.mouthOpen);
	rig.setPose([
		rig.calcTween("up", "down", anim.lookY),
		rig.calcTween("left", "right", anim.lookX),
		rig.calcTween("leanLeft", "leanRight", anim.leanX),
	]);
});

function rand(min: number, max: number) {
	return min + Math.random() * (max - min);
}

function later(delay: number, fn: () => void) {
	gsap.delayedCall(delay, fn);
}

function scheduleBlink() {
	later(rand(2.0, 5.5), () => {
		const count = Math.random() < 0.15 ? 2 : 1;
		let delay = 0;

		for (let i = 0; i < count; i++) {
			const offset = i * 0.35;
			const closeTime = rand(0.06, 0.1);
			const openTime = rand(0.1, 0.16);

			gsap.to(anim, {
				eyeOpenL: 0,
				duration: closeTime,
				delay,
				ease: "power2.in",
			});
			gsap.to(anim, {
				eyeOpenR: 0,
				duration: closeTime,
				delay: delay + 0.02,
				ease: "power2.in",
				onComplete: () => {
					gsap.to(anim, {
						eyeOpenL: 1,
						duration: openTime,
						ease: "power2.out",
					});
					gsap.to(anim, {
						eyeOpenR: 1,
						duration: openTime,
						delay: 0.02,
						ease: "power2.out",
					});
				},
			});

			delay += offset + closeTime + openTime;
		}

		scheduleBlink();
	});
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

function startBreathing() {
	const proxy = { v: 0 };
	gsap.to(proxy, {
		v: 1,
		duration: rand(0.8, 1.4),
		ease: "sine.inOut",
		yoyo: true,
		repeat: -1,
		onUpdate() {
			anim.lookY += (proxy.v - 0.5) * 0.04;
			anim.leanX += (proxy.v - 0.5) * 0.025;
		},
	});
}

later(0.5, () => {
	scheduleBlink();
	scheduleGaze();
	scheduleLean();
	startBreathing();
});
