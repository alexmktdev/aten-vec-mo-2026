"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { fetchJson } from "@/lib/api/fetch-json";

export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await fetchJson("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible enviar el correo de recuperación.");
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
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Recuperar Contraseña</h1>
            <p className="text-sm font-semibold text-blue-800 mt-2">
              Sistema de Atención al Vecino
            </p>
          </div>
          {sent ? (
            <Alert variant="success" title="Correo enviado" className="flex-col items-center text-center">
              Se ha enviado un enlace de recuperación a <strong>{email}</strong>.
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && <Alert variant="error">{error}</Alert>}
              <p className="text-sm text-slate-700 text-center">
                Ingrese su correo electrónico y te enviaremos un enlace para restablecer su cuenta.
              </p>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 rounded-xl bg-white border border-slate-300 px-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="correo@molina.cl"
                  required
                />
              </div>
              <Button type="submit" size="full" loading={loading} className="h-12 text-base font-semibold bg-blue-800 hover:bg-blue-900 shadow-[0_8px_16px_rgba(30,64,175,0.3)]">
                Enviar enlace
              </Button>
            </form>
          )}
          <div className="mt-4 text-center">
            <Link href="/auth/login" className="text-base text-slate-800 hover:text-slate-900 transition-colors inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Volver al login
            </Link>
          </div>
          <div className="mt-7 text-center text-sm text-slate-700">
            © 2026 MUNICIPALIDAD DE MOLINA · ATENCIÓN AL VECINO
          </div>
        </div>
      </div>
    </div>
  );
}
