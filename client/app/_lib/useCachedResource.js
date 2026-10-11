"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useAuth } from "@/app/_contexts/AuthContext";
import { emptyResource, resourceCache } from "./resourceCache.mjs";

export function useCachedResource({ userId, key, fetcher, enabled = true, persist = false, staleTime = 30_000 }) {
	const { captureSession, isCurrentSession, setUser } = useAuth();
	const fetcherRef = useRef(fetcher);
	useEffect(() => { fetcherRef.current = fetcher; }, [fetcher]);
	const active = enabled && Boolean(userId && key);
	const subscribe = useCallback(listener => active ? resourceCache.subscribe(userId, key, listener) : () => {}, [active, userId, key]);
	const getSnapshot = useCallback(() => active ? resourceCache.read(userId, key, persist) : emptyResource, [active, userId, key, persist]);
	const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => emptyResource);
	const refresh = useCallback((force = false) => {
		if (!active) return Promise.resolve(undefined);
		const session = captureSession();
		return resourceCache.load(userId, key, () => fetcherRef.current(), { persist, staleTime, force })
			.catch(error => {
				if (error.message === "unauthorized" && session.userId === userId && isCurrentSession(session)) setUser(null);
				throw error;
			});
	}, [active, userId, key, persist, staleTime, captureSession, isCurrentSession, setUser]);
	useEffect(() => {
		if (!active) return;
		if (!snapshot.error && (snapshot.data === undefined || snapshot.invalidated || Date.now() - snapshot.updatedAt >= staleTime)) {
			void refresh().catch(() => {});
		}
	}, [active, snapshot.revision, snapshot.data, snapshot.error, snapshot.invalidated, snapshot.updatedAt, staleTime, refresh]);
	useEffect(() => {
		if (!active) return;
		const onFocus = () => { void refresh().catch(() => {}); };
		window.addEventListener("focus", onFocus);
		return () => window.removeEventListener("focus", onFocus);
	}, [active, refresh]);
	return { data: snapshot.data, error: snapshot.error, loading: active && snapshot.data === undefined && !snapshot.error, refresh };
}
