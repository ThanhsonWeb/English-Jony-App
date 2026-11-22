import test from "node:test";
import assert from "node:assert/strict";
import { a2R2Url, a2LocalFallback } from "../../../app/_lib/dialogue/a2R2Media.mjs";

test("maps only the uploaded A2 assets and reverses each for local fallback", () => {
	const base = "/dialogue/everyday-plans/making-plans-after-work/";
	const paths = ["bg.png", ...Array.from({ length: 6 }, (_, i) => `audio/ben-0${i + 1}.mp3`), ...Array.from({ length: 4 }, (_, i) => `audio/emma-0${i + 1}.mp3`)].map(value => base + value);
	paths.push("/dialogue/everyday-plans/thumbnails/making-plans-after-work.webp");
	for (const local of paths) {
		const remote = a2R2Url(local, true);
		assert.match(remote, /^https:\/\/pub-a0c593a050834420b5faa3e260029a02\.r2\.dev\/a2\/dialogue\/everyday-plans\/making-plans-after-work\//);
		assert.equal(a2LocalFallback(remote), local);
		assert.equal(a2R2Url(local, false), local);
	}
	const a1 = "/dialogue/asking-for-directions/finding-a-cafe/audio/ben-01.mp3";
	assert.equal(a2R2Url(a1, true), a1);
	assert.equal(a2LocalFallback("https://example.com/bg.png"), null);
});
