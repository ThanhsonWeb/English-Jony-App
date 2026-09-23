import dictionary from "./dictionary.json";
import phrases from "./phrases.json";

function normalize(text = "") {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:"()]/g, "");
}

export function lookupWord(text) {
  const key = normalize(text);

  if (phrases[key]) {
    return {
      text: key,
      source: "phrase",
      ...phrases[key],
    };
  }

  if (dictionary[key]) {
    return {
      text: key,
      source: "word",
      ...dictionary[key],
    };
  }

  return null;
}