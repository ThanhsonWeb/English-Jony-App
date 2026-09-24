import dictionary from "./dictionary-v3.json" with { type: "json" };
import lemmaMap from "./lemma-map.json" with { type: "json" };
import phrases from "./phrases.json" with { type: "json" };

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
      ...(lemmaMap[key] ? { lemma: lemmaMap[key] } : {}),
      ...dictionary[key],
    };
  }

  return null;
}
