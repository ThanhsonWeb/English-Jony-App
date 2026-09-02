import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const OUTPUT_FORMAT = "mp3_44100_128";
const MODEL_ID = "eleven_multilingual_v2";
const PRESERVED_SPEAKERS = new Set(["Maria"]);

function fail(message) {
	throw new Error(message);
}

function parseArguments(args) {
	const flags = new Set(args.filter((argument) => argument.startsWith("--")));
	const values = args.filter((argument) => !argument.startsWith("--"));
	const unknownFlags = [...flags].filter(
		(flag) => flag !== "--force" && flag !== "--dry-run",
	);

	if (unknownFlags.length > 0) {
		fail(`Unknown option: ${unknownFlags[0]}`);
	}

	if (values.length !== 2) {
		fail(
			"Usage: npm run generate:dialogue-audio -- <lesson-id> <dialogue-id> [--dry-run] [--force]",
		);
	}

	return {
		lessonId: values[0],
		dialogueId: values[1],
		dryRun: flags.has("--dry-run") || process.env.npm_config_dry_run === "true",
		force: flags.has("--force") || process.env.npm_config_force === "true",
	};
}

async function loadLessonData() {
	const lessonDataPath = path.resolve(
		"app",
		"[locale]",
		"(main)",
		"dialogue",
		"_data",
		"lessonData.js",
	);
	const source = await readFile(lessonDataPath, "utf8");
	const sourceUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
	const lessonModule = await import(sourceUrl);

	if (!lessonModule.lessonData) {
		fail(`Lesson data export is missing in ${lessonDataPath}`);
	}

	return lessonModule.lessonData;
}

function getVoiceId(speaker) {
	const voiceIds = {
  Tom: "s3TPKV1kjDlVtZbl4Ksh",
		Anna: "uYXf8XasLslADfZ2MB4u",
	};
	const voiceId = voiceIds[speaker];

	if (!voiceId) {
		fail(`Missing voice ID for speaker "${speaker}"`);
	}

	return voiceId;
}

function buildPlan(lessonId, dialogueId, dialogue) {
	if (!Array.isArray(dialogue.dialogue) || dialogue.dialogue.length === 0) {
		fail(`Dialogue lines are missing for "${dialogueId}"`);
	}

	const appearances = new Map();

	return dialogue.dialogue.map((line, index) => {
		if (!line?.speaker) {
			fail(`Speaker is missing on dialogue line ${index + 1}`);
		}
		if (!line?.text?.trim()) {
			fail(`Text is missing on dialogue line ${index + 1}`);
		}

		const speaker = line.speaker.trim();
		if (speaker !== "Tom" && speaker !== "Anna" && !PRESERVED_SPEAKERS.has(speaker)) {
			fail(`Unsupported speaker "${speaker}" on dialogue line ${index + 1}`);
		}

		const appearance = (appearances.get(speaker) ?? 0) + 1;
		appearances.set(speaker, appearance);
		const filename = `${speaker.toLowerCase()}-${String(appearance).padStart(2, "0")}.mp3`;
		const publicUrl = `/dialogue/${lessonId}/${dialogueId}/audio/${filename}`;

		if (!line.audioUrl) {
			fail(`audioUrl is missing on dialogue line ${index + 1}`);
		}
		if (line.audioUrl !== publicUrl) {
			fail(
				`audioUrl mismatch on line ${index + 1}: expected "${publicUrl}", found "${line.audioUrl}"`,
			);
		}

		if (PRESERVED_SPEAKERS.has(speaker)) return null;

		return {
			speaker,
			text: line.text.trim(),
			voiceId: getVoiceId(speaker),
			filename,
			publicUrl,
			outputPath: path.resolve("public", "dialogue", lessonId, dialogueId, "audio", filename),
		};
	}).filter(Boolean);
}

async function fileExists(filePath) {
	try {
		return (await stat(filePath)).isFile();
	} catch (error) {
		if (error.code === "ENOENT") return false;
		throw error;
	}
}

async function generateAudio(item, apiKey) {
	const url = `${ELEVENLABS_BASE_URL}/${encodeURIComponent(item.voiceId)}?output_format=${OUTPUT_FORMAT}`;
	const response = await fetch(url, {
		method: "POST",
		headers: {
			Accept: "audio/mpeg",
			"Content-Type": "application/json",
			"xi-api-key": apiKey,
		},
		body: JSON.stringify({
			text: item.text,
			model_id: MODEL_ID,
			voice_settings: {
				speed: 0.8,
			},
		}),
	});

	if (!response.ok) {
		let detail = {};

		try {
			const errorBody = await response.json();
			if (errorBody?.detail && typeof errorBody.detail === "object") {
				detail = errorBody.detail;
			}
		} catch {
			// Some failed responses do not contain JSON.
		}

		const safeDetails = [
			detail.type && `type: ${detail.type}`,
			(detail.code || detail.status) && `code/status: ${detail.code || detail.status}`,
			detail.message && `message: ${detail.message}`,
			detail.request_id && `request_id: ${detail.request_id}`,
		].filter(Boolean);
		const detailText = safeDetails.length > 0 ? `\n${safeDetails.join("\n")}` : "";

		fail(
			`ElevenLabs request failed for ${item.filename} (HTTP ${response.status})${detailText}`,
		);
	}

	await writeFile(item.outputPath, Buffer.from(await response.arrayBuffer()));
}

async function main() {
	const options = parseArguments(process.argv.slice(2));
	const lessonData = await loadLessonData();
	const lesson = lessonData[options.lessonId];

	if (!lesson) fail(`Lesson not found: "${options.lessonId}"`);

	const dialogue = lesson.dialogues?.find((item) => item.id === options.dialogueId);
	if (!dialogue) fail(`Dialogue not found: "${options.dialogueId}"`);

	const plan = buildPlan(options.lessonId, options.dialogueId, dialogue);
	if (plan.length === 0) {
		fail(`No supported Tom or Anna dialogue lines found for "${dialogueId}"`);
	}
	const apiKey = process.env.ELEVENLABS_API_KEY;
	if (!options.dryRun && !apiKey) fail("Missing ELEVENLABS_API_KEY");

	const outputDirectory = path.dirname(plan[0].outputPath);
	if (!options.dryRun) await mkdir(outputDirectory, { recursive: true });

	let generated = 0;
	let skipped = 0;

	console.log(
		`${options.dryRun ? "Dry run" : "Generating"}: ${options.lessonId}/${options.dialogueId} (${plan.length} Tom/Anna lines)`,
	);

	for (const item of plan) {
		const exists = await fileExists(item.outputPath);
		if (exists && !options.force) {
			console.log(`SKIP     ${item.publicUrl}`);
			skipped += 1;
			continue;
		}

		if (options.dryRun) {
			console.log(`${exists && options.force ? "REPLACE" : "CREATE  "} ${item.publicUrl}`);
			continue;
		}

		console.log(`${exists ? "REPLACE" : "CREATE  "} ${item.publicUrl}`);
		await generateAudio(item, apiKey);
		generated += 1;
	}

	if (options.dryRun) {
		console.log(`Dry run complete: ${plan.length} valid audio paths.`);
	} else {
		console.log(`Complete: ${generated} generated, ${skipped} skipped.`);
	}
}

main().catch((error) => {
	console.error(`Audio generation failed: ${error.message}`);
	process.exitCode = 1;
});
