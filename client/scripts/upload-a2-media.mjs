import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { dialogueCourseConfigs } from "./config/index.mjs";

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bucket = "english-app-media";
const types = { ".mp3": "audio/mpeg", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };
const slug = value => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

export async function planMedia({ clientRoot = root, courseId, lessonId, configs = dialogueCourseConfigs }) {
	if (!slug(courseId) || !slug(lessonId)) throw new Error("Course and lesson IDs must be lowercase slugs.");
	const course = configs.find(item => item.courseId === courseId && item.contentType === "dialogue" && String(item.level).toLowerCase() === "a2");
	if (!course || !course.dialogues.some(item => item.dialogueId === lessonId)) throw new Error("Lesson must be registered as an A2 dialogue.");
	const publicRoot = await realpath(path.join(clientRoot, "public"));
	const courseRoot = path.join(publicRoot, "dialogue", courseId);
	for (const dir of [path.join(publicRoot, "dialogue"), courseRoot]) {
		if ((await lstat(dir)).isSymbolicLink()) throw new Error("Symbolic links are not supported in media directories.");
	}
	const result = [];
	async function visit(dir, relative = "") {
		const stat = await lstat(dir);
		if (stat.isSymbolicLink()) throw new Error("Symbolic links are not supported in media directories.");
		if (stat.isDirectory()) {
			for (const entry of (await readdir(dir)).sort()) await visit(path.join(dir, entry), path.posix.join(relative, entry));
			return;
		}
		const type = types[path.extname(dir).toLowerCase()];
		if (!stat.isFile() || !type) return;
		const resolved = await realpath(dir);
		if (!resolved.startsWith(publicRoot + path.sep)) throw new Error("Media path escapes public directory.");
		const bytes = await readFile(resolved);
		result.push({ file: resolved, key: `a2/dialogue/${courseId}/${lessonId}/${relative}`, contentType: type, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
	}
	await visit(path.join(courseRoot, lessonId));
	const thumbs = path.join(courseRoot, "thumbnails");
	try {
		if ((await lstat(thumbs)).isSymbolicLink()) throw new Error("Symbolic links are not supported in media directories.");
		for (const name of (await readdir(thumbs)).sort()) if (path.parse(name).name === lessonId && types[path.extname(name).toLowerCase()]) await visit(path.join(thumbs, name), `thumbnails/${name}`);
	} catch (error) { if (error.code !== "ENOENT") throw error; }
	if (!result.length) throw new Error("No supported media files found.");
	return result;
}

export async function uploadPlan(plan, storage, log = console.log) {
	for (const item of plan) {
		const existing = await storage.head(item.key);
		if (existing === item.sha256) { log(`SKIP ${item.key}`); continue; }
		if (existing !== null) throw new Error(`Existing object differs or has no SHA-256 metadata: ${item.key}`);
		await storage.put(item);
		log(`UPLOADED ${item.key}`);
	}
}

function awsStorage(accountId) {
	if (!/^[a-f0-9]{32}$/.test(accountId || "")) throw new Error("Set R2_ACCOUNT_ID to the 32-character account ID.");
	const common = ["--endpoint-url", `https://${accountId}.r2.cloudflarestorage.com`, "--region", "auto", "--no-cli-pager"];
	return {
		async head(key) {
			try {
				const { stdout } = await run("aws", ["s3api", "head-object", "--bucket", bucket, "--key", key, "--output", "json", ...common], { maxBuffer: 1024 * 1024, timeout: 30000 });
				return JSON.parse(stdout).Metadata?.sha256 || "";
			} catch (error) {
				if (/\(404\)|\bNoSuchKey\b|\bNot Found\b/.test(error.stderr || "")) return null;
				throw new Error(`Could not inspect R2 object ${key}. Check AWS CLI and R2 permissions.`);
			}
		},
		async put(item) {
			try {
				const currentHash = createHash("sha256").update(await readFile(item.file)).digest("hex");
				if (currentHash !== item.sha256) throw new Error("Media changed since planning.");
				await run("aws", ["s3api", "put-object", "--bucket", bucket, "--key", item.key, "--body", item.file, "--content-type", item.contentType, "--metadata", `sha256=${item.sha256}`, "--if-none-match", "*", ...common], { maxBuffer: 1024 * 1024, timeout: 120000 });
			} catch { throw new Error(`Could not upload ${item.key}; object may already exist or credentials may be invalid.`); }
		},
	};
}

async function main(args) {
	if (args.length !== 3 || !["--dry-run", "--upload"].includes(args[2])) throw new Error("Usage: node scripts/upload-a2-media.mjs <course-id> <lesson-id> <--dry-run|--upload>");
	const plan = await planMedia({ courseId: args[0], lessonId: args[1] });
	if (args[2] === "--dry-run") {
		for (const item of plan) console.log(`PLAN ${item.key} ${item.size} bytes sha256=${item.sha256}`);
		console.log(`${plan.length} files; no network requests made.`);
	} else await uploadPlan(plan, awsStorage(process.env.R2_ACCOUNT_ID));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
