import { initializeCanvas } from "ag-psd";
import * as PIXI from "pixi.js";

/**
 * PIXI Application を初期化して指定の親要素にマウントする。
 *
 * @param parent - canvas を追加する DOM 要素
 * @returns 初期化済みの PIXI.Application
 */
export async function setupCanvas(
	parent: HTMLElement,
): Promise<PIXI.Application> {
	initializeCanvas((width, height) => {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		return canvas;
	});

	const app = new PIXI.Application();
	await app.init({
		resizeTo: window,
		backgroundColor: 0xffffff,
	});
	parent.appendChild(app.canvas);
	return app;
}
