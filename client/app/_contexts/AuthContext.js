"use client";
import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); 

    async function getMe() {
        try {
            const res = await fetch("/api/v1/users/me", {
                credentials: "include", // Sends the cookie automatically
            });

            if (res.ok) {
                const data = await res.json();
                setUser(data.data.user); //  user = req.user
            } else {
                setUser(null); 
            }
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false); 
        }
    }

    // ✅ ADD THIS: Runs exactly ONCE when the app first loads
    useEffect(() => {
        getMe();
    }, []); 

    return (
        <AuthContext.Provider value={{ user, setUser, loading, getMe }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}