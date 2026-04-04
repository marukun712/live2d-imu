import { initializeCanvas, readPsd } from "ag-psd";
import gsap from "gsap";
import * as PIXI from "pixi.js";
import { buildContainers, buildRig, type KokoroRig, type RigOpts } from "./lib";

const LAYER_MAP = {
	head: "顔",
	eyeR: "瞳",
	eyeL: "瞳L",
	chest: "胸",
	arm: "腕",
	legs: "脚",
	hairFront: "前髪",
	hairSide: "前髪サイド",
	hairBack: "後ろ髪",
	ear: "耳",
	collar: "襟裏",
	skirt: "スカート",
	earringsL: "ピアスL",
	earringsR: "ピアスR",
	ribbon: "胸リボン",
	hat: "帽子",
} as const;

const SKIP = new Set([
	"背景(インポート時削除)",
	"見本_クレジット表記",
	"はじめに",
	"表情差分用パーツ",
	"表情見本",
	"透かし見本",
]);

const DEPTH_MAP: Partial<Record<keyof typeof LAYER_MAP, RigOpts>> = {
	head: { depth: 0.5 },
	eyeR: { depth: 0.1 },
	eyeL: { depth: 0.1 },
	chest: { depth: 0.3, spring: { stiffness: 0.05 } },
	arm: { depth: 0.3 },
	skirt: { depth: 0.3 },
	ear: { depth: 0.5 },
	hat: { depth: 0.2 },
	hairFront: { depth: 0.8, spring: { stiffness: 0.1 } },
	hairSide: { depth: 0.7, spring: { stiffness: 0.1 } },
	hairBack: { depth: 0.3, spring: { stiffness: 0.1 } },
	earringsL: { depth: 0.8, spring: { stiffness: 0.05 } },
	earringsR: { depth: 0.8, spring: { stiffness: 0.05 } },
	ribbon: { depth: 0.8, spring: { stiffness: 0.05 } },
};

export function startIdleAnimation(rig: KokoroRig) {
	const breathe = { y: 0 };
	const sway = { x: 0 };
	const drift = { x: 0, y: 0 };

	gsap.to(breathe, {
		y: 1,
		duration: 2,
		ease: "sine.inOut",
		yoyo: true,
		repeat: -1,
	});

	gsap.to(sway, {
		x: 0.6,
		duration: 3,
		ease: "sine.inOut",
		yoyo: true,
		repeat: -1,
		delay: 1.5,
	});

	gsap
		.timeline({ repeat: -1, delay: 3 })
		.to(drift, { x: -1.2, y: -0.4, duration: 1.8, ease: "power2.inOut" })
		.to(drift, { x: 0, y: 0, duration: 2.4, ease: "power1.inOut" })
		.to({}, { duration: 2.5 })
		.to(drift, { x: 0.8, y: 0.3, duration: 1.4, ease: "power2.inOut" })
		.to(drift, { x: 0, y: 0, duration: 2.0, ease: "power1.inOut" })
		.to({}, { duration: 3 });

	function onTick() {
		rig.setForcus(sway.x + drift.x, breathe.y + drift.y);
	}

	return { onTick };
}

(async () => {
	initializeCanvas((width, height) => {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		return canvas;
	});

	const view = document.createElement("canvas");
	document.body.appendChild(view);

	const app = new PIXI.Application({
		view,
		resizeTo: window,
		backgroundColor: 0xffffff,
	});

	const res = await fetch("/models/character.psd");
	const psd = readPsd(await res.arrayBuffer());

	const { root, containers } = buildContainers(psd, LAYER_MAP, SKIP);
	root.scale.set(0.12);
	root.x = app.screen.width / 2;
	root.y = app.screen.height / 2;
	app.stage.addChild(root);

	const rig = buildRig(app, containers, DEPTH_MAP, 200, 20);

	const idle = startIdleAnimation(rig);
	app.ticker.add(idle.onTick);
})();
