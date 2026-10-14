// A deterministic source bundle. No dependency archive, tar extraction, or secrets.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const SHA = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;
const MAX_BYTES = 128 * 1024 * 1024;
const sources = ["server", "client/app/[locale]/(main)/dialogue/_data", "client/app/_lib/dialogue/localization.js", "client/scripts/config"];
const hash = value => crypto.createHash("sha256").update(value).digest("hex");

function sourcePath(value) {
	if (typeof value !== "string" || value.includes("\\") || /[\x00-\x1f\x7f]/.test(value) ||
		value.split("/").some(part => !part || part === "." || part === "..")) return false;
	if (!sources.some(source => value === source || value.startsWith(source + "/"))) return false;
	return !value.split("/").some(part => part === "node_modules" || part === ".git" ||
		part === "local-avatars" || /^\.env(?:\.|$)/.test(part) || /\.(?:pem|key|p12|pfx)$/i.test(part));
}

function validateBundle(bundle, expectedSha) {
	if (!SHA.test(expectedSha) || bundle?.version !== 1 || bundle.commit !== expectedSha ||
		!Array.isArray(bundle.files) || !bundle.files.length || bundle.files.length > 10000) throw new Error("Invalid release identity");
	const seen = new Set();
	for (const file of bundle.files) {
		if (!sourcePath(file.path) || seen.has(file.path) || !["100644", "100755"].includes(file.mode) ||
			!HASH.test(file.sha256) || typeof file.content !== "string") throw new Error("Unsafe release file");
		const bytes = Buffer.from(file.content, "base64");
		if (bytes.toString("base64") !== file.content || hash(bytes) !== file.sha256) throw new Error("Release file integrity failed");
		seen.add(file.path);
	}
	for (const required of ["server/server.js", "server/app.js", "server/package.json", "server/package-lock.json", "server/scripts/check-deployment.js"]) {
		if (!seen.has(required)) throw new Error("Incomplete backend release");
	}
	for (const filename of seen) {
		const parts = filename.split("/");
		while (parts.pop() && parts.length) if (seen.has(parts.join("/"))) throw new Error("Conflicting release paths");
	}
	return bundle;
}

function build(commit, output, cwd = path.resolve(__dirname, "../..")) {
	if (!SHA.test(commit)) throw new Error("Use a full commit SHA");
	const git = args => execFileSync("git", args, { cwd, maxBuffer: MAX_BYTES });
	const rows = git(["--literal-pathspecs", "ls-tree", "-r", "-z", commit, "--", ...sources]).toString("utf8").split("\0").filter(Boolean);
	const entries = rows.map(row => {
		const separator = row.indexOf("\t");
		const header = row.slice(0, separator), filename = row.slice(separator + 1);
		const [mode, type, oid] = header.split(" ");
		if (filename.split("/").includes("node_modules")) return null;
		if (type !== "blob" || !sourcePath(filename) || !["100644", "100755"].includes(mode)) throw new Error("Unsupported source file");
		return { path: filename, mode, oid };
	}).filter(Boolean);
	const blobs = execFileSync("git", ["cat-file", "--batch"], {
		cwd, input: entries.map(file => file.oid).join("\n") + "\n", maxBuffer: MAX_BYTES,
	});
	let offset = 0;
	const files = entries.map(file => {
		const newline = blobs.indexOf(10, offset);
		const [, type, length] = blobs.subarray(offset, newline).toString("ascii").split(" ");
		if (type !== "blob" || !/^\d+$/.test(length)) throw new Error("Invalid Git object");
		const bytes = blobs.subarray(newline + 1, newline + 1 + Number(length));
		offset = newline + 2 + Number(length);
		return { path: file.path, mode: file.mode, sha256: hash(bytes), content: bytes.toString("base64") };
	});
	const bytes = Buffer.from(JSON.stringify(validateBundle({ version: 1, commit, files }, commit)) + "\n");
	if (bytes.length > MAX_BYTES) throw new Error("Release exceeds size limit");
	fs.mkdirSync(path.dirname(output), { recursive: true });
	fs.writeFileSync(output, bytes, { mode: 0o600 });
	fs.writeFileSync(output + ".sha256", hash(bytes) + "\n", { mode: 0o600 });
	return hash(bytes);
}

function extract(input, expectedHash, expectedSha, destination) {
	if (!HASH.test(expectedHash) || fs.statSync(input).size > MAX_BYTES) throw new Error("Invalid artifact checksum/size");
	const bytes = fs.readFileSync(input);
	if (hash(bytes) !== expectedHash) throw new Error("Artifact checksum mismatch");
	const bundle = validateBundle(JSON.parse(bytes), expectedSha);
	if (fs.lstatSync(destination).isSymbolicLink() || fs.readdirSync(destination).length) throw new Error("Release directory must be empty");
	for (const file of bundle.files) {
		const target = path.join(destination, ...file.path.split("/"));
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, Buffer.from(file.content, "base64"), { flag: "wx", mode: file.mode === "100755" ? 0o755 : 0o644 });
	}
	fs.writeFileSync(path.join(destination, ".release.json"), JSON.stringify({ version: 1, commit: expectedSha, artifactHash: expectedHash,
		files: bundle.files.map(file => ({ path: file.path, sha256: file.sha256 })) }) + "\n", { flag: "wx", mode: 0o600 });
}

if (require.main === module) {
	try {
		const [mode, ...args] = process.argv.slice(2);
		if (mode === "build" && args.length === 2) console.log(build(...args));
		else if (mode === "extract" && args.length === 4) extract(...args);
		else throw new Error("Usage: release-artifact.js build SHA OUTPUT | extract INPUT HASH SHA DESTINATION");
	} catch { console.error("Release artifact validation failed; no deployment was attempted."); process.exitCode = 1; }
}
module.exports = { sourcePath, validateBundle, build, extract, hash };
