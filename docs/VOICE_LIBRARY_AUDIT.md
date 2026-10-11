# StudyJony voice library audit

This is a read-only inventory of the current workspace. I checked all 10 configured courses (7 Dialogue, 3 Story), their published JSON and available drafts, the legacy JavaScript lessons, the shared audio generator, the builder, public MP3 filenames, and voice-related documentation. I did not contact ElevenLabs or change code or audio.

## Where voices are assigned

`client/scripts/generate-dialogue-audio.mjs` is the only project source that maps character names to ElevenLabs voice IDs. Both Dialogue and Story courses flow through this generator via `client/scripts/config/index.mjs` and `client/scripts/build-dialogue.mjs`. There is no separate Story voice map, voice manifest, or default voice for an unknown speaker. The generator has both a voice-ID map and a separate list of allowed speaker names; a new character needs both entries. An unknown name fails generation.

The generator uses `eleven_multilingual_v2`, `mp3_44100_128`, and speed `0.75`. It skips an existing MP3 unless called with `--force`. The app plays the saved `audioUrl` files; it does not look up the current voice ID at playback time. Vocabulary and dictionary speech can also use the browser's `speechSynthesis`, which has no fixed ElevenLabs voice ID and is outside this recorded voice library.

## Character inventory

“Used in” names courses where a character is configured or appears in lesson data. “Config only” means no dialogue line or named MP3 exists yet. MP3 counts are based on speaker filenames, which do not prove the voice heard in the recording. Age and gender are **unknown** unless the existing configured name explicitly states a role or title; these labels do not verify the ElevenLabs voice's sound. No structured age or gender fields were found in the inspected character configs and lesson data.

| Character | Voice ID | Gender | Age group | Used in | Status |
| --- | --- | --- | --- | --- | --- |
| Alex | `oflxQzyUUjpgLlEYlSq2` | Unknown | Unknown | Dialogue: coffee-shop, restaurant; Story: the-lost-wallet config/draft | Mapped; 19 MP3s |
| Anna | `Cy8NxOxWnzsargZaVHUo` | Unknown | Unknown | Dialogue: office-introduction legacy lesson | Mapped; 10 MP3s |
| Ben | `oF10V53nXu6mNLtJLgko` | Unknown | Unknown | Dialogue: asking-for-directions, coffee-shop, at-a-hotel, grocery-store, restaurant, walk-in-the-park | Mapped; 123 MP3s |
| Daniel | — | Unknown | Unknown | Dialogue: at-a-hotel config only | Missing mapping; no MP3 |
| Elderly Woman | — | Woman (explicit role label) | Elderly (60+) (explicit role label) | Story: the-lost-wallet config only | Missing mapping; no MP3 |
| Emma | `Cy8NxOxWnzsargZaVHUo` | Unknown | Unknown | Dialogue: asking-for-directions, coffee-shop, grocery-store, restaurant, walk-in-the-park | Mapped; 93 MP3s |
| Lee | `meo5QemHRPp1cJE08w1a` | Unknown | Unknown | Dialogue: grocery-store | Mapped; 7 MP3s |
| Leo | `s3TPKV1kjDlVtZbl4Ksh` | Unknown | Unknown | Dialogue: weekend-camping; Story: ten-minutes-a-day | Mapped; 43 MP3s |
| Lily | `ur0MtycxCulNrunXsdLx` | Unknown | Unknown | Story: grateful | Mapped; 21 MP3s |
| Maria | `xHKaiky3urvwNvwRMmgo` | Unknown | Unknown | Dialogue: office-introduction legacy lesson | Mapped; 12 MP3s |
| Maya | `ur0MtycxCulNrunXsdLx` | Unknown | Unknown | Dialogue: at-a-hotel | Mapped; 21 MP3s |
| Mia | `ur0MtycxCulNrunXsdLx` | Unknown | Unknown | Dialogue: weekend-camping; Story: the-lost-wallet config | Mapped; 30 MP3s |
| Mom | `xHKaiky3urvwNvwRMmgo` | Woman (explicit role label) | Unknown | Story: grateful | Mapped; 14 MP3s |
| Mr. Daniel | `oF10V53nXu6mNLtJLgko` | Man (explicit title) | Unknown | Story: ten-minutes-a-day | Mapped; 11 MP3s |
| Ryan | `oflxQzyUUjpgLlEYlSq2` | Unknown | Unknown | Story: ten-minutes-a-day | Mapped; 22 MP3s |
| Sam | `HJdgjMBpPzwZ2VRzSTbw` | Unknown | Unknown | Story: grateful | Mapped; 13 MP3s |
| Stranger | — | Unknown | Unknown | Story: the-lost-wallet config only | Missing mapping; no MP3 |
| Tom | `s3TPKV1kjDlVtZbl4Ksh` | Unknown | Unknown | Dialogue: office-introduction legacy lesson | Mapped; 22 MP3s |

## Eight unique ElevenLabs IDs

| Voice ID | Assigned characters | MP3 files by assigned name | Current course use |
| --- | --- | ---: | --- |
| `xHKaiky3urvwNvwRMmgo` | Mom, Maria | 26 | Story and Dialogue |
| `ur0MtycxCulNrunXsdLx` | Lily, Mia, Maya | 72 | Story and Dialogue |
| `HJdgjMBpPzwZ2VRzSTbw` | Sam | 13 | Story |
| `s3TPKV1kjDlVtZbl4Ksh` | Tom, Leo | 65 | Story and Dialogue |
| `Cy8NxOxWnzsargZaVHUo` | Anna, Emma | 103 | Dialogue |
| `oF10V53nXu6mNLtJLgko` | Ben, Mr. Daniel | 134 | Story and Dialogue |
| `oflxQzyUUjpgLlEYlSq2` | Alex, Ryan | 41 | Story and Dialogue |
| `meo5QemHRPp1cJE08w1a` | Lee | 7 | Dialogue |

These 461 named MP3s split into 367 under `client/public/dialogue/` and 94 under `client/public/stories/`. No other speaker filename stem appeared in that MP3 inventory. The shared IDs above are explicit in one mapping, not separate Dialogue/Story assignments. No character has two **current** IDs in that map.

## Consistency and gaps

- Sam's new ID `HJdgjMBpPzwZ2VRzSTbw` is configured. The [Sam replacement report](SAM_AUDIO_REPLACEMENT.md) records 13 replaced files. His former ID `oF10V53nXu6mNLtJLgko` remains intentionally assigned to Ben and Mr. Daniel.
- `Daniel`, `Stranger`, and `Elderly Woman` are configured characters with no current voice assignment. `Daniel` and `Mr. Daniel` are distinct map keys; the files do not establish that they are the same character.
- The current generator has no fallback voice. Its allowed-speaker list duplicates the names in the ID map, so adding an ID alone would still leave a new name unsupported.
- Existing MP3s do not establish which ElevenLabs ID produced them. Since generation skips existing files by default, changing a mapping only affects future or forced generation. Some recordings may therefore contain an earlier voice. File hashes and browser playback confirm bytes and validity, not voice identity. The prior Sam replacement provides provenance for those 13 files; the remaining recordings have not been independently matched to ElevenLabs voice histories.
- The office-introduction lesson is legacy JavaScript data outside the 10-course generator config, but its Anna, Maria, and Tom speakers are mapped and have MP3s. Weekend-camping also has legacy JavaScript lessons; Leo and Mia use the same shared generator map when generated through it.

## Planned reusable profiles

The eight requested casting profiles are **not yet verified as covered** by the eight IDs. A character's name and an ID cannot establish how a voice sounds, and the inspected sources do not store voice age or gender metadata. Record verified character age/gender and listen to candidate voices before assigning any profile.

| Planned profile | Current evidence | Recommendation |
| --- | --- | --- |
| Young boy (Child 8–12) | No verified voice age | Check child character metadata and audition existing voices; add one if none fits |
| Young girl (Child 8–12) | No verified voice age | Check child character metadata and audition existing voices; add one if none fits |
| Teenage boy (Teen 13–17) | No verified voice age | Verify age and audition; add one if needed |
| Teenage girl (Teen 13–17) | No verified voice age | Verify age and audition; add one if needed |
| Adult man (Adult 31–59) | No verified voice age | Audition the existing mapped voices before reusing one |
| Adult woman (Adult 31–59) | No verified voice age | Audition the existing mapped voices before reusing one |
| Elderly man (Elderly 60+) | No verified voice age | Confirm a character and audition or add a voice |
| Elderly woman (Elderly 60+) | A named character is planned, but has no voice ID | Audition or add a suitable voice before recording her lines |

The requested eight profiles do not include the separate **Young adult (18–30)** age group from the rubric. Decide whether it needs its own reusable voices before settling the casting plan.

Checking ElevenLabs directly would be needed to verify voice ownership/availability, provider labels, custom rates, and generation history. Listening checks would be needed to confirm perceived age, gender, and consistency. This audit made no ElevenLabs requests and did not generate audio.
