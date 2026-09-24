import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import { buildDictionary, overrides, rankSenses, rejectionReason } from "./extract-dictionary-v2.mjs";

const directory = new URL("../app/_lib/dictionary/", import.meta.url);
const snapshot = () => Object.fromEntries(fs.readdirSync(directory).map(name => [name,
	createHash("sha256").update(fs.readFileSync(new URL(name, directory))).digest("hex"),
]));
const before = snapshot();
const { output, report } = buildDictionary();

// Semantic expectations, not snapshots of DB order. Check common senses and
// known failure cases against the actual DB, including non-override words.
const expected = {
	watch: /^đồng hồ$/, break: /^(?:sự nghỉ|giờ nghỉ|bẻ gãy|vỡ)$/,
	can: /^có thể$/, well: /^tốt$/, use: /^(?:dùng|sử dụng|cách dùng)$/,
	view: /^(?:nhìn|quan điểm|quang cảnh)$/, version: /^phiên bản$/,
	unit: /^đơn vị$/, web: /^web \/ mạng$/, bring: /^(?:mang lại|đem lại)$/,
	building: /^tòa nhà$/, team: /^đội$/, feeling: /^cảm giác$/,
	bank: /^ngân hàng$/, light: /^ánh sáng$/, close: /^(?:gần|đóng)$/,
	like: /^thích$/, work: /^(?:làm|làm việc|công việc|việc làm)$/,
	play: /^(?:chơi|vở kịch)$/, run: /^chạy$/, set: /^(?:bộ|tập hợp|đặt)$/,
	get: /^nhận được$/, make: /^làm$/, take: /^lấy$/, book: /^sách$/,
	date: /^ngày tháng$/, sound: /^(?:âm thanh|tiếng)$/,
	fair: /^(?:hội chợ|công bằng)$/, fine: /^(?:tốt|đẹp)$/,
	mean: /^có nghĩa là$/, kind: /^(?:loại|tử tế)$/, present: /^(?:hiện tại|có mặt)$/,
	are: /^là$/, have: /^có$/, go: /^đi$/, say: /^nói$/, read: /^đọc$/,
	write: /^viết$/, house: /^nhà$/, food: /^thức ăn$/, school: /^trường học$/,
	water: /^nước$/, music: /^âm nhạc$/, good: /^tốt$/, bad: /^xấu$/,
	help: /^giúp đỡ$/, office: /^văn phòng$/,
};
for (const [word, meaning] of Object.entries(expected)) {
	test(`common meaning: ${word}`, () => {
		assert(output[word], `Missing ${word}`);
		assert.match(output[word].primaryMeaning, meaning);
	});
}

test("all entries obey the allowlist, schema and alternative contract", () => {
	const keep = JSON.parse(fs.readFileSync(new URL("dictionary.cleaned.json", directory), "utf8"));
	for (const [word, entry] of Object.entries(output)) {
		assert(Object.hasOwn(keep, word));
		assert.deepEqual(Object.keys(entry), ["type", "ipa", "primaryMeaning", "meanings"]);
		assert.equal(typeof entry.ipa, "string");
		assert.equal(typeof entry.type, "string");
		assert(entry.type && entry.primaryMeaning);
		assert(entry.meanings.length <= 3);
		const all = [entry.primaryMeaning, ...entry.meanings];
		assert(all.every(text => typeof text === "string" && text.trim()));
		assert.equal(new Set(all.map(text => text.toLowerCase().trim())).size, all.length, word);
	}
});

test("report counters match the exported data and exclusions", () => {
	assert.equal(report.totalExported, Object.keys(output).length);
	assert.equal(report.entriesWithMultipleMeanings, Object.values(output).filter(entry => entry.meanings.length > 0).length);
	assert.equal(report.matched + report.missing.length, report.totalSourceWords);
	assert.equal(report.totalExported + report.entriesRejectedAsSuspicious.length, report.matched);
	assert.equal(report.entriesUsingOverrides.length, new Set(report.entriesUsingOverrides).size);
	assert(report.entriesUsingOverrides.every(word => output[word]));
	assert(Object.keys(overrides).length <= 12);
	assert(report.entriesRejectedAsSuspicious.some(entry => entry.word === "who"));
});

test("source files stay unchanged and the generated JSON is reproducible", () => {
	assert.deepEqual(snapshot(), before);
	assert.deepEqual(JSON.parse(fs.readFileSync(new URL("dictionary-v2.json", directory), "utf8")), output);
});

test("ranking is independent of row order and rejects an archaic first sense", () => {
	const rows = [
		{ definition: "(từ cổ) Xe ngựa không mui.", pos: "N" },
		{ definition: "Chỗ vỡ, chỗ nứt, chỗ rạn.", pos: "N" },
		{ definition: "Bẻ gãy, làm vỡ.", pos: "V" },
	];
	assert.deepEqual(rankSenses(rows, "verb"), rankSenses([...rows].reverse(), "verb"));
	assert.equal(rankSenses(rows, "verb")[0].type, "verb");
	assert.match(rankSenses(rows, "verb")[0].text, /bẻ gãy|làm vỡ/);
});

test("POS influences otherwise comparable senses", () => {
	const rows = [{ definition: "Công việc.", pos: "N" }, { definition: "Làm việc.", pos: "V" }];
	assert.equal(rankSenses(rows, "noun")[0].type, "noun");
	assert.equal(rankSenses(rows, "verb")[0].type, "verb");
});

test("watch override supports both POS and distinct alternatives", () => {
	assert.equal(rankSenses([], "noun", "watch")[0].text, "đồng hồ");
	assert.equal(rankSenses([], "verb", "watch")[0].text, "xem");
	assert(output.watch.meanings.includes("xem"));
	assert(output.view.meanings.includes("quan điểm"));
	assert(output.light.meanings.includes("nhẹ"));
});

test("rare, historical, technical and broken entries cannot win on brevity", () => {
	for (const definition of ["(ít dùng) a", "(lịch sử) quan", "(y học) mô", "(từ cổ) xe", "Thủ thuật xoay thai.", "{{bad}}"])
		assert(rejectionReason({ definition, pos: "N" }), definition);
	assert.equal(rejectionReason({ definition: "Âm nhạc.", pos: "N" }), null);
	assert.equal(rejectionReason({ definition: "Nhưng ngược lại, trong khi.", pos: "C" }), null);
});

test("synonyms, case and punctuation do not duplicate primaryMeaning", () => {
	const result = rankSenses([
		{ definition: "Dùng, sử dụng.", pos: "V" },
		{ definition: "SỬ DỤNG; dùng", pos: "V" },
		{ definition: "Ích lợi.", pos: "N" },
	], "verb");
	assert.equal(result.filter(sense => /dùng|sử dụng/.test(sense.text)).length, 1);
});
