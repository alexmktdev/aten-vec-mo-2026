"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { fetchJson, ApiClientError } from "@/lib/api/fetch-json";
import {
  PASSWORD_CONFIRM_PLACEHOLDER,
  PASSWORD_REQUIREMENTS_LABEL,
  PASSWORD_REQUIREMENTS_SHORT,
} from "@/constants/password-policy";

function getSubmitErrorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    const details = Array.isArray(err.details) ? err.details : [];
    const first = details.find(
      (item): item is { message?: string } =>
        typeof item === "object" && item !== null && typeof (item as { message?: string }).message === "string"
    );
    if (first?.message) return first.message;
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "No fue posible actualizar la contraseña.";
}

function RestablecerContrasenaContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("El enlace no es válido o está incompleto.");
      return;
    }

    setLoading(true);
    try {
      await fetchJson("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      setSuccess("Contraseña actualizada correctamente. Ya puede iniciar sesión.");
      setTimeout(() => router.push("/auth/login"), 1200);
    } catch (err) {
      setError(getSubmitErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef0f5] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
          <div className="text-center mb-8">
            <div className="w-52 h-16 mx-auto mb-5 overflow-hidden flex items-center justify-center">
              <Image src="/logo-molina.png" alt="Logo Municipalidad de Molina" width={208} height={64} className="object-contain" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Nueva Contraseña</h1>
            <p className="text-sm font-semibold text-blue-800 mt-2">Sistema de Atención al Vecino</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <Alert variant="error">{error}</Alert>}
            {success && <Alert variant="success">{success}</Alert>}

            <div className="space-y-1.5 relative">
              <label className="block text-sm font-semibold text-slate-700">Nueva contraseña</label>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 rounded-xl bg-white border border-slate-300 pl-4 pr-11 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                placeholder={PASSWORD_REQUIREMENTS_SHORT}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-[35px] text-slate-500 hover:text-slate-700 transition-colors"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="space-y-1.5 relative">
              <label className="block text-sm font-semibold text-slate-700">Confirmar contraseña</label>
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full h-11 rounded-xl bg-white border border-slate-300 pl-4 pr-11 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                placeholder={PASSWORD_CONFIRM_PLACEHOLDER}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute right-3 top-[35px] text-slate-500 hover:text-slate-700 transition-colors"
                aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <p className="text-xs text-slate-500">{PASSWORD_REQUIREMENTS_LABEL}</p>

            <Button type="submit" size="full" loading={loading} className="h-12 text-base font-semibold bg-blue-800 hover:bg-blue-900 shadow-[0_8px_16px_rgba(30,64,175,0.3)]">
              Guardar nueva contraseña
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/auth/login" className="text-base text-slate-800 hover:text-slate-900 transition-colors inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Volver al login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RestablecerContrasenaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#eef0f5]" />}>
      <RestablecerContrasenaContent />
    </Suspense>
  );
}
