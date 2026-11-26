"use client";

import { useEffect, useRef, useState } from "react";
import { Crop, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react";
import MobileDialogOverlay from "./MobileDialogOverlay";

const SIZE = 512;

export default function AvatarCropper({ file, t, busy, onCancel, onSave }) {
	const canvasRef = useRef(null);
	const previewRef = useRef(null);
	const dialogRef = useRef(null);
	const dragRef = useRef(null);
	const encodingRef = useRef(false);
	const activeRef = useRef(false);
	const [encoding, setEncoding] = useState(false);
	const [image, setImage] = useState(null);
	const [failed, setFailed] = useState(false);
	const [zoom, setZoom] = useState(1);
	const [rotation, setRotation] = useState(0);
	const [position, setPosition] = useState({ x: 0, y: 0 });
	function clampPosition(next) {
		if (!image) return { x: 0, y: 0 };
		const width = rotation % 180 ? image.naturalHeight : image.naturalWidth;
		const height = rotation % 180 ? image.naturalWidth : image.naturalHeight;
		const scale = Math.max(SIZE / width, SIZE / height) * zoom;
		const limitX = (width * scale - SIZE) / 2, limitY = (height * scale - SIZE) / 2;
		return { x: Math.max(-limitX, Math.min(limitX, next.x)), y: Math.max(-limitY, Math.min(limitY, next.y)) };
	}

	useEffect(() => {
		const url = URL.createObjectURL(file);
		const loaded = new window.Image();
		loaded.onload = () => setImage(loaded);
		loaded.onerror = () => setFailed(true);
		loaded.src = url;
		return () => { loaded.onload = null; loaded.onerror = null; URL.revokeObjectURL(url); };
	}, [file]);

	useEffect(() => {
		activeRef.current = true;
		const previous = document.activeElement;
		const oldOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		dialogRef.current?.querySelector("button")?.focus();
		return () => { activeRef.current = false; document.body.style.overflow = oldOverflow; if (previous?.isConnected) previous.focus(); };
	}, []);

	useEffect(() => {
		if (!image) return;
		const ctx = canvasRef.current?.getContext("2d");
		const preview = previewRef.current?.getContext("2d");
		if (!ctx || !preview) return;
		const swapped = rotation % 180 !== 0;
		const width = swapped ? image.naturalHeight : image.naturalWidth;
		const height = swapped ? image.naturalWidth : image.naturalHeight;
		const scale = Math.max(SIZE / width, SIZE / height) * zoom;
		const x = Math.max(-(width * scale - SIZE) / 2, Math.min((width * scale - SIZE) / 2, position.x));
		const y = Math.max(-(height * scale - SIZE) / 2, Math.min((height * scale - SIZE) / 2, position.y));
		ctx.fillStyle = "#fff";
		ctx.fillRect(0, 0, SIZE, SIZE);
		ctx.save();
		ctx.translate(SIZE / 2 + x, SIZE / 2 + y);
		ctx.rotate(rotation * Math.PI / 180);
		ctx.drawImage(image, -image.naturalWidth * scale / 2, -image.naturalHeight * scale / 2, image.naturalWidth * scale, image.naturalHeight * scale);
		ctx.restore();
		preview.clearRect(0, 0, SIZE, SIZE);
		preview.drawImage(canvasRef.current, 0, 0);
	}, [image, zoom, rotation, position]);

	function cancelCrop() {
		activeRef.current = false;
		onCancel();
	}

	function onKeyDown(event) {
		if (event.key === "Escape" && !busy) { event.preventDefault(); cancelCrop(); return; }
		if (event.key !== "Tab") return;
		const elements = dialogRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]');
		if (!elements?.length) return;
		const first = elements[0], last = elements[elements.length - 1];
		if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
		else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
	}

	function move(event) {
		if (!dragRef.current || !canvasRef.current) return;
		const factor = SIZE / canvasRef.current.getBoundingClientRect().width;
		setPosition(clampPosition({ x: dragRef.current.x + (event.clientX - dragRef.current.clientX) * factor, y: dragRef.current.y + (event.clientY - dragRef.current.clientY) * factor }));
	}

	return <MobileDialogOverlay labelledBy="avatar-crop-title" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm" >
		<div ref={dialogRef} onKeyDown={onKeyDown} className="max-h-[calc(100dvh-24px)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-app bg-elevated p-4 text-main shadow-2xl sm:p-6">
			<div className="mb-4 flex items-center justify-between gap-3"><h2 id="avatar-crop-title" className="flex items-center gap-2 text-lg font-bold sm:text-2xl"><Crop size={22} aria-hidden="true" />{t("cropTitle")}</h2><button type="button" disabled={busy} onClick={cancelCrop} aria-label={t("close")} className="rounded-lg p-2 text-secondary hover:bg-hover hover:text-main"><X size={22} /></button></div>
			<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
				<div className="relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-xl bg-slate-950">
					<canvas ref={canvasRef} width={SIZE} height={SIZE} tabIndex={0} role="img" aria-label={t("cropDragHint")} className="h-full w-full touch-none cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-teal-400" onPointerDown={event => { if (busy || !image) return; event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { clientX: event.clientX, clientY: event.clientY, ...clampPosition(position) }; }} onPointerMove={move} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }} onKeyDown={event => { const delta = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[event.key]; if (delta && !busy) { event.preventDefault(); setPosition(p => clampPosition({ x: p.x + delta[0], y: p.y + delta[1] })); } }} />
					<div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full border-2 border-white shadow-[0_0_0_100vmax_rgba(0,0,0,0.5)]" />
					{failed && <p role="alert" className="absolute inset-0 grid place-items-center bg-surface p-4 text-center text-red-500">{t("cropLoadError")}</p>}
				</div>
				<div className="flex items-center justify-center gap-3 rounded-xl bg-surface-muted p-3 sm:flex-col sm:gap-4"><span className="text-sm font-semibold text-secondary">{t("cropPreview")}</span><canvas ref={previewRef} width={SIZE} height={SIZE} aria-hidden="true" className="h-20 w-20 rounded-full object-cover sm:h-32 sm:w-32" /></div>
			</div>
			<p className="mt-2 text-xs text-secondary">{t("cropDragHint")}</p>
			<div className="mt-3 flex items-center gap-3"><ZoomOut size={19} className="shrink-0 text-secondary" aria-hidden="true" /><input type="range" min="1" max="3" step="0.01" value={zoom} disabled={busy || !image} aria-label={t("cropZoom")} onChange={event => setZoom(Number(event.target.value))} className="min-w-0 flex-1 accent-teal-500" /><ZoomIn size={19} className="shrink-0 text-secondary" aria-hidden="true" /><button type="button" disabled={busy || !image} onClick={() => { setRotation(value => (value + 90) % 360); setPosition({ x: 0, y: 0 }); }} aria-label={t("cropRotate")} title={t("cropRotate")} className="rounded-xl border border-app bg-surface p-2 text-main hover:bg-hover"><RotateCw size={20} /></button></div>
			<div className="mt-4 flex justify-end gap-3 border-t border-app pt-4"><button type="button" disabled={busy} onClick={cancelCrop} className="rounded-xl border border-app px-4 py-2.5 font-semibold text-main hover:bg-hover">{t("cancel")}</button><button type="button" disabled={busy || encoding || !image || failed} onClick={() => {
				if (encodingRef.current || !canvasRef.current) return;
				encodingRef.current = true;
				setEncoding(true);
				canvasRef.current.toBlob(blob => {
					if (!activeRef.current) return;
					if (blob) onSave(blob);
					else { encodingRef.current = false; setEncoding(false); setFailed(true); }
				}, "image/jpeg", 0.9);
			}} className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-white hover:bg-primary-hover disabled:opacity-50">{t(busy || encoding ? "uploadingAvatar" : "cropSave")}</button></div>
		</div>
	</MobileDialogOverlay>;
}
