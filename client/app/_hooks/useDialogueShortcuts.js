"use client";

import { useEffect, useRef } from "react";

const INTERACTIVE_SELECTOR = [
	"button",
	"a[href]",
	"input",
	"select",
	"textarea",
	"summary",
	"[contenteditable]:not([contenteditable='false'])",
	"[role='button']",
	"[role='link']",
	"[role='checkbox']",
	"[role='radio']",
	"[role='switch']",
	"[role='tab']",
	"[role='menuitem']",
	"[role='option']",
	"[role='combobox']",
	"[tabindex]:not([tabindex='-1'])",
].join(",");

function isInteractiveTarget(target) {
	return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));
}

function useDialogueShortcuts({
	onEnter,
	onReplay,
	onNumber,
	numberShortcutsDisabled = false,
	disabled = false,
}) {
	const handlersRef = useRef({
		onEnter,
		onReplay,
		onNumber,
		numberShortcutsDisabled,
		disabled,
	});

	useEffect(() => {
		handlersRef.current = {
			onEnter,
			onReplay,
			onNumber,
			numberShortcutsDisabled,
			disabled,
		};
	}, [onEnter, onReplay, onNumber, numberShortcutsDisabled, disabled]);

	useEffect(() => {
		let controlPressed = false;
		let controlUsedInCombination = false;

		function handleKeyDown(event) {
			if (event.repeat || handlersRef.current.disabled) return;

			const isTyping =
				event.target instanceof Element &&
				event.target.matches("input, textarea, [contenteditable='true']");
			const isInteractive = isInteractiveTarget(event.target);
			const isModalOpen = Boolean(
				document.querySelector('[aria-modal="true"]'),
			);
			const isPlainNumber =
				/^[1-4]$/.test(event.key) &&
				!event.ctrlKey &&
				!event.altKey &&
				!event.metaKey &&
				!event.shiftKey;

			if (
				isPlainNumber &&
				handlersRef.current.onNumber &&
				!handlersRef.current.numberShortcutsDisabled &&
				!isTyping &&
				!isModalOpen
			) {
				event.preventDefault();
				handlersRef.current.onNumber(Number(event.key) - 1);
			}

			const isPlainEnter =
				event.key === "Enter" &&
				!event.ctrlKey &&
				!event.altKey &&
				!event.metaKey &&
				!event.shiftKey;
			if (
				isPlainEnter &&
				handlersRef.current.onEnter &&
				!isModalOpen &&
				!isInteractive
			) {
				event.preventDefault();
				handlersRef.current.onEnter();
			}

			if (event.key === "Control") {
				controlPressed = true;
				controlUsedInCombination = false;
			} else if (controlPressed && event.ctrlKey) {
				controlUsedInCombination = true;
			}
		}

		function handleKeyUp(event) {
			if (event.key !== "Control") return;

			if (
				controlPressed &&
				!controlUsedInCombination &&
				!handlersRef.current.disabled &&
				handlersRef.current.onReplay
			) {
				event.preventDefault();
				handlersRef.current.onReplay();
			}

			controlPressed = false;
			controlUsedInCombination = false;
		}

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, []);
}

export default useDialogueShortcuts;
