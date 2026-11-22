"use client";

import Image from "next/image";
import { useState } from "react";
import { a2LocalFallback } from "../_lib/dialogue/a2R2Media.mjs";

export default function A2MediaImage({ src, alt, ...props }) {
	const [failedSrc, setFailedSrc] = useState(null);
	const fallback = failedSrc === src ? a2LocalFallback(src) : null;
	return <Image {...props} alt={alt} src={fallback || src} unoptimized={Boolean(a2LocalFallback(src))} onError={() => setFailedSrc(src)} />;
}
