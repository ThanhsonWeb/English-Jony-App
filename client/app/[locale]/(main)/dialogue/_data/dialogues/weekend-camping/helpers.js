function orderDialogueTasks(tasks, orderedTaskIds) {
  return orderedTaskIds.map((taskId, index) => ({
    ...tasks.find((task) => task.id === taskId),
    id: String(index + 1),
  }));
}

const weekendCampingMedia = {
  "arriving-at-the-campsite": {
    scene: "/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
    characters: {
      Leo: "/dialogue/weekend-camping/shared/leo.png",
      Mia: "/dialogue/weekend-camping/shared/mia.png",
    },
  },

  "setting-up-the-tent": {
    scene: "/dialogue/weekend-camping/setting-up-the-tent/bg.png",
    characters: {
      Leo: "/dialogue/weekend-camping/shared/leo.png",
      Mia: "/dialogue/weekend-camping/shared/mia.png",
    },
  },

  "starting-a-campfire": {
    scene: "/dialogue/weekend-camping/starting-a-campfire/bg.png",
    characters: {
      Leo: "/dialogue/weekend-camping/shared/leo-d3.png",
      Mia: "/dialogue/weekend-camping/shared/mia-d3.png",
    },
  },

  "cooking-dinner": {
    scene: "/dialogue/weekend-camping/cooking-dinner/bg.png",
    characters: {
      Leo: "/dialogue/weekend-camping/shared/leo-d3.png",
      Mia: "/dialogue/weekend-camping/shared/mia-d3.png",
    },
  },

  "talking-by-the-campfire": {
    scene: "/dialogue/weekend-camping/talking-by-the-campfire/bg.png",
    characters: {
      Leo: "/dialogue/weekend-camping/shared/leo-d4.png",
      Mia: "/dialogue/weekend-camping/shared/mia-d4.png",
    },
  },
};

function weekendCampingFillBlankTask(
  id,
  dialogueId,
  speaker,
  audioIndex,
  transcript,
  sentenceBefore,
  answer,
  sentenceAfter,
) {
  const media = weekendCampingMedia[dialogueId];

  if (!media) {
    throw new Error(`Unknown Weekend Camping dialogue: ${dialogueId}`);
  }

  const characterImage = media.characters[speaker];

  if (!characterImage) {
    throw new Error(
      `Missing Weekend Camping character image for "${speaker}" in "${dialogueId}"`,
    );
  }

  return {
    id,
    type: "fillBlank",
    title: "Điền từ còn thiếu",
    instruction: "Nghe và điền từ còn thiếu.",

    scene: media.scene,

    character: {
      name: speaker,
      image: characterImage,
    },

    audioUrl: `/dialogue/weekend-camping/${dialogueId}/audio/${speaker.toLowerCase()}-${String(
      audioIndex,
    ).padStart(2, "0")}.mp3`,

    transcript,
    sentenceBefore,
    sentenceAfter,
    answer,
  };
}

export {
  orderDialogueTasks,
  weekendCampingMedia,
  weekendCampingFillBlankTask,
};