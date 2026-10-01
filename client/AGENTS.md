# StudyJony dialogue generation

Default Codex workflow for a new topic: **generate dialogue JSON → validate JSON → prepare thumbnail manifest and prompts**. Stop there and tell the user the manifest is ready to give to ChatGPT.

1. Run `npm run dialogue:thumbnails:prepare -- <courseId>` from `client` after the final JSON files are ready. The helper validates each dialogue and writes `generated/dialogues/<courseId>/thumbnail-manifest.md` plus a `thumbnail-prompt.txt` for each dialogue. Fix any JSON validation failure before reporting the manifest ready.
2. Review the manifest for the dialogue slug, title, real speakers, scene/context, important visual details, background/time of day, and consistent StudyJony style. Use the real dialogue text and existing character/style references. Give the user the manifest path and say it is ready for ChatGPT to generate one separate slug-named PNG per dialogue.

**Do not generate thumbnail images in Codex, even when an image-generation tool is available.** Do not call image-generation tools or spend Codex quota on thumbnails. ChatGPT handles image generation separately. `dialogue:build` still handles promotion and audio; it does not generate images.

