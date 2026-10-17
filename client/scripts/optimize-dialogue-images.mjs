import { execFileSync } from "node:child_process";
import { readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { courseConfigs } from "./config/index.mjs";
import { getGeneratedDialogueDraftPath } from "./lib/dialogue-content-paths.mjs";

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoots = ["app", "scripts/config", "generated"];
const textExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".txt"]);

async function filesIn(directory, accept) {
	let entries;
	try { entries = await readdir(directory, { withFileTypes: true }); }
	catch (error) { if (error.code === "ENOENT") return []; throw error; }
	const files = [];
	for (const entry of entries) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...await filesIn(fullPath, accept));
		else if (entry.isFile() && accept(fullPath)) files.push(fullPath);
	}
	return files;
}

async function candidateFiles(args, root, configs) {
	const publicRoot = path.join(root, "public");
	if (args[0] === "--all") {
		const tracked = execFileSync("git", ["ls-files", "--cached", "--", "public/stories", "public/dialogue"], {
			cwd: root, encoding: "utf8",
		}).split(/\r?\n/).filter((name) => name.toLowerCase().endsWith(".png"))
			.map((name) => path.join(root, name));
		const present = await Promise.all(tracked.map(async (name) => {
			try { return (await stat(name)).isFile() ? name : null; }
			catch (error) { if (error.code === "ENOENT") return null; throw error; }
		}));
		return present.filter(Boolean);
	}
	if (args[0] !== "--lesson" || !args[1] || !args[2]) {
		throw new Error("Usage: node scripts/optimize-dialogue-images.mjs --all | --lesson <courseId> <dialogueId>");
	}
	const [, courseId, dialogueId] = args;
	const course = configs.find((item) => item.courseId === courseId);
	const lesson = course?.dialogues.find((item) => item.dialogueId === dialogueId);
	if (!course || !lesson) throw new Error(`Unknown lesson: ${courseId}/${dialogueId}`);
	const directory = path.join(publicRoot, course.contentType === "story" ? "stories" : "dialogue", courseId, dialogueId);
	const images = await filesIn(directory, (name) => name.toLowerCase().endsWith(".png"));
	if (/\.(png|webp)$/i.test(lesson.thumbnail || "")) {
		const thumbnailUrl = lesson.thumbnail.replace(/\.webp$/i, ".png");
		const thumbnail = path.join(publicRoot, ...thumbnailUrl.replace(/^\/+/, "").split("/"));
		try { if ((await stat(thumbnail)).isFile()) images.push(thumbnail); }
		catch (error) { if (error.code !== "ENOENT") throw error; }
	}
	return images;
}

function publicUrl(filePath, root) {
	const publicRoot = path.join(root, "public");
	const relative = path.relative(publicRoot, filePath);
	if (relative.startsWith("..") || path.isAbsolute(relative)) {
		throw new Error(`Image is outside public directory: ${filePath}`);
	}
	return `/${relative.split(path.sep).join("/")}`;
}

async function hasSameVisiblePixels(pngPath, webpBuffer) {
	const [original, converted] = await Promise.all([
		sharp(pngPath).ensureAlpha().raw().toBuffer(),
		sharp(webpBuffer).ensureAlpha().raw().toBuffer(),
	]);
	if (original.length !== converted.length) return false;
	for (let index = 0; index < original.length; index += 4) {
		if (original[index + 3] !== converted[index + 3]) return false;
		if (original[index + 3] === 0) continue;
		for (let color = 0; color < 3; color += 1) {
			if (original[index + color] !== converted[index + color]) return false;
		}
	}
	return true;
}

async function sourceFiles(root) {
	const groups = await Promise.all(sourceRoots.map((directory) =>
		filesIn(path.join(root, directory), (name) => textExtensions.has(path.extname(name)))));
	return groups.flat();
}

export async function optimizeImages(args, { root = clientRoot, configs = courseConfigs } = {}) {
	const lessonMode = args[0] === "--lesson";
	const candidates = await candidateFiles(args, root, configs);
	const sources = new Map();
	for (const file of await sourceFiles(root)) sources.set(file, await readFile(file, "utf8"));
	const expectedCharacters = new Set();
	if (lessonMode) {
		const [, courseId, dialogueId] = args;
		const course = configs.find((item) => item.courseId === courseId);
		const draftPath = getGeneratedDialogueDraftPath(root, course.contentType, courseId, dialogueId);
		const draft = JSON.parse(await readFile(draftPath, "utf8"));
		for (const line of draft.dialogue) {
			expectedCharacters.add(`/${course.contentType === "story" ? "stories" : "dialogue"}/${courseId}/${dialogueId}/shared/${line.speaker.toLowerCase()}.png`);
		}
	}
	const replacements = new Map();
	const convertedFiles = [];
	let originalBytes = 0;
	let webpBytes = 0;
	let skippedNoReference = 0;
	let skippedLarger = 0;
	for (const pngPath of candidates) {
		const oldUrl = publicUrl(pngPath, root);
		const webpUrl = oldUrl.replace(/\.png$/i, ".webp");
		const referenced = [...sources.values()].some((source) =>
			source.includes(oldUrl) || (lessonMode && source.includes(webpUrl)));
		if (!referenced && !expectedCharacters.has(oldUrl)) {
			skippedNoReference += 1;
			continue;
		}
		const pngBytes = (await stat(pngPath)).size;
		const webp = await sharp(pngPath).webp({ lossless: true, effort: 4 }).toBuffer();
		if (webp.length >= pngBytes) { skippedLarger += 1; continue; }
		if (!(await hasSameVisiblePixels(pngPath, webp))) {
			throw new Error(`WebP changed visible pixels or transparency: ${oldUrl}`);
		}
		const webpPath = pngPath.replace(/\.png$/i, ".webp");
		await writeFile(webpPath, webp);
		replacements.set(oldUrl, publicUrl(webpPath, root));
		convertedFiles.push(pngPath);
		originalBytes += pngBytes;
		webpBytes += webp.length;
	}
	for (const [file, source] of sources) {
		let updated = source;
		for (const [before, after] of replacements) updated = updated.replaceAll(before, after);
		if (updated !== source) await writeFile(file, updated, "utf8");
	}
	for (const pngPath of convertedFiles) await unlink(pngPath);
	return {
		converted: convertedFiles.length,
		originalBytes, webpBytes, savedBytes: originalBytes - webpBytes,
		skippedNoReference, skippedLarger,
		replacements: Object.fromEntries(replacements),
	};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	optimizeImages(process.argv.slice(2)).then((result) => {
		const { replacements, ...summary } = result;
		console.log(JSON.stringify(summary));
	}).catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
