"use client";

import { useEffect, useRef } from "react";
import styles from "./AuthOverlay.module.css";

export default function AuthOverlay({ children }) {
	const overlayRef = useRef(null);

	useEffect(() => {
		const viewport = window.visualViewport;
		if (!viewport) return;

		function updateViewport() {
			const overlay = overlayRef.current;
			if (!overlay) return;
			overlay.style.height = `${viewport.height}px`;
			overlay.style.top = `${viewport.offsetTop}px`;
		}

		updateViewport();
		viewport.addEventListener("resize", updateViewport);
		viewport.addEventListener("scroll", updateViewport);
		return () => {
			viewport.removeEventListener("resize", updateViewport);
			viewport.removeEventListener("scroll", updateViewport);
		};
	}, []);

	return <div ref={overlayRef} className={`${styles.overlay} bg-black/60`}>{children}</div>;
}
