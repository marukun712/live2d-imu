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
	later(rand(1.5, 4.0), () => {
		const targetX = rand(0.25, 0.75);
		const targetY = rand(0.35, 0.65);

		gsap.to(anim, {
			lookX: targetX + rand(-0.15, 0.15),
			lookY: targetY + rand(-0.1, 0.1),
			duration: rand(0.25, 0.45),
			ease: "power3.out",
			onComplete: () => {
				gsap.to(anim, {
					lookX: targetX,
					lookY: targetY,
					duration: rand(0.3, 0.6),
					ease: "power2.inOut",
				});
			},
		});

		scheduleGaze();
	});
}

function scheduleLean() {
	later(rand(3.0, 7.0), () => {
		gsap.to(anim, {
			leanX: rand(0.3, 0.7),
			duration: rand(1.2, 2.5),
			ease: "sine.inOut",
		});
		rig.updateSway();
		scheduleLean();
	});
}

function startBreathing() {
	const proxy = { v: 0 };
	gsap.to(proxy, {
		v: 1,
		duration: rand(2.8, 3.5),
		ease: "sine.inOut",
		yoyo: true,
		repeat: -1,
		onUpdate() {
			anim.lookY = anim.lookY * 0.98 + (0.5 + (proxy.v - 0.5) * 0.05) * 0.02;
		},
	});
}

function scheduleReaction() {
	later(rand(8.0, 18.0), () => {
		const reactions = [
			reactionLookUp,
			reactionNod,
			reactionTiltHead,
			reactionBigBlink,
		];
		reactions[Math.floor(Math.random() * reactions.length)]();
		scheduleReaction();
	});
}

function reactionLookUp() {
	gsap.to(anim, {
		lookY: rand(0.1, 0.25),
		duration: 0.4,
		ease: "power2.out",
		onComplete: () => {
			later(rand(0.6, 1.2), () => {
				gsap.to(anim, { lookY: 0.5, duration: 0.6, ease: "power2.inOut" });
			});
		},
	});
}

function reactionNod() {
	gsap
		.timeline()
		.to(anim, { lookY: 0.65, duration: 0.18, ease: "power2.in" })
		.to(anim, { lookY: 0.45, duration: 0.25, ease: "power2.out" })
		.to(anim, { lookY: 0.65, duration: 0.18, ease: "power2.in" })
		.to(anim, { lookY: 0.5, duration: 0.35, ease: "power2.out" });
}

function reactionTiltHead() {
	gsap.to(anim, {
		leanX: Math.random() < 0.5 ? 0.25 : 0.75,
		duration: 0.5,
		ease: "back.out(1.5)",
		onComplete: () => {
			rig.updateSway();
			later(rand(0.8, 1.5), () => {
				gsap.to(anim, {
					leanX: 0.5,
					duration: 0.7,
					ease: "elastic.out(1, 0.6)",
					onUpdate: () => rig.updateSway(),
				});
			});
		},
	});
}

function reactionBigBlink() {
	gsap.to(anim, {
		eyeOpenL: 0,
		eyeOpenR: 0,
		duration: 0.22,
		ease: "power2.in",
		onComplete: () => {
			later(rand(0.1, 0.25), () => {
				gsap.to(anim, {
					eyeOpenL: 1,
					eyeOpenR: 1,
					duration: 0.35,
					ease: "power2.out",
				});
			});
		},
	});
}

later(0.5, () => {
	scheduleBlink();
	scheduleGaze();
	scheduleLean();
	scheduleReaction();
	startBreathing();
});
