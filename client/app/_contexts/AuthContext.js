"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { resourceCache } from "@/app/_lib/resourceCache.mjs";
import { createAuthSessionGuard } from "@/app/_lib/authSessionGuard.mjs";
import { createSessionRestore } from "@/app/_lib/sessionRestore.mjs";
import { createCredentialAttempt, selectCredentialSession, discardCredentialAttempt,
    registerCredentialIntent, isCurrentCredentialIntent, invalidateCredentialIntent,
    captureCredentialSession } from "@/app/_lib/credentialAttempt.mjs";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setStoredUser] = useState(null);
    const [loading, setLoading] = useState(true); 
    const [sessionGuard] = useState(createAuthSessionGuard);
    const [acceptUser] = useState(() => {
        let confirmedUserId;
        return (nextUser) => {
            const nextId = nextUser?._id || nextUser?.id || null;
            if (confirmedUserId && confirmedUserId !== nextId) resourceCache.clearUser(confirmedUserId);
            if (!nextId) resourceCache.clearAllPrivate();
			resourceCache.setActiveUserId(nextId);
            confirmedUserId = nextId;
            setStoredUser(nextUser);
            setLoading(false);
        };
    });
    const [credentialAttempts] = useState(() => createCredentialAttempt({
        guard: sessionGuard, selectSession: selectCredentialSession,
        registerIntent: registerCredentialIntent, isCurrentIntent: isCurrentCredentialIntent,
        onUser: acceptUser,
    }));
    const [sessionRestore] = useState(() => createSessionRestore({
        guard: sessionGuard,
        async loadUser(signal) {
            const res = await fetch("/api/v1/users/me", { credentials: "include", cache: "no-store", signal,
                headers: { "X-StudyJony-Credential-Cleanup": "1" } });
            if (!res.ok) return null;
            const data = await res.json();
            if (data?.status !== undefined && data.status !== "success") return null;
            return data?.data?.user || null;
        },
        onUser: acceptUser,
        onLoading: setLoading,
    }));

    const setUser = useCallback((nextUser) => {
        sessionRestore.invalidate();
        credentialAttempts.invalidate();
        if (typeof nextUser !== "function") invalidateCredentialIntent();
        const resolved = typeof nextUser === "function"
            ? sessionGuard.update(nextUser(sessionGuard.getUser()))
            : sessionGuard.start(nextUser);
        acceptUser(resolved);
        if (!resolved) selectCredentialSession("none");
    }, [sessionGuard, sessionRestore, credentialAttempts, acceptUser]);

    const updateUserForSession = useCallback((nextUser, session) => {
        if (!sessionGuard.updateForSession(nextUser, session)) return false;
        sessionRestore.invalidate();
        acceptUser(nextUser);
        resourceCache.invalidatePrefix(session.userId, "leaderboard:");
        return true;
    }, [sessionGuard, sessionRestore, acceptUser]);

    const restoreSession = useCallback((kind) => {
        if (kind === "oauth") credentialAttempts.invalidate();
        else if (credentialAttempts.isPending()) return Promise.resolve({ status: "stale" });
        return sessionRestore.restore(kind);
    }, [sessionRestore, credentialAttempts]);
    const beginCredentialAttempt = useCallback(() => {
        sessionRestore.invalidate();
        setLoading(false);
        return credentialAttempts.begin();
    }, [sessionRestore, credentialAttempts]);
    const cancelCredentialAttempt = useCallback((attempt) => {
        if (!credentialAttempts.cancel(attempt)) return;
        setLoading(false);
        // Restore the unchanged cookie session after closing/failing a form.
        sessionRestore.restore();
    }, [credentialAttempts, sessionRestore]);
    const invalidateCredentialAttempts = useCallback(() => {
        credentialAttempts.invalidate();
        invalidateCredentialIntent();
        sessionRestore.invalidate();
        sessionGuard.start(sessionGuard.getUser());
    }, [credentialAttempts, sessionRestore, sessionGuard]);
    const logout = useCallback(async () => {
        const selected = captureCredentialSession();
        // Keep the HttpOnly credential available for server-side revocation.
        selectCredentialSession("none", { discardPrevious: false });
        // Lock out pending credentials before the network request can yield.
        setUser(null);
        const session = sessionGuard.capture();
        const response = await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include",
            headers: { "X-StudyJony-Logout-Session": selected } });
        return response.ok && sessionGuard.isCurrent(session);
    }, [setUser, sessionGuard]);
    // Keep the existing getMe user/null contract for callers.
    const getMe = useCallback(async () => {
        const result = await restoreSession();
        return result.status === "success" ? result.user : null;
    }, [restoreSession]);

    // Concurrent initial/callback reads share the same confirmed session.
    useEffect(() => {
        let mounted = true;
        queueMicrotask(() => { if (mounted) getMe(); });
        return () => { mounted = false; sessionRestore.invalidate(); credentialAttempts.invalidate(); };
    }, [getMe, sessionRestore, credentialAttempts]);

    return (
        <AuthContext.Provider value={{ user, setUser, loading, getMe, restoreSession, logout,
            beginCredentialAttempt, invalidateCredentialAttempts,
            isCurrentCredentialAttempt: credentialAttempts.isCurrent,
            cancelCredentialAttempt,
            commitCredentialAttempt: credentialAttempts.commit,
            discardCredentialAttempt,
            captureSession: sessionGuard.capture, isCurrentSession: sessionGuard.isCurrent, updateUserForSession }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
