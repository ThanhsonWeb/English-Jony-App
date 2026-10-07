// Run from server: node --experimental-vm-modules scripts/generate-dialogue-catalogue.js [--check]
// Evaluates trusted public lesson data; exports active IDs and completion rules.
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
		let module;
		try {
			module = filename.endsWith(".json")
				? new vm.SyntheticModule(["default"], function () { this.setExport("default", JSON.parse(source)); }, { context, identifier: filename })
				: new vm.SourceTextModule(source, { context, identifier: filename });
		} catch (error) {
			throw new Error(`Could not parse dialogue data module ${filename}: ${error.message}`, { cause: error });
		}
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
	const rules = [];
	const seen = new Set();
	for (const lesson of Object.values(entry.namespace.lessonData)) {
		const contentType = lesson.contentType || "dialogue";
		if (contentType !== "dialogue" && contentType !== "story") {
			throw new Error(`Unsupported lesson contentType "${contentType}" for ${lesson.id}`);
		}
		for (const dialogue of lesson.dialogues) {
			for (const task of dialogue.tasks) {
				const ids = [lesson.id, dialogue.id, String(task.id)];
				const key = JSON.stringify(ids);
				if (ids.some(id => !id || id === "undefined") || seen.has(key)) throw new Error(`Invalid/duplicate task: ${key}`);
				seen.add(key);
				catalogue.push(ids);
				let answers;
				switch (task.type) {
					case "fillBlank": answers = task.answers || [task.answer]; break;
					case "multipleChoice": answers = [task.options.indexOf(task.answer)]; break;
					case "arrangeWords": answers = [Array.isArray(task.answer) ? task.answer.join(" ") : task.answer]; break;
					case "dialogueCloze": answers = task.lines.flatMap(line => line.parts.filter(part => typeof part === "object").map(part => part.blank)); break;
					case "review": answers = []; break;
					default: throw new Error(`Unsupported completion type: ${task.type}`);
				}
				if (answers.some(answer => typeof answer === "number" ? answer < 0 : typeof answer !== "string" || !answer.trim())) {
					throw new Error(`Invalid completion answers: ${key}`);
				}
				rules.push({ ids, type: task.type, answers });
			}
		}
	}
	if (!catalogue.length) throw new Error("Empty dialogue catalogue");
	catalogue.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), "en"));
	const output = "[\n" + catalogue.map(ids => "\t" + JSON.stringify(ids)).join(",\n") + "\n]\n";
	const destination = path.resolve(__dirname, "../data/dialogueTaskCatalogue.json");
	rules.sort((a, b) => JSON.stringify(a.ids).localeCompare(JSON.stringify(b.ids), "en"));
	const rulesOutput = JSON.stringify(rules, null, "\t") + "\n";
	const rulesDestination = path.resolve(__dirname, "../data/dialogueTaskRules.json");
	if (process.argv.includes("--check")) {
		if (await fs.readFile(destination, "utf8") !== output) throw new Error("Dialogue catalogue is stale. Run npm run dialogue:catalogue from server.");
		if (await fs.readFile(rulesDestination, "utf8") !== rulesOutput) throw new Error("Dialogue completion rules are stale. Run npm run dialogue:catalogue from server.");
	} else {
		await fs.mkdir(path.dirname(destination), { recursive: true });
		await fs.writeFile(destination, output);
		await fs.writeFile(rulesDestination, rulesOutput);
	}
	console.log(`Dialogue catalogue: ${catalogue.length} tasks verified`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
