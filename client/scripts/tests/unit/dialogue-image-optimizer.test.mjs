import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { optimizeImages } from "../../optimize-dialogue-images.mjs";

test("new lesson PNGs become lossless WebP with exact alpha and updated source URLs", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "studyjony-image-test-"));
	const courseId = "fixture-story", dialogueId = "first-day";
	const base = `/stories/${courseId}/${dialogueId}`;
	const thumbnail = `/stories/${courseId}/thumbnails/${dialogueId}.png`;
	const draftPath = `generated/stories/${courseId}/${dialogueId}/draft.json`;
	const configPath = `scripts/config/stories/${courseId}.mjs`;
	const configs = [{ courseId, contentType: "story", dialogues: [{ dialogueId, thumbnail }] }];
	const put = async (name, content) => {
		const filename = path.join(root, name);
		await mkdir(path.dirname(filename), { recursive: true });
		await writeFile(filename, content);
	};
	const pixels = Buffer.alloc(64 * 64 * 4);
	for (let index = 0; index < pixels.length; index += 4) {
		pixels[index] = (index / 4) % 256;
		pixels[index + 1] = 120;
		pixels[index + 2] = 210;
		pixels[index + 3] = (index / 4) % 255;
	}
	const png = await sharp(pixels, { raw: { width: 64, height: 64, channels: 4 } }).png({ compressionLevel: 0 }).toBuffer();
	try {
		const urls = [`${base}/bg.png`, `${base}/shared/mom.png`, thumbnail];
		for (const url of urls) await put(`public${url}`, png);
		await put(draftPath, JSON.stringify({ metadata: { scene: urls[0], thumbnail }, dialogue: [{ speaker: "Mom", scene: urls[0] }] }));
		await put(configPath, `export default ${JSON.stringify(configs[0])};\n`);
		await put("app/unrelated.json", '{"image":"/stories/other/keep.png"}\n');
		const result = await optimizeImages(["--lesson", courseId, dialogueId], { root, configs });
		assert.equal(result.converted, 3);
		assert.ok(result.savedBytes > 0);
		for (const url of urls) {
			await assert.rejects(access(path.join(root, "public", url)), { code: "ENOENT" });
			const converted = await sharp(await readFile(path.join(root, "public", url.replace(/\.png$/, ".webp")))).ensureAlpha().raw().toBuffer();
			for (let index = 0; index < pixels.length; index += 4) {
				assert.equal(converted[index + 3], pixels[index + 3], "exact alpha");
				if (pixels[index + 3]) assert.deepEqual(converted.subarray(index, index + 3), pixels.subarray(index, index + 3), "exact visible colors");
			}
		}
		assert.ok((await readFile(path.join(root, draftPath), "utf8")).includes("bg.webp"));
		assert.ok((await readFile(path.join(root, configPath), "utf8")).includes("first-day.webp"));
		assert.equal(await readFile(path.join(root, "app/unrelated.json"), "utf8"), '{"image":"/stories/other/keep.png"}\n');
		assert.equal((await optimizeImages(["--lesson", courseId, dialogueId], { root, configs })).converted, 0, "repeat build is a no-op");
		configs[0].dialogues[0].thumbnail = thumbnail.replace(/\.png$/, ".webp");
		await put(`public${thumbnail}`, png);
		assert.equal((await optimizeImages(["--lesson", courseId, dialogueId], { root, configs })).converted, 1, "new PNG replaces an already optimized thumbnail");
	} finally {
		assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
		await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
	}
});
