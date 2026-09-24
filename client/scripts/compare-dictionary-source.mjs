// Read-only report; run from any directory:
// node client/scripts/compare-dictionary-source.mjs
import fs from "node:fs";
import readline from "node:readline";
import { createHash } from "node:crypto";

const directory = new URL("../app/_lib/dictionary/", import.meta.url);
const files = [1, 2, 3, 4].map(number => `freq-tier1-0${number}.jsonl`);
const words = "improve leader mail meeting matter it input interested break watch version unit web feeling team making planning bring".split(" ");
const current = JSON.parse(fs.readFileSync(new URL("dictionary-v2.json", directory), "utf8"));
const lookup = new Map();
const loaded = [];
const invalid = [];

// Word-level editorial review for A1–B2 use, across ALL matched POS records.
// More senses alone do not mean better. Explain defects even when the common
// sense improves. No numeric score pretends to measure translation quality.
const reviews = {
	improve: ["better", "cải thiện / cải tiến restores the everyday sense; current lợi dụng is unsuitable."],
	leader: ["better", "lãnh đạo / người đứng đầu is much better than dây gân. Filter the secondary hàng bán câu khách sense."],
	mail: ["better", "Postal and sending meanings are better than áo giáp. The noun entry still lacks the simple thư / thư từ gloss."],
	meeting: ["better", "cuộc họp / buổi gặp mặt is more general than cuộc mít tinh."],
	matter: ["better", "vấn đề / chuyện and quan trọng are useful everyday senses; current mủ is an unsuitable primary."],
	it: ["worse", "The source treats lowercase it as the noun IT (CNTT), losing the pronoun entirely. Current ngày is also wrong; neither entry is suitable."],
	interested: ["better", "quan tâm / thích thú is the normal conversational sense; không vô tư is context-specific."],
	break: ["same", "The everyday verb sense is already good in v2. New verb alternatives are useful, but the noun geology sense needs filtering."],
	watch: ["same", "Both cover đồng hồ and xem / theo dõi. New ca trực (trên tàu) is unnecessary for a beginner entry."],
	version: ["same", "Both correctly prioritize phiên bản; their alternatives differ without a clear overall advantage."],
	unit: ["same", "Both correctly prioritize đơn vị. The new source adds organizational and machinery contexts."],
	web: ["worse", "The new noun gloss mạng is less explicit than web / mạng; the verb is spider-specific. Current data already distinguishes the web and mạng nhện."],
	feeling: ["same", "Both cover cảm giác / cảm xúc; the new alternatives do not clearly improve the current learner entry."],
	team: ["worse", "The core đội / nhóm is correct and the verb is useful, but the source reintroduces the old animal-drawn vehicle sense cỗ. Current đội is cleaner as supplied."],
	making: ["better", "sự chế tạo / sự làm ra is clearer than sự làm. Tố chất and materials senses still need context."],
	planning: ["better", "việc lập kế hoạch restores the general meaning; current sự quy hoạch thành phố is too narrow."],
	bring: ["better", "mang / đem / đưa better covers the common physical action than đem lại alone; causal alternatives are also useful."],
};

for (const file of files) {
	let lineNumber = 0;
	let records = 0;
	const lines = readline.createInterface({
		input: fs.createReadStream(new URL(file, directory), { encoding: "utf8" }),
		crlfDelay: Infinity,
	});
	for await (const raw of lines) {
		lineNumber++;
		const line = (lineNumber === 1 ? raw.replace(/^\uFEFF/u, "") : raw).trim();
		if (!line) continue;
		let row;
		try {
			row = JSON.parse(line);
			if (!row || typeof row.headword !== "string" || !Array.isArray(row.senses_vi)) {
				throw new Error("Expected headword and senses_vi array");
			}
		} catch (error) {
			invalid.push({ file, lineNumber, error: error.message, prefix: line.slice(0, 45) });
			continue;
		}
		records++;
		// Merge by exact headword. Keep every matching POS/record, never overwrite.
		if (!lookup.has(row.headword)) lookup.set(row.headword, []);
		lookup.get(row.headword).push({
			file, lineNumber,
			entry: { headword: row.headword, pos: row.pos ?? null, pron: row.pron ?? null, senses_vi: row.senses_vi },
		});
	}
	loaded.push({ file, records });
}

// Guard the reviewed inputs so rerunning on changed translations cannot silently
// reuse stale editorial verdicts. This fingerprint covers only the test words.
const inspected = words.map(word => ({ word, current: current[word] ?? null, matches: (lookup.get(word) || []).map(match => match.entry) }));
const fingerprint = createHash("sha256").update(JSON.stringify(inspected)).digest("hex");
const reviewedFingerprint = "2c25405508151c245f34ac181670ec72681e559ab5f14104f852d74b2c020ada";
const unchanged = fingerprint === reviewedFingerprint;

console.log("Comparison: combined freq-tier1-01/02/03/04.jsonl against dictionary-v2.json");
console.log("Ratings are per WORD, not per POS record; they assess learner usefulness as supplied.");
for (const { file, records } of loaded) console.log(`Loaded ${file}: ${records} records`);
for (const problem of invalid) console.log(`WARNING: skipped ${problem.file}:${problem.lineNumber}: ${problem.error}; starts ${JSON.stringify(problem.prefix)}`);

const totals = { better: 0, same: 0, worse: 0, notReviewed: 0 };
const missing = [];
for (const word of words) {
	console.log(`\nHEADWORD: ${word}`);
	console.log(`  Current dictionary-v2: ${JSON.stringify(current[word] ?? null)}`);
	const matches = lookup.get(word) || [];
	if (!matches.length) {
		missing.push(word);
		console.log("  New source: NOT FOUND; assessment: cannot compare.");
		continue;
	}
	for (const { file, lineNumber, entry } of matches) {
		console.log(`  New source (${file}:${lineNumber}): ${JSON.stringify(entry)}`);
	}
	const review = unchanged ? reviews[word] : undefined;
	const verdict = review?.[0] || "notReviewed";
	totals[verdict]++;
	console.log(`  Assessment: ${verdict} — ${review?.[1] || "Inputs differ from the reviewed snapshot; reassess quality before using this data."}`);
}
console.log("\nSUMMARY");
console.log(`Total JSONL records loaded: ${loaded.reduce((total, file) => total + file.records, 0)}`);
console.log(`Malformed/invalid records skipped: ${invalid.length}`);
console.log(`Matched test words: ${words.length - missing.length}/${words.length}`);
console.log(`Missing test words: ${missing.length} (${missing.join(", ") || "none"})`);
console.log(`Looked better than current data: ${totals.better}`);
console.log(`Word-level assessments: ${JSON.stringify(totals)}`);
if (!unchanged) console.log(`Unreviewed comparison fingerprint: ${fingerprint}`);
console.log("No dictionary files written; no regeneration performed.");
