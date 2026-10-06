"use client";

import { usePathname } from "next/navigation";
import en from "@/messages/en.json";
import vi from "@/messages/vi.json";

// Error boundaries can render without the locale layout/provider.
export function useBoundaryMessages() {
	const pathname = usePathname();
	const english = /^\/en(?:\/|$)/.test(pathname || "");
	return {
		messages: (english ? en : vi).ErrorPages,
		homeHref: english ? "/en" : "/",
	};
}
