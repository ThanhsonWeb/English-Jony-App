import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
	locales: ["vi", "en"],
	defaultLocale: "vi",
	localePrefix: "as-needed",
	// Guest persistence is handled explicitly; account navigation must not write it.
	localeCookie: false,
});
