// Mobile-first Fill in the Blank layout, reachability, theme, and keyboard regression checks.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const route = "/dialogue/ten-minutes-a-day/the-old-book/1";

async function openExercise(browser, locale, width, theme) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    isMobile: width < 768,
    hasTouch: width < 768,
  });
  await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
  await context.addInitScript((selectedTheme) => {
    localStorage.setItem("studyjony-theme", selectedTheme);
    HTMLMediaElement.prototype.play = function play() {
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function pause() { this.dispatchEvent(new Event("pause")); };
  }, theme);
  await context.route("**/*", (request) => new URL(request.request().url()).origin === new URL(baseURL).origin
    ? request.continue()
    : request.fulfill({ body: "" }));
  await context.route("**/api/v1/**", (request) => {
    const path = new URL(request.request().url()).pathname;
    if (path.endsWith("/users/me")) return request.fulfill({ status: 401, json: { status: "fail" } });
    return request.fulfill({ json: { status: "success", data: { progress: [], vocabularies: [], topics: [], activities: [] } } });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const prefix = locale === "en" ? "/en" : "";
  await page.goto(`${baseURL}${prefix}${route}`, { waitUntil: "domcontentloaded" });
  await page.locator('input[placeholder="..."]').first().waitFor({ state: "visible" });
  await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, theme);
  return { context, page, errors, prefix, t: require(`../../../messages/${locale}.json`).DialogueFeature };
}

async function measure(page, checkText) {
  return page.evaluate((expectedCheck) => {
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return { top: Math.round(rect.top + scrollY), bottom: Math.round(rect.bottom + scrollY), height: Math.round(rect.height) };
    };
    const scene = document.querySelector("div[class*='aspect-']");
    const input = document.querySelector('input[placeholder="..."]');
    const check = [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === expectedCheck);
    return {
      scene: box(scene), sceneClass: scene.className,
      input: box(input), check: box(check), documentHeight: document.documentElement.scrollHeight,
      viewportHeight: innerHeight,
    };
  }, checkText);
}

async function layoutCase(browser, locale, width, theme) {
  const fixture = await openExercise(browser, locale, width, theme);
  try {
    const { page, t, errors } = fixture;
    const check = page.getByRole("button", { name: t.check, exact: true });
    const input = page.locator('input[placeholder="..."]').first();
    await check.waitFor({ state: "visible" });
    const dimensions = await measure(page, t.check);
    assert.ok(dimensions.scene.height > 0 && dimensions.input.height > 0 && dimensions.check.height > 0);
    assert.ok(await page.locator("audio[src]").count(), "audio remains available");
    const subtitleToggle = page.getByRole("button", { name: t.toggleSubtitles, exact: true });
    await subtitleToggle.click();
    assert.equal(await subtitleToggle.getAttribute("aria-pressed"), "true", "subtitle control remains available");
    assert.ok(await page.getByRole("button", { name: t.translateSentence, exact: true }).count(), "translation control remains available");

    if (width === 390) {
      assert.match(dimensions.sceneClass, /aspect-video/, `${locale}/${theme}: mobile scene uses compact 16:9 framing`);
      assert.ok(dimensions.check.bottom <= 844, `${locale}/${theme}: Check is reachable in the initial viewport (bottom ${dimensions.check.bottom}px)`);
      const checkBox = await check.boundingBox();
      const fixedCover = await page.evaluate(({ x, y }) => [...document.querySelectorAll("body *")].some((element) => {
        if (element.tagName === "BUTTON" || element.contains(document.querySelector("button"))) return false;
        const style = getComputedStyle(element);
        if (style.position !== "fixed") return false;
        const rect = element.getBoundingClientRect();
        return rect.left < x + 20 && rect.right > x && rect.top < y + 20 && rect.bottom > y;
      }), { x: checkBox.x + checkBox.width / 2, y: checkBox.y + checkBox.height / 2 });
      assert.equal(fixedCover, false, `${locale}/${theme}: fixed navigation does not cover Check`);
      const screenshot = `${process.env.TEMP}\\studyjony-step2-after-${locale}-${theme}-390.png`;
      await page.screenshot({ path: screenshot, fullPage: true });
      console.log(`MEASURE ${locale} ${theme} 390px: scene ${dimensions.scene.height}px; input y=${dimensions.input.top}px; Check y=${dimensions.check.top}-${dimensions.check.bottom}px; page ${dimensions.documentHeight}px; screenshot ${screenshot}`);
    } else {
      assert.match(dimensions.sceneClass, /sm:aspect-\[4\/3\]/, `${locale}/${theme}: desktop scene remains 4:3`);
      assert.equal(dimensions.scene.height, Math.round((dimensions.scene.height ? (await page.locator("div[class*='aspect-']").evaluate((element) => element.getBoundingClientRect().width)) * 0.75 : 0)), "desktop scene remains 4:3");
    }
    await input.click();
    await input.fill("book");
    assert.equal(await input.inputValue(), "book");
    assert.deepEqual(errors, []);
    console.log(`PASS layout ${locale} ${width}px ${theme}`);
    return dimensions;
  } finally {
    await fixture.context.close();
  }
}

async function keyboardCase(browser, locale, width) {
  const fixture = await openExercise(browser, locale, width, "dark");
  try {
    const { page, t, errors, prefix } = fixture;
    const input = page.locator('input[placeholder="..."]').first();
    await input.fill("book");
    await input.press("Enter");
    await page.getByRole("button", { name: t.guestLater, exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: t.guestLater, exact: true }).click();
    await page.waitForURL((url) => url.pathname === `${prefix}/dialogue/ten-minutes-a-day/the-old-book/2`);
    assert.deepEqual(errors, []);
    console.log(`PASS keyboard Enter submits the answer and preserves progression (${locale}, ${width}px)`);
  } finally {
    await fixture.context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    for (const locale of ["vi", "en"]) {
      for (const width of [390, 1280]) {
        for (const theme of ["light", "dark"]) await layoutCase(browser, locale, width, theme);
      }
      for (const width of [390, 1280]) await keyboardCase(browser, locale, width);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
