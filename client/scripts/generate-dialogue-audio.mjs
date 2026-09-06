import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const OUTPUT_FORMAT = "mp3_44100_128";
const MODEL_ID = "eleven_multilingual_v2";

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

	if (values.length !== 1 && values.length !== 2) {
		fail(
			"Usage: node scripts/generate-dialogue-audio.mjs <draft.json> [--dry-run] [--force]\n   or: npm run generate:dialogue-audio -- <lesson-id> <dialogue-id> [--dry-run] [--force]",
		);
	}

	return {
		jsonPath: values.length === 1 ? values[0] : null,
		lessonId: values.length === 2 ? values[0] : null,
		dialogueId: values.length === 2 ? values[1] : null,
		dryRun: flags.has("--dry-run") || process.env.npm_config_dry_run === "true",
		force: flags.has("--force") || process.env.npm_config_force === "true",
	};
}

async function loadDraft(jsonPath) {
	let data;

	try {
		data = JSON.parse(await readFile(jsonPath, "utf8"));
	} catch (error) {
		fail(`Could not read dialogue JSON: ${error.message}`);
	}

	if (!data?.metadata?.courseId) fail("Missing metadata.courseId");
	if (!data?.metadata?.dialogueId) fail("Missing metadata.dialogueId");

	return {
		lessonId: data.metadata.courseId,
		dialogueId: data.metadata.dialogueId,
		dialogue: data,
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
		Maria: "ogwqBH5bbF03DSbNiRNN",
		Tom: "s3TPKV1kjDlVtZbl4Ksh",
		Anna: "uYXf8XasLslADfZ2MB4u",
		Leo: "s3TPKV1kjDlVtZbl4Ksh",
		Mia: "uYXf8XasLslADfZ2MB4u",
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
		if (!["Maria", "Tom", "Anna", "Leo", "Mia"].includes(speaker)) {
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

		const publicRoot = path.resolve("public");
		const outputPath = path.resolve(
			publicRoot,
			line.audioUrl.replace(/^[/\\]+/, ""),
		);
		const relativeOutputPath = path.relative(publicRoot, outputPath);
		if (
			relativeOutputPath.startsWith("..") ||
			path.isAbsolute(relativeOutputPath)
		) {
			fail(`Invalid audioUrl on dialogue line ${index + 1}: ${line.audioUrl}`);
		}

		return {
			speaker,
			text: line.text.trim(),
			voiceId: getVoiceId(speaker),
			filename,
			publicUrl,
			outputPath,
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
	let lessonId = options.lessonId;
	let dialogueId = options.dialogueId;
	let dialogue;

	if (options.jsonPath) {
		({ lessonId, dialogueId, dialogue } = await loadDraft(options.jsonPath));
	} else {
		const lessonData = await loadLessonData();
		const lesson = lessonData[lessonId];

		if (!lesson) fail(`Lesson not found: "${lessonId}"`);

		dialogue = lesson.dialogues?.find((item) => item.id === dialogueId);
		if (!dialogue) fail(`Dialogue not found: "${dialogueId}"`);
	}

	const plan = buildPlan(lessonId, dialogueId, dialogue);
	if (plan.length === 0) {
		fail(`No supported dialogue lines found for "${dialogueId}"`);
	}

	if (!options.dryRun && !process.env.ELEVENLABS_API_KEY) {
		try {
			process.loadEnvFile(".env.local");
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
	}

	const apiKey = process.env.ELEVENLABS_API_KEY;
	if (!options.dryRun && !apiKey) fail("Missing ELEVENLABS_API_KEY");

	const outputDirectory = path.dirname(plan[0].outputPath);
	if (!options.dryRun) await mkdir(outputDirectory, { recursive: true });

	let generated = 0;
	let skipped = 0;
	let failed = 0;

	console.log(
		`${options.dryRun ? "Dry run" : "Generating"}: ${lessonId}/${dialogueId} (${plan.length} dialogue lines)`,
	);
	console.log(`Destination: ${outputDirectory}`);

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

		try {
			await generateAudio(item, apiKey);
			generated += 1;
		} catch (error) {
			failed += 1;
			console.error(`FAILED   ${item.publicUrl}\n${error.message}`);
		}
	}

	if (options.dryRun) {
		console.log(`Dry run complete: ${plan.length} valid audio paths, 0 failed.`);
	} else {
		console.log(
			`Complete: ${generated} generated, ${skipped} skipped, ${failed} failed.`,
		);

		if (failed > 0) process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(`Audio generation failed: ${error.message}`);
	process.exitCode = 1;
});
