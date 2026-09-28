"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setStoredUser] = useState(null);
    const [loading, setLoading] = useState(true); 
    const requestId = useRef(0);

    const setUser = useCallback((nextUser) => {
        requestId.current += 1;
        setStoredUser(nextUser);
        setLoading(false);
    }, []);

    const getMe = useCallback(async () => {
        const currentRequest = ++requestId.current;
        setLoading(true);
        try {
            const res = await fetch("/api/v1/users/me", {
                credentials: "include", // Sends the cookie automatically
            });

            if (res.ok) {
                const data = await res.json();
                if (currentRequest === requestId.current) setStoredUser(data.data.user);
                return data.data.user;
            } else {
                if (currentRequest === requestId.current) setStoredUser(null);
                return null;
            }
        } catch (error) {
            if (currentRequest === requestId.current) setStoredUser(null);
            return null;
        } finally {
            if (currentRequest === requestId.current) setLoading(false);
        }
    }, []);

    // ✅ ADD THIS: Runs exactly ONCE when the app first loads
    useEffect(() => {
        queueMicrotask(getMe);
    }, [getMe]);

    return (
        <AuthContext.Provider value={{ user, setUser, loading, getMe }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
