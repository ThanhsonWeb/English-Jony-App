// Run from server: node --experimental-vm-modules scripts/generate-dialogue-catalogue.js [--check]
// Evaluates trusted repository data modules only; exports IDs, never answers/media.
const fs = require("node:fs/promises");
const path = require("node:path");
const vm = require("node:vm");

async function main() {
	const client = path.resolve(__dirname, "../../client");
	const context = vm.createContext({});
	const cache = new Map();
	async function load(filename) {
		if (cache.has(filename)) return cache.get(filename);
		const source = await fs.readFile(filename, "utf8");
		const module = filename.endsWith(".json")
			? new vm.SyntheticModule(["default"], function () { this.setExport("default", JSON.parse(source)); }, { context, identifier: filename })
			: new vm.SourceTextModule(source, { context, identifier: filename });
		cache.set(filename, module);
		await module.link(async (specifier, parent) => {
			const resolved = specifier.startsWith("@/") ? path.resolve(client, specifier.slice(2)) : path.resolve(path.dirname(parent.identifier), specifier);
			if (!resolved.startsWith(client + path.sep)) throw new Error(`Unexpected data import: ${specifier}`);
			return load(path.extname(resolved) ? resolved : resolved + ".js");
		});
		return module;
	}
	const entry = await load(path.join(client, "app/[locale]/(main)/dialogue/_data/lessonData.js"));
	await entry.evaluate({ timeout: 10000 });
	const catalogue = [];
	const seen = new Set();
	for (const lesson of Object.values(entry.namespace.lessonData)) {
		for (const dialogue of lesson.dialogues) {
			for (const task of dialogue.tasks) {
				const ids = [lesson.id, dialogue.id, String(task.id)];
				const key = JSON.stringify(ids);
				if (ids.some(id => !id || id === "undefined") || seen.has(key)) throw new Error(`Invalid/duplicate task: ${key}`);
				seen.add(key);
				catalogue.push(ids);
			}
		}
	}
	if (!catalogue.length) throw new Error("Empty dialogue catalogue");
	catalogue.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), "en"));
	const output = "[\n" + catalogue.map(ids => "\t" + JSON.stringify(ids)).join(",\n") + "\n]\n";
	const destination = path.resolve(__dirname, "../data/dialogueTaskCatalogue.json");
	if (process.argv.includes("--check")) {
		if (await fs.readFile(destination, "utf8") !== output) throw new Error("Dialogue catalogue is stale. Run npm run dialogue:catalogue from server.");
	} else {
		await fs.mkdir(path.dirname(destination), { recursive: true });
		await fs.writeFile(destination, output);
	}
	console.log(`Dialogue catalogue: ${catalogue.length} tasks verified`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
