import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
const en = JSON.parse(read("messages/en.json"));
const vi = JSON.parse(read("messages/vi.json"));
function leaves(value, path = "") {
	return Object.entries(value).flatMap(([key, item]) => typeof item === "object" ? leaves(item, `${path}${key}.`) : [`${path}${key}`]);
}
test("all learner UI message keys match in VI/EN", () => {
	assert.deepEqual(leaves(en).sort(), leaves(vi).sort());
});
test("English UI messages contain no Vietnamese text except the intentional meaning example", () => {
	function check(value, path = "") {
		for (const [key, item] of Object.entries(value)) {
			const full = path + key;
			if (typeof item === "object") check(item, `${full}.`);
			else if (full !== "Notebook.meaningPlaceholder") assert.equal(/[ăâđêôơưàáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/iu.test(item), false, full);
		}
	}
	check(en);
	assert.equal(en.Notebook.meaningPlaceholder, "e.g. xin chào");
});
test("Vietnamese messages preserve the original wording of replaced UI", () => {
	assert.equal(vi.WordlistDetail.emptyTitle, "Chưa có từ nào");
	assert.equal(vi.WordlistDetail.pagination, "{count} từ · Trang {current}/{total}");
	assert.equal(vi.WordlistDetail.audioLabel, "Phát âm {word}");
	assert.equal(vi.WordlistDetail.deleteLabel, "Xóa {word}");
	assert.equal(vi.Auth.finishingGoogleLogin, "Đang hoàn tất đăng nhập...");
	assert.equal(vi.ErrorPages.rootErrorBody, "Có lỗi xảy ra. Hãy thử lại nhé! 🔄");
});
