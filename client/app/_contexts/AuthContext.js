"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createAuthSessionGuard } from "@/app/_lib/authSessionGuard.mjs";
import { createSessionRestore } from "@/app/_lib/sessionRestore.mjs";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setStoredUser] = useState(null);
    const [loading, setLoading] = useState(true); 
    const [sessionGuard] = useState(createAuthSessionGuard);
    const [sessionRestore] = useState(() => createSessionRestore({
        guard: sessionGuard,
        async loadUser(signal) {
            const res = await fetch("/api/v1/users/me", { credentials: "include", signal });
            if (!res.ok) return null;
            const data = await res.json();
            if (data?.status !== undefined && data.status !== "success") return null;
            return data?.data?.user || null;
        },
        onUser: setStoredUser,
        onLoading: setLoading,
    }));

    const setUser = useCallback((nextUser) => {
        sessionRestore.invalidate();
        const resolved = typeof nextUser === "function"
            ? sessionGuard.update(nextUser(sessionGuard.getUser()))
            : sessionGuard.start(nextUser);
        setStoredUser(resolved);
        setLoading(false);
    }, [sessionGuard, sessionRestore]);

    const updateUserForSession = useCallback((nextUser, session) => {
        if (!sessionGuard.updateForSession(nextUser, session)) return false;
        sessionRestore.invalidate();
        setStoredUser(nextUser);
        setLoading(false);
        return true;
    }, [sessionGuard, sessionRestore]);

    const restoreSession = useCallback((kind) => sessionRestore.restore(kind), [sessionRestore]);
    // Keep the existing getMe user/null contract for callers.
    const getMe = useCallback(async () => {
        const result = await restoreSession();
        return result.status === "success" ? result.user : null;
    }, [restoreSession]);

    // Concurrent initial/callback reads share the same confirmed session.
    useEffect(() => {
        let mounted = true;
        queueMicrotask(() => { if (mounted) getMe(); });
        return () => { mounted = false; sessionRestore.invalidate(); };
    }, [getMe, sessionRestore]);

    return (
        <AuthContext.Provider value={{ user, setUser, loading, getMe, restoreSession,
            captureSession: sessionGuard.capture, isCurrentSession: sessionGuard.isCurrent, updateUserForSession }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
