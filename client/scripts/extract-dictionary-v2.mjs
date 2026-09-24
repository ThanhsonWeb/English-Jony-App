// Node.js 22.13+: node client/scripts/extract-dictionary-v2.mjs
// SQLite supplies senses/IPA; cleaned JSON supplies the allowlist and a soft POS
// hint. It is not a translation source. Only explicit overrides add edited text.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const directory = fileURLToPath(new URL("../app/_lib/dictionary/", import.meta.url));
const types = { N: "noun", V: "verb", A: "adjective", D: "adverb", E: "preposition", P: "pronoun", C: "conjunction", O: "interjection", M: "number", X: "word", n: "noun", adj: "adjective", adv: "adverb", pron: "pronoun" };
const normalizeType = value => types[value] || value || "word";
const clean = text => text.normalize("NFC").toLocaleLowerCase("vi").replace(/\s+/gu, " ").replace(/^[\s,;:.]+|[\s,;:.]+$/gu, "").trim();

// Deliberately small: these need missing modern senses or editorial shortening.
// POS stays attached to each sense, so watch can rank correctly as noun OR verb.
export const overrides = {
	unit: [{ text: "đơn vị", type: "noun" }],
	version: [{ text: "phiên bản", type: "noun" }, { text: "bản dịch", type: "noun" }],
	watch: [{ text: "đồng hồ", type: "noun" }, { text: "xem", type: "verb" }, { text: "theo dõi", type: "verb" }],
	web: [{ text: "web / mạng", type: "noun" }, { text: "mạng nhện", type: "noun" }],
	// Missing core senses or very broad function verbs cannot be resolved reliably
	// by Vietnamese wording alone. Keep these exceptions explicit and report them.
	be: [{ text: "là", type: "verb" }, { text: "ở", type: "verb" }, { text: "đang", type: "verb" }],
	have: [{ text: "có", type: "verb" }, { text: "ăn / uống", type: "verb" }],
	get: [{ text: "nhận được", type: "verb" }, { text: "lấy", type: "verb" }, { text: "trở nên", type: "verb" }],
	take: [{ text: "lấy", type: "verb" }, { text: "mang theo", type: "verb" }, { text: "đưa đi", type: "verb" }],
	say: [{ text: "nói", type: "verb" }],
	mean: [{ text: "có nghĩa là", type: "verb" }, { text: "có ý định", type: "verb" }],
	office: [{ text: "văn phòng", type: "noun" }, { text: "chức vụ", type: "noun" }],
	plus: [{ text: "cộng", type: "preposition" }],
};

// Shared Vietnamese learner vocabulary, not an English-word -> meaning map.
// Exact clause matches reward plain wording over ornate synonyms. These are
// heuristics, not corpus-derived frequency measurements.
const commonGlosses = new Set(`khả năng|có thể|được phép|là|ở|đang|có|sẽ|phải|một|mỗi|về|từ|cho|đến|với|nhưng|vì|nếu|trong|trên|dưới|tốt|giỏi|khỏe|khoẻ|đẹp|đúng|sai|gần|nhẹ|nhanh|chậm|mới|cũ|lớn|nhỏ|dài|ngắn|ấm|lạnh|nóng|vui|buồn|dễ|khó|quan trọng|thích|muốn|cần|biết|hiểu|làm|làm việc|học|đọc|viết|nói|nghe|nhìn|xem|ăn|uống|ngủ|đi|chạy|chơi|mua|bán|cho|nhận|nhận được|lấy|cầm|mang|mang lại|đem lại|đưa|gửi|giữ|đợi|chờ|mở|đóng|xây dựng|bẻ gãy|làm vỡ|gãy|vỡ|bắt đầu|kết thúc|sử dụng|dùng|trở thành|trở nên|tìm|tìm thấy|cảm thấy|giúp đỡ|chia sẻ|kiểm tra|thay đổi|chọn|lựa chọn|rời đi|ở lại|đặt|để|theo dõi|quan sát|trình bày|phát triển|cung cấp|sản xuất|bảo vệ|tiết kiệm|ngân hàng|tài khoản|tiền|tiền phạt|đồng hồ|nhà|tòa nhà|toà nhà|trường học|lớp học|bệnh viện|cửa hàng|công ty|gia đình|bạn|người|trẻ em|sách|thư|điện thoại|máy tính|máy bay|xe|cây|hoa|nước|thức ăn|ngày|ngày tháng|thời gian|giờ nghỉ|giờ giải lao|công việc|việc làm|nghề nghiệp|đội|nhóm|cảm giác|cảm xúc|tình cảm|cảm tình|ý kiến|quan điểm|quang cảnh|cảnh|tầm nhìn|cách dùng|ích lợi|lợi ích|âm thanh|ánh sáng|tiếng|đèn|hội chợ|công bằng|tử tế|loại|bộ|tập hợp|quà biếu|quà|hiện tại|có mặt|bản ghi|hồ sơ|kỷ lục|kế hoạch|danh sách|mục tiêu|mục đích|mùa hè|mùa xuân|mùa đông|mùa thu|hẹn hò|vở kịch|trò chơi|nghệ thuật|văn hoá|văn hóa|bài tập|chính phủ|sức khỏe|sức khoẻ|đơn vị|phiên bản|mạng|thông tin|tin tức|phương pháp|quyền|bên phải|phía trước|có nghĩa là|nghĩa là|nghĩa|sự nghỉ|sự dừng lại`.split("|"));
const archaic = /từ cổ|cổ ngữ|ít dùng|hiếm dùng|từ hiếm|không còn dùng|cách dùng cũ|nghĩa cổ|lỗi thời|\((?:văn chương|thơ ca)\)|từ lóng|tục tĩu|thô tục|đùa cợt|mỉa mai/iu;
const technicalLabel = /\([^)]*(?:kỹ thuật|kĩ thuật|chuyên ngành|toán|vật lý|vật lí|hoá học|hóa học|sinh học|động vật học|thực vật học|y học|giải phẫu|bệnh học|quân sự|quân lực|hàng hải|địa chất|thiên văn|điện học|cơ học|ngôn ngữ học|âm nhạc|lịch sử|pháp luật|thể dục|thể thao|bi-a|đơn vị (?:đo|áp suất|diện tích))[^)]*\)/iu;
const obsoleteGloss = /xe vực ngựa|xe ngựa không mui|cỗ \(ngựa|thắng \(ngựa|sờ mó|bắt mạch|thanh rầm|thanh ray|thủ thuật xoay thai|quả quít|vi dệt|tấm vi|tờ chúc thư|tiền chồng nhà|hèm rượu|khuôn giày|cốt giày|lãnh chúa|vải chéo|lưỡi cày|dây néo|cột buồm|cột đồng hồ mặt trời|người nô lệ|thuyền chiến|bệ kiến|yết kiến|điện tử kích hoạt gối hơi/iu;
const broken = /\|lang=|https?:|[{}<>�]|the ordinal|derived from|^see |chữ viết tắt|viết tắt của|cách dùng không được/iu;
const reference = /^(?:(?:xem|như|\(như\))\s|số nhiều|quá khứ|phân từ|hiện tại phân từ|động từ chia|động từ quá khứ|đồng từ quá khứ|cấp so sánh|dạng |ngôi |so sánh hơn|so sánh nhất)/iu;
const actionGlosses = new Set("thích|muốn|cần|làm|làm việc|chạy|chơi|sử dụng|dùng|đọc|viết|nói|nghe|xem|nhìn|mua|bán|bẻ gãy|làm vỡ|mang lại|đem lại|nhận được|cung cấp|xây dựng".split("|"));
// These very broad glosses recur in unrelated secondary senses. Without usage
// context, omit them as alternatives; they can still be a word's primary sense.
const vagueAlternatives = new Set("khả năng|loại|nước|nhóm|đúng|tốt|phải|nói|chạy".split("|"));

// Known source errors. Rejected records are named in the report, never hidden.
const suspiciousWords = new Set(["asia", "india", "who", "john", "joseph", "paul", "robert"]);
const lemmas = {
	am: "be", is: "be", are: "be", was: "be", were: "be", been: "be", being: "be",
	might: "may", goes: "go", remained: "remain", arts: "art", girls: "girl",
	done: "do", does: "do", went: "go", brought: "bring", sold: "sell",
	produced: "produce", presented: "present", kinds: "kind", an: "a", closed: "close",
	recorded: "record", comes: "come", could: "can", said: "say",
};

export function rejectionReason(row) {
	const text = clean(row.definition);
	if (!text || text.length > 220 || broken.test(text)) return "broken/reference text";
	if (reference.test(text)) return "grammatical reference";
	if (archaic.test(text) || obsoleteGloss.test(text)) return "archaic/rare/unrelated sense";
	if (technicalLabel.test(text) || ["idiom", "name", "S", "Z"].includes(row.pos)) return "specialist/historical sense";
	return null;
}

function clauses(text) {
	// Do not split commas within explanatory parentheses.
	return clean(text).split(/[,;](?![^()]*\))/u).map(clean).filter(Boolean);
}

function glossScore(text) {
	const plain = text.replace(/^sự /u, "");
	let score = commonGlosses.has(text) ? 32 : commonGlosses.has(plain) ? 22 : 0;
	const length = text.split(" ").length;
	// Two/three-syllable phrases often carry a clearer sense than generic words
	// like "đi" or "làm". Brevity alone must never decide the primary meaning.
	score += length >= 2 && length <= 3 ? 6 : Math.max(0, 4 - length);
	if (/\(|\.\.\.|\+|\//u.test(text)) score -= 9;
	if (/^(?:sự |cái |việc )/u.test(text)) score -= 8;
	if (/^(?:thuộc|dùng để|có tính chất|một loại)/u.test(text)) score -= 5;
	return score;
}

function senseCandidate(row, expectedType, support) {
	const parts = clauses(row.definition);
	// Drop only generic nominal wrappers, not content-bearing qualifications.
	const options = parts.map(text => text.replace(/^nhà (?=ngân hàng)/u, ""));
	const ranked = options.map((text, index) => ({ text, score: glossScore(text) + (index === 0 ? 5 : 0) + 9 * Math.log2(Math.min(8, support(text))) }))
		.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text, "vi"));
	const best = ranked[0];
	const type = normalizeType(row.pos);
	// Shorter plain glosses, fewer qualifications, and POS compatibility matter;
	// wd.id/database position is intentionally absent from scoring and tie breaks.
	const familiar = parts.filter(text => commonGlosses.has(text)).length;
	const score = best.score + (type === expectedType ? 16 : 0)
		+ (actionGlosses.has(best.text) ? type === "verb" ? 12 : -6 : 0)
		+ Math.min(9, familiar * 3)
		- Math.min(6, clean(row.definition).length / 40)
		- (type === "word" ? 5 : 0);
	return { text: best.text, type, score, aliases: parts, sourceKey: clean(row.definition) };
}

function canonical(text) {
	return clean(text).replace(/^sự /u, "").replace(/\([^)]*\)/gu, "").replace(/\s+/gu, " ").trim();
}

function duplicate(a, b) {
	if (canonical(a.text) === canonical(b.text)) return true;
	if (a.type !== b.type) return false;
	const keys = new Set(a.aliases.map(canonical));
	return b.aliases.some(text => keys.has(canonical(text)));
}

export function rankSenses(rows, expectedType = "word", word = "") {
	const edited = overrides[word];
	const useful = rows.filter(row => !rejectionReason(row));
	const support = text => {
		const phrase = canonical(text);
		// Count short gloss clauses, not incidental words in long explanations or
		// examples. Related wording (e.g. ánh sáng mặt trời) supports ánh sáng.
		return Math.max(1, useful.filter(row => clauses(row.definition).some(part => {
			if (part.includes("(") || part.split(" ").length > 8) return false;
			return ` ${canonical(part)} `.includes(` ${phrase} `);
		})).length);
	};
	const candidates = edited
		? edited.map((sense, index) => ({ ...sense, aliases: [sense.text], score: 100 - index + (sense.type === expectedType ? 12 : 0) }))
		: useful.map(row => senseCandidate(row, expectedType, support));
	candidates.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text, "vi") || a.type.localeCompare(b.type) || (a.sourceKey || "").localeCompare(b.sourceKey || "", "vi"));
	const selected = [];
	for (const candidate of candidates) {
		if (selected.some(sense => duplicate(sense, candidate))) continue;
		// Alternatives must be reasonably close in quality, and recognizably plain
		// vocabulary. A short obscure translation alone cannot fill an empty slot.
		if (selected.length && !edited && (candidate.score < selected[0].score - 26 || glossScore(candidate.text) < 25)) continue;
		if (selected.length && !edited && vagueAlternatives.has(candidate.text)) continue;
		if (selected.length && !edited && candidate.text.split(" ").length === 1 && support(candidate.text) < 2) continue;
		selected.push(candidate);
		if (selected.length === 4) break;
	}
	return selected;
}

export function buildDictionary() {
	const source = JSON.parse(fs.readFileSync(path.join(directory, "dictionary.cleaned.json"), "utf8"));
	const databasePath = path.join(directory, "dictionary_en_vi.db");
	assert(!fs.existsSync(`${databasePath}-wal`) || fs.statSync(`${databasePath}-wal`).size === 0,
		"Source has pending WAL data; use a settled database snapshot.");
	// Read-only SQLite can still create sidecars. Keep them in a disposable copy.
	const temp = fs.mkdtempSync(path.join(os.tmpdir(), "studyjony-dictionary-"));
	const temporaryDatabase = path.join(temp, "source.db");
	let db;
	try {
		fs.copyFileSync(databasePath, temporaryDatabase);
		db = new DatabaseSync(temporaryDatabase, { readOnly: true });
		for (const [table, required] of Object.entries({ words: ["id", "word", "lang_code"], word_definitions: ["word_id", "definition_id"], definitions: ["id", "definition", "pos", "definition_lang"], pronunciations: ["id", "word_id", "ipa"] })) {
			const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
			assert(required.every(column => columns.includes(column)), `Unexpected schema: ${table}`);
		}
		const findWord = db.prepare("SELECT id FROM words WHERE word = ? AND lang_code = 'en'");
		const findSenses = db.prepare("SELECT d.definition, d.pos FROM word_definitions wd JOIN definitions d ON d.id = wd.definition_id WHERE wd.word_id = ? AND d.definition_lang = 'vi'");
		const findIpa = db.prepare("SELECT ipa FROM pronunciations WHERE word_id = ? ORDER BY id");
		function resolve(word, visited = new Set()) {
			if (visited.has(word)) return { rows: [], lemma: word };
			visited.add(word);
			if (lemmas[word]) return resolve(lemmas[word], visited);
			const entry = findWord.get(word);
			if (!entry) return { rows: [], lemma: word };
			const rows = findSenses.all(entry.id);
			if (rows.some(row => !rejectionReason(row))) return { rows, lemma: word };
			for (const row of rows) {
				if (!reference.test(clean(row.definition))) continue;
				const target = row.definition.match(/(?:của\s+|^(?:xem|như|\(như\))\s+)([a-z]+(?:-[a-z]+)*)/iu)?.[1];
				if (target) {
					const resolved = resolve(target.toLowerCase(), new Set(visited));
					if (resolved.rows.length) return resolved;
				}
			}
			return { rows, lemma: word };
		}
		const output = {};
		const report = { totalSourceWords: Object.keys(source).length, matched: 0, missing: [], totalExported: 0, entriesWithMultipleMeanings: 0, entriesUsingOverrides: [], entriesRejectedAsSuspicious: [], rejectedSenses: 0 };
		for (const [word, hint] of Object.entries(source)) {
			const entry = findWord.get(word);
			if (!entry) { report.missing.push(word); continue; }
			report.matched++;
			if (suspiciousWords.has(word)) { report.entriesRejectedAsSuspicious.push({ word, reason: "known incorrect or unrelated source record" }); continue; }
			const { rows, lemma } = resolve(word);
			report.rejectedSenses += rows.filter(rejectionReason).length;
			const overrideKey = overrides[word] ? word : lemma;
			const senses = rankSenses(rows, normalizeType(hint.type), overrideKey);
			if (!senses.length) { report.entriesRejectedAsSuspicious.push({ word, reason: "no usable sense after filtering" }); continue; }
			if (overrides[overrideKey]) report.entriesUsingOverrides.push(word);
			const [primary, ...alternatives] = senses;
			output[word] = {
				// type describes the primary sense; other POS may appear as alternatives.
				type: ["a", "an", "the"].includes(word) ? "determiner" : primary.type,
				ipa: findIpa.all(entry.id).map(row => row.ipa).filter(Boolean).join("; "),
				primaryMeaning: primary.text,
				meanings: alternatives.map(sense => sense.text),
			};
			if (alternatives.length) report.entriesWithMultipleMeanings++;
		}
		report.totalExported = Object.keys(output).length;
		assert.equal(report.totalExported + report.entriesRejectedAsSuspicious.length, report.matched);
		for (const entry of Object.values(output)) {
			assert(entry.primaryMeaning && entry.meanings.length <= 3);
			assert.equal(new Set([entry.primaryMeaning, ...entry.meanings].map(canonical)).size, 1 + entry.meanings.length);
		}
		return { output, report };
	} finally {
		db?.close();
		for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${temporaryDatabase}${suffix}`, { force: true });
		fs.rmdirSync(temp);
	}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const { output, report } = buildDictionary();
	fs.writeFileSync(path.join(directory, "dictionary-v2.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");
	console.log(`Source words: ${report.totalSourceWords}; matched: ${report.matched}; missing: ${report.missing.length}`);
	console.log(`Total exported: ${report.totalExported}`);
	console.log(`Entries with multiple meanings: ${report.entriesWithMultipleMeanings}`);
	console.log(`Entries using overrides: ${report.entriesUsingOverrides.length} (${report.entriesUsingOverrides.join(", ")})`);
	console.log(`Manual override map: ${Object.keys(overrides).length} base words`);
	console.log(`Entries rejected as suspicious: ${report.entriesRejectedAsSuspicious.length}`);
	for (const { word, reason } of report.entriesRejectedAsSuspicious) console.log(`  ${word}: ${reason}`);
	console.log(`Individual senses filtered out: ${report.rejectedSenses}`);
}
