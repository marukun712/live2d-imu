# KokoroRig

KokoroRigは、エンジニアのための人型画像変形ライブラリです。
複雑なGUIは不要、コードと頂点配列の重みづけ操作のみで多様なキャラクターの動きを実現します。

# Usage

```typescript
import {
	calcBounds,
	curve,
	drawCharacter,
	getCylinderWeight,
	getSpatialParams,
	groupNodes,
	KokoroRig,
	psdGroup,
	setupCanvas,
	type Template,
	walkPSD,
} from "@kokoro/rig";
import gsap from "gsap";
import { Container } from "pixi.js";
import { Viewport } from "pixi-viewport";

const POSE_TEMPLATES: Template = {
	left: (u, v) => {
		const { fromTop } = getSpatialParams(u, v);
		const depth = getCylinderWeight(u, -0.5);
		const w = curve.body(fromTop) * depth;
		return {
			tx: -1e2,
			ty: 0,
			rot: -0.1,
			w: w,
		};
	},
	right: (u, v) => {
		const { fromTop } = getSpatialParams(u, v);
		const depth = getCylinderWeight(u, 0.5);
		const w = curve.body(fromTop) * depth;
		return {
			tx: 1e2,
			ty: 0,
			rot: 0.1,
			w: w,
		};
	},
	up: (u, v) => {
		const { fromTop } = getSpatialParams(u, v);
		const w = curve.body(fromTop);
		return {
			tx: 0,
			ty: -2e2,
			rot: 0,
			w: w,
		};
	},
	down: (u, v) => {
		const { fromTop } = getSpatialParams(u, v);
		const w = curve.body(fromTop);
		return {
			tx: 0,
			ty: 0,
			rot: 0,
			w: w,
		};
	},
	normal: () => {
		return {
			tx: 0,
			ty: 0,
			rot: 0,
			w: 0,
		};
	},
	breathing: (u, v) => {
		const { fromTop } = getSpatialParams(u, v);
		const w = curve.chest(fromTop);
		return {
			tx: 0,
			ty: 40,
			rot: 0,
			w,
		};
	},
	swing: (_, v, t) => {
		const swing = Math.sin(t * 0.1);
		const w = curve.power1(v);
		return {
			tx: 3e2 * swing,
			ty: 10 * Math.abs(swing),
			rot: 0,
			w: w,
		};
	},
};

const HAIR_TEMPLATE: Template = {
	swing: (_, v, t) => {
		const swing = Math.sin(t * 0.1);
		const w = curve.hair(v);
		return {
			tx: 3e2 * swing,
			ty: 10 * Math.abs(swing),
			rot: 0,
			w: w,
		};
	},
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

const index = await walkPSD("/models/character.psd");
const nodes = drawCharacter(index);

const root = new Container();
for (const node of nodes) root.addChild(node.container);

root.scale.set(0.1);
viewport.addChild(root);

const hairFront = groupNodes(nodes, psdGroup("!前髪"));
const hairBack = groupNodes(nodes, psdGroup("!後髪"));
const arm = groupNodes(nodes, psdGroup("!手前腕"));

const rigBounds = calcBounds(nodes);

const rig = new KokoroRig(app, nodes, {
	poseTemplate: POSE_TEMPLATES,
	bounds: rigBounds,
});
const armRig = new KokoroRig(app, arm.nodes, {
	poseTemplate: POSE_TEMPLATES,
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

const params = { breathing: 0, x: 0.5, y: 0.5 };

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
	params.y = Math.max(0, Math.min(1, e.clientY / window.innerHeight));
});

app.ticker.add(() => {
	rig.setPose([
		rig.lerpBlend("left", "right", params.x),
		rig.lerpBlend("up", "down", params.y),
		rig.lerpBlend("normal", "breathing", params.breathing),
	]);
	armRig.setPose([POSE_TEMPLATES.swing]);
	hairFrontRig.setPose([HAIR_TEMPLATE.swing]);
	hairBackRig.setPose([HAIR_TEMPLATE.swing]);
});
```
