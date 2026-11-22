import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../../../app/_hooks/useDialogueAutoAdvance.js", import.meta.url), "utf8")
	.replace(/^import .*;\r?\n/gm, "")
	.replace("export default function", "function") + "\nthis.hook = useDialogueAutoAdvance;";

function harness({ manual = false, progress = null, save = async () => true } = {}) {
	let slots = [], cursor = 0, pending = [], timers = [], modal = false, routes = [];
	const env = {
		useRef(value) { const i = cursor++; return slots[i] ||= { current: value }; },
		useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], (next) => { slots[i] = next; }]; },
		useEffect(fn, deps) {
			const i = cursor++; const previous = slots[i];
			if (!previous || deps.some((value, n) => !Object.is(value, previous.deps[n]))) {
				pending.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
			}
		},
		useRouter: () => ({ push: (href) => routes.push(href) }),
		useDialogueProgress: () => progress,
		setTimeout: (fn) => { timers.push(fn); return fn; },
		clearTimeout: (fn) => { timers = timers.filter((timer) => timer !== fn); },
		document: { body: {}, querySelector: () => modal ? {} : null },
		MutationObserver: class { observe() {} disconnect() {} },
		Promise,
	};
	vm.runInNewContext(source, env);
	function render() { cursor = 0; const value = env.hook({ manual, onComplete: save, href: "/next" }); const effects = pending; pending = []; effects.forEach((effect) => effect()); return value; }
	return { render, routes, setProgress: (value) => { progress = value; }, setModal: (value) => { modal = value; }, tick: () => { const current = timers; timers = []; current.forEach((fn) => fn()); } };
}

test("manual mode saves once and requires an explicit Continue", async () => {
	let saves = 0;
	const h = harness({ manual: true, save: async () => { saves++; return true; } });
	h.render().complete({ answers: ["yes"] });
	h.render(); await new Promise(setImmediate);
	let hook = h.render(); h.tick(); hook = h.render();
	assert.equal(saves, 1); assert.equal(h.routes.length, 0); assert.equal(hook.canContinue, true);
	assert.equal(hook.continue(), true); assert.equal(hook.continue(), false);
	assert.deepEqual(h.routes, ["/next"]);
});

test("manual Continue blocks pending saves, failed saves, reminders and modals", async () => {
	let resolveSave;
	const h = harness({ manual: true, progress: { loading: false, canNavigate: false, status: "saving" }, save: () => new Promise((resolve) => { resolveSave = resolve; }) });
	h.render().complete({ answers: ["yes"] }); h.render(); await new Promise(setImmediate);
	assert.equal(h.render().continue(), false);
	resolveSave(false); await new Promise(setImmediate);
	h.setProgress({ loading: false, canNavigate: false, status: "error" });
	assert.equal(h.render().continue(), false);
	h.setProgress({ loading: false, canNavigate: true, status: "saved", autoAdvancePaused: true });
	assert.equal(h.render().continue(), false);
	h.setProgress({ loading: false, canNavigate: true, status: "saved" }); h.setModal(true);
	assert.equal(h.render().continue(), false);
	h.setModal(false); assert.equal(h.render().continue(), true);
	assert.deepEqual(h.routes, ["/next"]);
});

test("default mode retains the timed automatic advance", async () => {
	const h = harness(); h.render().complete({ answers: ["yes"] }); h.render();
	await new Promise(setImmediate); h.render(); assert.equal(h.routes.length, 0);
	h.tick(); h.render(); assert.deepEqual(h.routes, ["/next"]);
});
