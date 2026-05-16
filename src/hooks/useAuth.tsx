"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { SessionUser, AuthState } from "@/types/auth.types";
import { RolUsuario } from "@/types/usuario.types";

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const tokenResult = await firebaseUser.getIdTokenResult();
          const claims = tokenResult.claims;

          const user: SessionUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            nombre: firebaseUser.displayName || "",
            rol: (claims.rol as RolUsuario) || "director",
            direccionAsignada: claims.direccionAsignada as string | undefined,
            direccionAsignadas: Array.isArray(claims.direccionAsignadas)
              ? (claims.direccionAsignadas as string[])
              : claims.direccionAsignada
                ? [claims.direccionAsignada as string]
                : undefined,
          };

          setState({ user, loading: false, error: null });
        } catch {
          setState({ user: null, loading: false, error: "Error obteniendo datos de sesión" });
        }
      } else {
        setState({ user: null, loading: false, error: null });
      }
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();

      // Create server session cookie
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        throw new Error("Error al crear la sesión");
      }

      const data = await response.json();
      if (data.success) {
        setState({
          user: data.data,
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de autenticación";
      setState({ user: null, loading: false, error: message });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    let lastError: string | null = null;

    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Error al cerrar sesión";
    }

    try {
      await signOut(auth);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Error al cerrar sesión";
    } finally {
      setState({ user: null, loading: false, error: lastError });
      window.location.assign("/auth/login");
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
