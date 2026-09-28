import groceryStoreConfig from "@/scripts/config/courses/grocery-store.mjs";

import makingAShoppingList from "../dialogues/grocery-store/making-a-shopping-list.json";
import { groceryStoreMedia } from "../dialogues/grocery-store/media";
import { buildGeneratedDialogue } from "../helpers/buildDialogue";

function buildCourseDialogue(draft) {
   if (
      groceryStoreConfig?.courseId !== "grocery-store" ||
      !Array.isArray(groceryStoreConfig.dialogues) ||
      !Array.isArray(groceryStoreConfig.characters)
   ) {
      throw new Error("Grocery Store course config is missing or invalid.");
   }

   const dialogueId = draft?.metadata?.dialogueId;

   if (!dialogueId) {
      throw new Error("Grocery Store dialogue is missing metadata.dialogueId.");
   }

   const config = groceryStoreConfig.dialogues.find(
      (item) => item.dialogueId === dialogueId,
   );

   if (!config) {
      throw new Error(
         `Missing Grocery Store config for dialogue "${dialogueId}".`,
      );
   }

   const media = groceryStoreMedia[dialogueId];

   if (!media) {
      throw new Error(
         `Missing Grocery Store media for dialogue "${dialogueId}".`,
      );
   }

   const speakers = new Set(draft.dialogue.map((line) => line.speaker));

   for (const speaker of speakers) {
      if (!groceryStoreConfig.characters.includes(speaker)) {
         throw new Error(
            `Unknown Grocery Store character "${speaker}" in dialogue "${dialogueId}".`,
         );
      }

      if (!media.characters[speaker]) {
         throw new Error(
            `Missing Grocery Store image for character "${speaker}" in dialogue "${dialogueId}".`,
         );
      }
   }

   const dialogue = buildGeneratedDialogue(draft, media.characters, media);

   return {
      ...dialogue,
      title: config.title?.trim() ?? dialogue.title,
      description: config.situation ?? dialogue.description,
      thumbnail: config.thumbnail ?? dialogue.thumbnail,
   };
}

const groceryStoreCourse = {
   id: "grocery-store",
   heroImage: makingAShoppingList.metadata.scene,
   image: makingAShoppingList.metadata.scene,
   title: "Đi siêu thị",
   description:
      "Học cách lập danh sách mua sắm và giao tiếp trong những tình huống quen thuộc tại siêu thị.",
   level: "beginner",
   dialogues: [
      buildCourseDialogue(makingAShoppingList),
   ],
};

export default groceryStoreCourse;