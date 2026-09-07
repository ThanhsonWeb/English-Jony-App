"use client";

import { useEffect, useRef } from "react";

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
			if (isPlainEnter && handlersRef.current.onEnter) {
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
