"use client";

import { useEffect, useRef } from "react";
import styles from "./MobileDialogOverlay.module.css";

export default function MobileDialogOverlay({ children, className, labelledBy }) {
	const overlayRef = useRef(null);

	useEffect(() => {
		const viewport = window.visualViewport;
		const mobile = window.matchMedia("(max-width: 767px)");
		function updateViewport() {
			const overlay = overlayRef.current;
			if (!overlay) return;
			if (mobile.matches) {
				overlay.style.setProperty("--dialog-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
				overlay.style.setProperty("--dialog-viewport-top", `${viewport?.offsetTop ?? 0}px`);
			} else {
				overlay.style.removeProperty("--dialog-viewport-height");
				overlay.style.removeProperty("--dialog-viewport-top");
			}
		}
		updateViewport();
		viewport?.addEventListener("resize", updateViewport);
		viewport?.addEventListener("scroll", updateViewport);
		window.addEventListener("resize", updateViewport);
		mobile.addEventListener("change", updateViewport);
		return () => {
			viewport?.removeEventListener("resize", updateViewport);
			viewport?.removeEventListener("scroll", updateViewport);
			window.removeEventListener("resize", updateViewport);
			mobile.removeEventListener("change", updateViewport);
		};
	}, []);

	return (
		<div ref={overlayRef} className={`${className} ${styles.overlay}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
			{children}
		</div>
	);
}
