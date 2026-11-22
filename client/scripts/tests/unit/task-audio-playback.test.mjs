import { test } from "node:test";
import assert from "node:assert/strict";
import { createTaskAudioPlayback } from "../../../app/_lib/dialogue/taskAudioPlayback.mjs";

function fixture(t) {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const audio = { currentTime: 12, playbackRate: 1, play: t.mock.fn(async () => {}), pause: t.mock.fn() };
	const blocked = t.mock.fn();
	let rate = 0.75;
	const player = createTaskAudioPlayback(audio, () => rate, blocked);
	return { audio, blocked, player, rate: value => { rate = value; } };
}

test("plays once after entry delay, using the latest speed", async t => {
	const f = fixture(t), pending = f.player.play(450);
	t.mock.timers.tick(449);
	assert.equal(f.audio.play.mock.callCount(), 0);
	f.rate(1.25); t.mock.timers.tick(1);
	assert.equal(await pending, true);
	assert.equal(f.audio.play.mock.callCount(), 1);
	assert.equal(f.audio.playbackRate, 1.25);
	t.mock.timers.tick(10000);
	assert.equal(f.audio.play.mock.callCount(), 1);
});

test("switching sentences cancels pending audio and stops/reset the old audio", async t => {
	const f = fixture(t), pending = f.player.play(450);
	f.player.dispose(); t.mock.timers.tick(500);
	assert.equal(await pending, false);
	assert.equal(await f.player.play(), false);
	assert.equal(f.audio.play.mock.callCount(), 0);
	assert.equal(f.audio.pause.mock.callCount(), 1);
	assert.equal(f.audio.currentTime, 0);
});

test("manual replay supersedes delayed automatic playback", async t => {
	const f = fixture(t), automatic = f.player.play(450);
	assert.equal(await f.player.play(), true);
	t.mock.timers.tick(500);
	assert.equal(await automatic, false);
	assert.equal(f.audio.play.mock.callCount(), 1);
});

test("pause cancels a pending play and a later play still works", async t => {
	const f = fixture(t), pending = f.player.play(450);
	f.player.pause(); t.mock.timers.tick(500);
	assert.equal(await pending, false);
	assert.equal(f.audio.play.mock.callCount(), 0);
	assert.equal(await f.player.play(), true);
});

test("autoplay denial is handled and a manual retry can play", async t => {
	const f = fixture(t);
	f.audio.play.mock.mockImplementationOnce(async () => { throw new DOMException("Blocked", "NotAllowedError"); });
	assert.equal(await f.player.play(), false);
	assert.equal(f.blocked.mock.callCount(), 1);
	assert.equal(await f.player.play(), true);
});

test("late rejection from an old play cannot change the new player's state", async t => {
	const f = fixture(t);
	let reject;
	f.audio.play.mock.mockImplementationOnce(() => new Promise((_, no) => { reject = no; }));
	const previous = f.player.play();
	assert.equal(await f.player.play(), true);
	reject(new DOMException("Stopped", "AbortError"));
	assert.equal(await previous, false);
	assert.equal(f.blocked.mock.callCount(), 0);
	f.player.dispose();
	assert.equal(f.audio.pause.mock.callCount(), 1);
});

test("a pre-hydration media error switches to the local source before play", async t => {
	const audio = { src: "https://r2.example/clip.mp3", error: { code: 4 }, play: t.mock.fn(async () => {}), pause() {} };
	const player = createTaskAudioPlayback(audio, () => 1, () => {}, src => src.startsWith("https:") ? "/local.mp3" : null);
	player.handleError();
	assert.equal(audio.src, "/local.mp3");
	assert.equal(await player.play(), true);
	assert.equal(audio.play.mock.callCount(), 1);
});

test("an R2 failure during play retries local audio once", async t => {
	let reject;
	const audio = { src: "https://r2.example/clip.mp3", play: t.mock.fn(() => new Promise((_, no) => { reject = no; })), pause() {} };
	const player = createTaskAudioPlayback(audio, () => 1, () => {}, src => src.startsWith("https:") ? "/local.mp3" : null);
	const pending = player.play();
	player.handleError();
	audio.play.mock.mockImplementation(async () => {});
	reject(new DOMException("Source changed", "AbortError"));
	assert.equal(await pending, true);
	assert.equal(audio.src, "/local.mp3");
	assert.equal(audio.play.mock.callCount(), 2);
});

test("autoplay denial does not switch an R2 source", async t => {
	const audio = { src: "https://r2.example/clip.mp3", play: t.mock.fn(async () => { throw new DOMException("Blocked", "NotAllowedError"); }), pause() {} };
	const player = createTaskAudioPlayback(audio, () => 1, () => {}, () => "/local.mp3");
	assert.equal(await player.play(), false);
	assert.equal(audio.src, "https://r2.example/clip.mp3");
});

test("a later media failure resumes on local audio", async t => {
	const audio = { src: "https://r2.example/clip.mp3", play: t.mock.fn(async () => {}), pause() {} };
	const player = createTaskAudioPlayback(audio, () => 1, () => {}, src => src.startsWith("https:") ? "/local.mp3" : null);
	assert.equal(await player.play(), true);
	player.handleError();
	await Promise.resolve();
	assert.equal(audio.src, "/local.mp3");
	assert.equal(audio.play.mock.callCount(), 2);
});
