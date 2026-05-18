"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch {
      setError("Credenciales incorrectas. Verifique su correo y contraseña.");
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
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Acceso al Sistema</h1>
            <p className="text-sm font-semibold text-blue-800 mt-2">
              Sistema de Atención al Vecino
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <Alert variant="error">{error}</Alert>}
            <div className="space-y-1.5 relative">
              <label className="block text-sm font-semibold text-slate-700">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full h-11 rounded-xl bg-white border border-slate-300 px-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="correo@molina.cl"
                required
              />
            </div>
            <div className="space-y-1.5 relative">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-slate-700">Contraseña</label>
                <Link href="/auth/recuperar-contrasena" className="text-xs text-blue-700 hover:text-blue-800 transition-colors">
                  ¿Olvidó su contraseña?
                </Link>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full h-11 rounded-xl bg-white border border-slate-300 pl-4 pr-11 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={loading}
                className="absolute right-3 top-[37px] text-slate-500 hover:text-slate-700 transition-colors disabled:pointer-events-none disabled:opacity-40"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              type="submit"
              size="full"
              loading={loading}
              className="h-12 text-base font-semibold bg-blue-800 hover:bg-blue-900 shadow-[0_8px_16px_rgba(30,64,175,0.3)]"
            >
              {loading ? "Iniciando sesión" : "Iniciar sesión"}
            </Button>
          </form>
          <div className="mt-7 text-center text-sm text-slate-700">
            © 2026 MUNICIPALIDAD DE MOLINA · ATENCIÓN AL VECINO
          </div>
        </div>

        <p className="text-center text-sm text-slate-500 mt-4">
          <Link href="/" className="hover:text-slate-700 transition-colors">← Volver al sitio público</Link>
        </p>
      </div>
    </div>
  );
}
