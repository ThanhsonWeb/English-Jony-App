"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createAuthSessionGuard } from "@/app/_lib/authSessionGuard.mjs";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setStoredUser] = useState(null);
    const [loading, setLoading] = useState(true); 
    const requestId = useRef(0);
    const [sessionGuard] = useState(createAuthSessionGuard);

    const setUser = useCallback((nextUser) => {
        requestId.current += 1;
        const resolved = typeof nextUser === "function"
            ? sessionGuard.update(nextUser(sessionGuard.getUser()))
            : sessionGuard.start(nextUser);
        setStoredUser(resolved);
        setLoading(false);
    }, [sessionGuard]);

    const updateUserForSession = useCallback((nextUser, session) => {
        if (!sessionGuard.updateForSession(nextUser, session)) return false;
        requestId.current += 1;
        setStoredUser(nextUser);
        setLoading(false);
        return true;
    }, [sessionGuard]);

    const getMe = useCallback(async () => {
        const currentRequest = ++requestId.current;
        const session = sessionGuard.capture();
        setLoading(true);
        try {
            const res = await fetch("/api/v1/users/me", {
                credentials: "include", // Sends the cookie automatically
            });

            if (res.ok) {
                const data = await res.json();
                if (currentRequest !== requestId.current || !sessionGuard.isCurrent(session)) return null;
                setStoredUser(sessionGuard.update(data.data.user));
                return data.data.user;
            } else {
                if (currentRequest === requestId.current && sessionGuard.isCurrent(session)) setStoredUser(sessionGuard.update(null));
                return null;
            }
        } catch (error) {
            if (currentRequest === requestId.current && sessionGuard.isCurrent(session)) setStoredUser(sessionGuard.update(null));
            return null;
        } finally {
            if (currentRequest === requestId.current) setLoading(false);
        }
    }, [sessionGuard]);

    // ✅ ADD THIS: Runs exactly ONCE when the app first loads
    useEffect(() => {
        queueMicrotask(getMe);
    }, [getMe]);

    return (
        <AuthContext.Provider value={{ user, setUser, loading, getMe,
            captureSession: sessionGuard.capture, isCurrentSession: sessionGuard.isCurrent, updateUserForSession }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
