// node client/scripts/build-dictionary-v3.mjs
// Writes ONLY dictionary-v3.json. No imports from old dictionary generators.
// pos/pron are arrays to preserve multiple forms. sourceForms keeps the exact
// original POS/pron pairs, including incorrect POS corrected by an override.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

export const dictionaryDirectory = fileURLToPath(new URL("../app/_lib/dictionary/", import.meta.url));
const files = [1, 2, 3, 4].map(number => `freq-tier1-0${number}.jsonl`);
export const validationWords = "improve leader mail meeting matter it input interested break watch version unit web feeling team making planning bring".split(" ");
const clean = text => text.normalize("NFC").replace(/\s+/gu, " ").trim().replace(/[.;]+$/u, "");
const key = text => clean(text).toLocaleLowerCase("vi");
const edited = (pos, ...texts) => texts.map(text => ({ pos, text }));

// Explicit corrections for missing everyday senses, acronym collisions, and
// misleading glosses. Applied only to headwords actually present in the JSONL.
export const overrides = {
	it: edited("pron", "nó", "điều đó"),
	web: edited("n", "web / mạng", "mạng nhện"),
	team: [...edited("n", "đội, nhóm"), ...edited("v", "lập nhóm, hợp thành đội")],
	mail: [...edited("n", "thư, thư từ"), ...edited("v", "gửi qua bưu điện", "gửi email")],
	a: edited("det", "một"), an: edited("det", "một"),
	about: edited("prep", "về", "khoảng", "xung quanh"),
	am: edited("v", "là", "ở", "đang"), be: edited("v", "là", "ở", "đang"),
	are: edited("v", "là", "ở", "đang"),
	at: edited("prep", "ở / tại", "vào lúc"),
	as: edited("conj", "như", "khi", "vì"),
	can: [...edited("v", "có thể", "được phép"), ...edited("n", "lon, hộp")],
	will: [...edited("v", "sẽ"), ...edited("n", "ý chí", "di chúc")],
	in: edited("prep", "trong", "ở", "vào (tháng / năm)"),
	on: edited("prep", "trên", "vào (ngày)", "về (chủ đề)"),
	i: edited("pron", "tôi"), me: edited("pron", "tôi"),
	he: edited("pron", "anh ấy / ông ấy"), us: edited("pron", "chúng tôi / chúng ta"),
	who: edited("pron", "ai", "người mà"),
	or: edited("conj", "hoặc"),
	no: edited("det", "không", "không có"),
};

// POS priority does not invent translations. It promotes the common use across
// source records, rather than letting alphabetical n/v record order decide.
const preferredPos = Object.fromEntries([
	..."improve bring break get make have do go come say tell ask help work run watch interested nice".split(" ").map(word => [word, ["interested", "nice"].includes(word) ? "adj" : word === "watch" ? "n" : "v"]),
	..."leader meeting matter feeling making planning version unit".split(" ").map(word => [word, "n"]),
]);
const sensePriorities = { matter: ["vấn đề", "việc", "quan trọng", "vật chất"] };
// Common Vietnamese glosses shared by many English words. This is a soft
// learner signal; it never supplies a translation absent from senses_vi.
const everydayGlosses = new Set("ở trên|bên trên|tuyệt đối|hoàn toàn|học thuật|tài khoản|đồng hồ đeo tay|lãnh đạo|địa chỉ|ngân hàng|công việc|làm việc|lời khuyên|người lớn|trường học|sách|thư|nhà|người|đẹp|tốt|nhanh|chậm|cao|thấp|đúng|sai|vui|buồn|nóng|lạnh|có thể|ở|đi|đến|là|có|làm|mua|bán|hỏi|nói|đọc|viết|nghe|xem|giúp đỡ|cải thiện|quan trọng|khó khăn|dễ dàng|vấn đề|cảm giác|đội|mạng|đơn vị|phiên bản|kế hoạch".split("|"));
// A bare calibre, numerical code or historic entrance-exam label is not a
// useful headword for this A1-B2 dictionary. Ordinary numbers remain eligible.
export const lowValueHeadword = word => /^\.\d+$/u.test(word)
	|| /^\d+\/\d+$/u.test(word)
	|| /^\d+-plus$/u.test(word);

// Match usage labels, not translations: out-of-date = lỗi thời is valid.
const unusable = /\([^)]*(?:từ cổ|cổ ngữ|ít dùng|hiếm dùng|không còn dùng|từ lóng|archaic|obsolete)[^)]*\)|^(?:từ cổ|cổ ngữ|ít dùng|hiếm dùng)\s*[:;]|cỗ \(xe súc vật kéo\)|\{\{|\}\}|https?:|�/iu;
const specialist = /\([^)]*(?:địa chất|chiêm tinh|quân sự|hàng hải|y học|giải phẫu|thực vật|động vật|vật lý|vật lí|hóa học|hoá học|toán học|lịch sử|pháp luật|kỹ thuật|kĩ thuật|đơn vị (?:đo|đong))[^)]*\)|hàng bán câu khách|ca trực \(trên tàu\)|phao hình nón|nu-clê-ô-tít|ăng-strôm|nguyên tố|đồng vị|loài euphorbia|ngữ pháp ở anh/iu;
const contextual = /\([^)]{8,}\)|trong trường hợp|tố chất|vật liệu; nguyên liệu|một loại|loài |\(viết tắt\)/iu;
const personName = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/u;
const nominalized = /^(?:sự|việc)\s/iu;

function baseWord(word, lookup, lemmaMap) {
	const candidates = [lemmaMap[word]];
	if (word.endsWith("ies")) candidates.push(`${word.slice(0, -3)}y`);
	if (word.endsWith("es")) candidates.push(word.slice(0, -2));
	if (word.endsWith("s")) candidates.push(word.slice(0, -1));
	if (word.endsWith("ing")) {
		const stem = word.slice(0, -3);
		candidates.push(stem, `${stem}e`);
		if (stem.at(-1) === stem.at(-2)) candidates.push(stem.slice(0, -1));
	}
	return candidates.find(base => base?.length >= 3 && base !== word && lookup.has(base));
}

export function senseQuality(text) {
	if (!clean(text) || unusable.test(text)) return "reject";
	if (specialist.test(text)) return "specialist";
	return "general";
}

function learnerGloss(text) {
	// A trailing usage example narrows a general translation. Strip it for
	// display only after senseQuality has checked the full source sense.
	return clean(text).replace(/\s*\([^()]*\)$/u, "").trim();
}

function learnerScore(text, pos, hasOtherPos) {
	const plain = key(text);
	const segments = plain.split(/[,;]/u).map(part => part.trim()).filter(Boolean);
	const common = segments.some(part => everydayGlosses.has(part));
	const syllables = plain.split(/\s+/u).length;
	return (common ? 25 : 0)
		+ Math.max(0, 10 - syllables * 2)
		+ (hasOtherPos && ["adj", "adv", "v"].includes(pos) ? 8 : 0);
}

export async function loadSources(directory = dictionaryDirectory) {
	const lookup = new Map();
	const report = { validRecordsLoaded: 0, malformedLines: [], skippedLines: [], blankLines: 0, files: [] };
	for (const file of files) {
		let lineNumber = 0;
		let validRecords = 0;
		const lines = readline.createInterface({ input: fs.createReadStream(path.join(directory, file), { encoding: "utf8" }), crlfDelay: Infinity });
		for await (const raw of lines) {
			lineNumber++;
			const line = (lineNumber === 1 ? raw.replace(/^\uFEFF/u, "") : raw).trim();
			if (!line) { report.blankLines++; continue; }
			let row;
			try { row = JSON.parse(line); }
			catch (error) {
				const issue = { file, line: lineNumber, reason: error.message };
				report.malformedLines.push(issue);
				report.skippedLines.push(issue);
				continue;
			}
			if (!row || typeof row.headword !== "string" || !row.headword.trim() || typeof row.pos !== "string" || !row.pos.trim()
				|| !Array.isArray(row.senses_vi) || !row.senses_vi.length || !row.senses_vi.every(text => typeof text === "string" && text.trim())
				|| (row.pron != null && typeof row.pron !== "string")) {
				report.skippedLines.push({ file, line: lineNumber, reason: "Invalid headword, pos, pron or senses_vi schema" });
				continue;
			}
			validRecords++;
			const word = row.headword.trim().normalize("NFC");
			if (!lookup.has(word)) lookup.set(word, []);
			lookup.get(word).push(row);
		}
		report.files.push({ file, validRecords });
		report.validRecordsLoaded += validRecords;
	}
	return { lookup, report };
}

function aliases(text) {
	return clean(text).split(/[,;/](?![^()]*\))/u).map(key).filter(Boolean);
}

export function selectSenses(word, records) {
	if (overrides[word]) return { selected: overrides[word], overridden: true, fallback: false, removed: 0 };
	let removed = 0;
	const candidates = [];
	const hasOtherPos = new Set(records.map(row => row.pos)).size > 1;
	for (const row of records) {
		row.senses_vi.forEach((raw, index) => {
			if (word === word.toLowerCase() && personName.test(raw.trim()) && raw.trim().toLowerCase() !== word) { removed++; return; }
			const quality = senseQuality(raw);
			if (quality === "reject") { removed++; return; }
			const text = learnerGloss(raw);
			const priority = sensePriorities[word]?.findIndex(prefix => key(text).startsWith(prefix)) ?? -1;
			const score = 100 - index * 8 + (row.pos === preferredPos[word] ? 24 : 0)
				+ (priority >= 0 ? 45 - priority * 10 : 0)
				+ learnerScore(text, row.pos, hasOtherPos)
				- (contextual.test(raw) ? (raw.trim().startsWith("(") ? 22 : 10) : 0)
				- Math.max(0, raw.length - 65) / 3;
			candidates.push({ text, pos: row.pos, quality, score });
		});
	}
	const general = candidates.filter(sense => sense.quality === "general");
	const fallback = general.length === 0 && candidates.length > 0;
	const pool = general.length ? general : candidates;
	removed += candidates.length - pool.length;
	pool.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text, "vi") || a.pos.localeCompare(b.pos));
	const selected = [];
	for (const candidate of pool) {
		const duplicate = selected.some(previous => key(previous.text) === key(candidate.text)
			|| (previous.pos === candidate.pos && aliases(previous.text).some(alias => aliases(candidate.text).includes(alias))));
		if (duplicate) continue;
		// Do not fill slots with narrow/context-dependent senses merely because
		// space remains. Retain at most one specialist sense on fallback.
		const crossPosBonus = selected.length && candidate.pos !== selected[0].pos ? 16 : 0;
		if (selected.length && (contextual.test(candidate.text) || candidate.score + crossPosBonus < selected[0].score - 35)) continue;
		selected.push(candidate);
		if (selected.length === (fallback ? 1 : 4)) break;
	}
	return { selected, overridden: false, fallback, removed };
}

export async function buildDictionary(directory = dictionaryDirectory) {
	const { lookup, report } = await loadSources(directory);
	const lemmaPath = path.join(directory, "lemma-map.json");
	const lemmaMap = fs.existsSync(lemmaPath) ? JSON.parse(fs.readFileSync(lemmaPath, "utf8")) : {};
	Object.assign(report, { uniqueSourceHeadwords: lookup.size, uniqueHeadwordsExported: 0, entriesWithMultipleMeanings: 0, overrideCount: 0, overrideWords: [], specialistFallbacks: [], inheritedLemmas: [], excludedHeadwords: [], missingPronunciations: [], correctedPos: [], sensesFiltered: 0 });
	const output = {};
	for (const [word, records] of lookup) {
		if (lowValueHeadword(word)) { report.excludedHeadwords.push(word); continue; }
		let result = selectSenses(word, records);
		const lemma = baseWord(word, lookup, lemmaMap);
		if (lemma && !result.overridden) {
			const base = selectSenses(lemma, lookup.get(lemma));
			const ownPrimary = result.selected[0]?.text ?? "";
			const basePrimary = base.selected[0]?.text ?? "";
			const baseIsEveryday = basePrimary.split(/[,;]/u).some(part => everydayGlosses.has(key(part)));
			const pluralNoun = /(?:s|es|ies)$/u.test(word) && records.some(row => row.pos === "n")
				&& lookup.get(lemma).some(row => row.pos === "n") && baseIsEveryday
				&& clean(ownPrimary).split(/\s+/u).length >= clean(basePrimary).split(/\s+/u).length + 2;
			const weakOwnSense = !ownPrimary || result.fallback
				|| (word.endsWith("ing") && nominalized.test(ownPrimary))
				|| (pluralNoun && !everydayGlosses.has(key(ownPrimary)));
			if (weakOwnSense && base.selected.length && !base.fallback) {
				const ownPos = new Set(records.map(row => row.pos));
				const verbal = word.endsWith("ing") ? base.selected.filter(sense => sense.pos === "v") : [];
				const matched = base.selected.filter(sense => ownPos.has(sense.pos));
				const inherited = verbal.length ? verbal : matched.length ? matched : base.selected;
				result = { ...result, selected: inherited.map(sense => ({ ...sense, pos: ownPos.has(sense.pos) ? sense.pos : records[0].pos })), fallback: false };
				report.inheritedLemmas.push({ word, lemma });
			}
		}
		report.sensesFiltered += result.removed;
		if (!result.selected.length) { report.excludedHeadwords.push(word); continue; }
		const sourceForms = [...new Map(records.map(row => {
			const form = { pos: row.pos, pron: row.pron ?? null };
			return [JSON.stringify(form), form];
		})).values()];
		const pron = [...new Set(sourceForms.map(form => form.pron).filter(value => typeof value === "string" && value.length))];
		const pos = [...new Set(result.selected.map(sense => sense.pos))];
		const [primary, ...alternatives] = result.selected;
		output[word] = { pos, pron, primaryMeaning: primary.text, meanings: alternatives.map(sense => sense.text), sourceForms };
		if (alternatives.length) report.entriesWithMultipleMeanings++;
		if (result.overridden) { report.overrideCount++; report.overrideWords.push(word); }
		if (result.fallback) report.specialistFallbacks.push(word);
		if (!pron.length) report.missingPronunciations.push(word);
		if (pos.some(type => !sourceForms.some(form => form.pos === type))) report.correctedPos.push(word);
	}
	report.remainingInflectedSuspicious = Object.keys(output).filter(word => baseWord(word, lookup, lemmaMap)
		&& (report.specialistFallbacks.includes(word)
			|| (word === word.toLowerCase() && personName.test(output[word].primaryMeaning)
				&& output[word].primaryMeaning.toLowerCase() !== word)));
	report.uniqueHeadwordsExported = Object.keys(output).length;
	report.missingValidationWords = validationWords.filter(word => !output[word]);
	assert.equal(report.uniqueHeadwordsExported + report.excludedHeadwords.length, lookup.size);
	for (const entry of Object.values(output)) {
		assert(entry.primaryMeaning && entry.meanings.length <= 3);
		assert.equal(new Set([entry.primaryMeaning, ...entry.meanings].map(key)).size, 1 + entry.meanings.length);
	}
	return { output, report };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const { output, report } = await buildDictionary();
	fs.writeFileSync(path.join(dictionaryDirectory, "dictionary-v3.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
	console.log(`Valid records loaded: ${report.validRecordsLoaded}`);
	console.log(`Unique headwords exported: ${report.uniqueHeadwordsExported}`);
	console.log(`Malformed lines: ${report.malformedLines.length}; total skipped lines: ${report.skippedLines.length}`);
	for (const issue of report.skippedLines) console.log(`  ${issue.file}:${issue.line}: ${issue.reason}`);
	console.log(`Entries with multiple meanings: ${report.entriesWithMultipleMeanings}`);
	console.log(`Override count: ${report.overrideCount} (${report.overrideWords.join(", ")})`);
	console.log(`Specialist-only fallbacks: ${report.specialistFallbacks.length} (${report.specialistFallbacks.join(", ")})`);
	console.log(`Meanings inherited from lemmas: ${report.inheritedLemmas.length} (${report.inheritedLemmas.map(({ word, lemma }) => `${word} → ${lemma}`).join(", ")})`);
	console.log(`Remaining suspicious inflected entries: ${report.remainingInflectedSuspicious.length} (${report.remainingInflectedSuspicious.map(word => `${word} → ${output[word].primaryMeaning}`).join(", ")})`);
	console.log(`Excluded headwords: ${report.excludedHeadwords.length} (${report.excludedHeadwords.join(", ")})`);
	console.log(`No source pronunciation: ${report.missingPronunciations.length} (${report.missingPronunciations.join(", ")})`);
	console.log(`Corrected POS (original retained in sourceForms): ${report.correctedPos.join(", ")}`);
	console.log("Validation words:");
	for (const word of validationWords) console.log(`  ${word}: ${output[word] ? JSON.stringify(output[word]) : "MISSING from source; not invented"}`);
}
