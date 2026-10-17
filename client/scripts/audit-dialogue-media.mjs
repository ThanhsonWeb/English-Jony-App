import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(root, "public");
const context = vm.createContext({});
const modules = new Map();

async function load(filename) {
	if (modules.has(filename)) return modules.get(filename);
	const source = await readFile(filename, "utf8");
	const dataModule = filename.endsWith(".json")
		? new vm.SyntheticModule(["default"], function () { this.setExport("default", JSON.parse(source)); }, { context, identifier: filename })
		: new vm.SourceTextModule(source, { context, identifier: filename });
	modules.set(filename, dataModule);
	await dataModule.link((specifier, parent) => {
		const resolved = specifier.startsWith("@/")
			? path.resolve(root, specifier.slice(2))
			: path.resolve(path.dirname(parent.identifier), specifier);
		if (!resolved.startsWith(root + path.sep)) throw new Error(`Unexpected import: ${specifier}`);
		return load(path.extname(resolved) ? resolved : resolved + ".js");
	});
	return dataModule;
}

const entry = await load(path.join(root, "app/[locale]/(main)/dialogue/_data/lessonData.js"));
await entry.evaluate({ timeout: 10000 });
const assets = new Map();
function add(url, owner) {
	if (typeof url !== "string" || !/^\/(stories|dialogue)\/.+\.(png|webp|mp3|wav|ogg|m4a)$/i.test(url)) return;
	if (!assets.has(url)) assets.set(url, new Set());
	assets.get(url).add(owner);
}
function taskMedia(value, owner) {
	if (typeof value === "string") add(value, owner);
	else if (Array.isArray(value)) value.forEach((item) => taskMedia(item, owner));
	else if (value && typeof value === "object") Object.values(value).forEach((item) => taskMedia(item, owner));
}
const courses = Object.values(entry.namespace.lessonData);
let lessons = 0;
for (const course of courses) {
	add(course.heroImage, course.id);
	add(course.image, course.id);
	for (const dialogue of course.dialogues) {
		lessons += 1;
		const owner = `${course.id}/${dialogue.id}`;
		add(dialogue.thumbnail, owner);
		Object.values(dialogue.characters || {}).forEach((url) => add(url, owner));
		for (const line of dialogue.dialogue || []) {
			add(line.scene || dialogue.scene, owner);
			add(line.audioUrl, owner);
		}
		taskMedia(dialogue.tasks, owner);
	}
}

const directories = new Map();
async function exactFile(url) {
	let directory = publicRoot;
	for (const part of decodeURIComponent(url).slice(1).split("/")) {
		if (!directories.has(directory)) {
			try { directories.set(directory, await readdir(directory)); }
			catch (error) { if (error.code !== "ENOENT") throw error; return { reason: "missing" }; }
		}
		const names = directories.get(directory);
		if (!names.includes(part)) {
			const actual = names.find((name) => name.toLowerCase() === part.toLowerCase());
			return actual ? { reason: "case mismatch", expected: part, actual } : { reason: "missing" };
		}
		directory = path.join(directory, part);
	}
	return null;
}
const missing = [];
for (const [url, owners] of assets) {
	const issue = await exactFile(url);
	if (issue) missing.push({ url, ...issue, owners: [...owners] });
}
console.log(JSON.stringify({ courses: courses.length, lessons, assets: assets.size, missing }, null, 2));
if (missing.length) process.exitCode = 1;
