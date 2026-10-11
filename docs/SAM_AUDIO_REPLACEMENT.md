# Sam audio replacement

Sam now uses ElevenLabs voice `HJdgjMBpPzwZ2VRzSTbw`. The shared generator mapping applies to future Dialogue and Story generation. The only generator change is Sam's voice ID.

The project search found 13 unique Sam lines/files, all in the four grateful Story chapters. Published JSON and generated drafts match for every Sam text and audio URL. There are no Sam lines in the current Dialogue module and no unmapped Sam-named MP3 files.

The existing generator passed a Sam-only `--dry-run --force` for all 13 paths before regeneration. The verified scope and estimate were reported before sending the lines to ElevenLabs under the user's explicit replacement request.

Credit estimate: 489 text characters, approximately 489 base credits for eleven_multilingual_v2, excluding a possible custom voice multiplier. Actual account billing was not inspected. [ElevenLabs credit rules](https://help.elevenlabs.io/hc/en-us/articles/27562116787345-Have-characters-changed).

Result: 13 generated/replaced, 0 skipped, 0 failed. No audio files added or removed. SHA-256 comparison across all 461 project MP3s confirmed exactly these 13 changed; the other 448 are identical. Lesson JSON, generated drafts, registration, and config files retain their before hashes, including the pre-existing the-lost-wallet config edit.

Model remains `eleven_multilingual_v2`, output remains MP3 at 44.1 kHz / 128 kbps, and voice speed remains 0.75. All replacements have nonempty ID3/MPEG1 Layer III data. All 13 existing local URLs returned HTTP 200 with the replacement hashes and decoded into non-silent audio in headless Chrome. This verifies browser decoding and serving, not a human listening review or deployment.

Checks: 5 content-path tests passed; local mocked generator checks passed for all 15 voice mappings in both Dialogue and Story paths (30 mocked requests, no extra TTS credits). They verify the new Sam voice and every other original voice, model, speed, text, filenames, and output paths. Focused ESLint for the generator passed, and `git diff --check` passed.

Files changed by this task:

- `client/scripts/generate-dialogue-audio.mjs` — Sam voice mapping only.
- `client/public/stories/grateful/a-busy-morning/audio/sam-01.mp3` — replaced Sam MP3.
- `client/public/stories/grateful/a-busy-morning/audio/sam-02.mp3` — replaced Sam MP3.
- `client/public/stories/grateful/a-small-act-of-kindness/audio/sam-01.mp3` — replaced Sam MP3.
- `client/public/stories/grateful/a-small-act-of-kindness/audio/sam-02.mp3` — replaced Sam MP3.
- `client/public/stories/grateful/a-small-act-of-kindness/audio/sam-03.mp3` — replaced Sam MP3.
- `client/public/stories/grateful/a-small-act-of-kindness/audio/sam-04.mp3` — replaced Sam MP3.
- `client/public/stories/grateful/a-small-act-of-kindness/audio/sam-05.mp3` — replaced Sam MP3.
- `client/public/stories/grateful/a-small-act-of-kindness/audio/sam-06.mp3` — replaced Sam MP3.
- `client/public/stories/grateful/helping-in-return/audio/sam-01.mp3` — replaced Sam MP3.
- `client/public/stories/grateful/helping-in-return/audio/sam-02.mp3` — replaced Sam MP3.
- `client/public/stories/grateful/helping-in-return/audio/sam-03.mp3` — replaced Sam MP3.
- `client/public/stories/grateful/saying-thank-you/audio/sam-01.mp3` — replaced Sam MP3.
- `client/public/stories/grateful/saying-thank-you/audio/sam-02.mp3` — replaced Sam MP3.
- `docs/SAM_AUDIO_REPLACEMENT.md` — this report.

## Replacement evidence

| File | Bytes | Duration (seconds) | Before SHA-256 | After SHA-256 |
| --- | ---: | ---: | --- | --- |
| `client/public/stories/grateful/a-busy-morning/audio/sam-01.mp3` | 30973 | 1.858 | `84798211ac7ec5d9f06d0e11a00c2569c648df930217fe7752b5820a14ba7ffc` | `da8c0652745724e9eb2fcae5cb75296b7c1d55f2df67f538291f03b3ce2758fe` |
| `client/public/stories/grateful/a-busy-morning/audio/sam-02.mp3` | 48527 | 2.972 | `e1439fb6e30ce8837738714696bd338fc3fdf56111ef37d715404435aecddc1f` | `2380f71631ca5003a2e1410171c9d5c20214116b5b2f07db35b276db434e355c` |
| `client/public/stories/grateful/a-small-act-of-kindness/audio/sam-01.mp3` | 51453 | 3.158 | `450ad06485b968f68fe70e5e1b0dd169a8eac60b92d03364c760530fc0adef80` | `7febf82c62f8811080e583c03950a70977913fac94f594716a82de205d5fc7ca` |
| `client/public/stories/grateful/a-small-act-of-kindness/audio/sam-02.mp3` | 43511 | 2.647 | `56b62668cd49be9b3e75a4445e3f71912a92126e310863303db4a6fc9b04bb95` | `f218a8ef65422288afd17a1f64b20a4f88e10fc7903a64c8936e5c639d71a6a8` |
| `client/public/stories/grateful/a-small-act-of-kindness/audio/sam-03.mp3` | 42675 | 2.601 | `ac7cbcd59b703c7253b2f064c6337c0766a9a207013892d5a82c22bef117a6ce` | `b3f91de87bc96ead13da6421206aff8ff7cf2c46f1054e0024767c0f3d861d7d` |
| `client/public/stories/grateful/a-small-act-of-kindness/audio/sam-04.mp3` | 42675 | 2.601 | `8f24dc3e1c711315ea1d3c2e1d5201762dce5f9e50b0e7f383dcfac0c9e84990` | `c5fd20bef70c4db2111a743ad563c4f1a9b0c9045c3da2bf968151f17f5908b6` |
| `client/public/stories/grateful/a-small-act-of-kindness/audio/sam-05.mp3` | 52288 | 3.204 | `f81a9218a63ba5761de748095fa2244c3d44454184bb3fb7820bfe135befc4c9` | `80c8dc4fc677e35059ef2d4bedefe7a45eee1c856c5bdbc4419db836e5004394` |
| `client/public/stories/grateful/a-small-act-of-kindness/audio/sam-06.mp3` | 36824 | 2.229 | `37d57e651d8531cca7b0da6c30a37e6789c524dea1f55f6e064346612c3183b5` | `57cfb3f515ded44d38d5ac3563afc78fc28f716515adafd8766803a6f2fab5be` |
| `client/public/stories/grateful/helping-in-return/audio/sam-01.mp3` | 43511 | 2.647 | `5e18945d2db286d187e9017a6ceac02dd64125f6b0476641bd8ba5d78c1ff938` | `ac46dcbc67d0decc9164454ef2ac4b9a01be02b37fb73e832c9892e42652f5df` |
| `client/public/stories/grateful/helping-in-return/audio/sam-02.mp3` | 47691 | 2.926 | `60720fbbc3065739e555d1b9a44778922c257e17c7c25d6178b18b465f19e6a6` | `4a96266c70e9962a7f5b0a742e5c7cb5c125c4acc20276067e3be1f16c5dcbd3` |
| `client/public/stories/grateful/helping-in-return/audio/sam-03.mp3` | 59812 | 3.669 | `257784f0cbf9c631dc34292a43beeafef77cc0d37de56ab20b47e1d7e70fb428` | `5885584b88272c767003731409ad35715729ece08b90260fabeff5633e94d520` |
| `client/public/stories/grateful/saying-thank-you/audio/sam-01.mp3` | 43511 | 2.647 | `1ae749fe5247f3eae0654b82159393223bcab1e6ea5cbf80f5ada40498d6d836` | `049f08f8c1778d24dd77fd396fa23cdd43b931c83037abcc3b0e355a05c7b1ff` |
| `client/public/stories/grateful/saying-thank-you/audio/sam-02.mp3` | 55214 | 3.390 | `89aac36da728a05e6b5454ccfe385508fef55a5c8f2d8805a659cbed57418b29` | `41530cd7c463542752e7769598749adf0b643d3d5d0ad4881f9c0e439bfd1243` |
