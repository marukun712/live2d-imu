import { readFileSync } from "node:fs";
import Psd from "@webtoon/psd";

const path = Bun.argv[2];
if (!path) {
	console.error("Usage: bun index.ts <file.psd>");
	process.exit(1);
}

const buffer = readFileSync(path).buffer as ArrayBuffer;
const psd = Psd.parse(buffer);

function printTree(nodes: typeof psd.children, indent = "") {
	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i];
		const isLast = i === nodes.length - 1;
		const branch = isLast ? "└─" : "├─";

		const icon = node.type === "Group" ? "📁" : node.isHidden ? "👻" : "🖼";

		console.log(`${indent}${branch} ${icon} ${node.name}`);

		if (node.type === "Group") {
			printTree(node.children, indent + (isLast ? "   " : "│  "));
		}
	}
}

console.log(`📄 ${path}`);
printTree(psd.children);
