import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="max-w-md w-full text-center">
        <p className="text-8xl font-black text-slate-200 mb-4">404</p>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Página no encontrada</h2>
        <p className="text-slate-500 mb-6">La página que busca no existe o ha sido movida.</p>
        <Link href="/">
          <Button>Volver al inicio</Button>
        </Link>
      </div>
    </div>
  );
}
