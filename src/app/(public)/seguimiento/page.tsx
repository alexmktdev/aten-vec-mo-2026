import { PublicLayout } from "@/components/layout/PublicLayout";
import { PublicPageTemplate } from "@/components/layout/PublicPageTemplate";
import { SeguimientoForm } from "@/components/forms/SeguimientoForm";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Seguimiento de Requerimiento — Municipalidad",
  description: "Consulte el estado de su requerimiento ingresando su número de seguimiento y RUT.",
};

export default function SeguimientoPage() {
  return (
    <PublicLayout>
      <PublicPageTemplate
        title="Seguimiento del Requerimiento del Vecino"
        subtitle="Consulta el estado de tu requerimiento con número de seguimiento y RUT."
      >
        <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6 items-start">
          <aside className="self-start rounded-2xl bg-[#0f4a7f] p-6 text-white shadow-md">
            <h2 className="text-3xl font-extrabold tracking-tight">Canales de Atención</h2>
            <div className="mt-6 space-y-6 text-sm">
              <section>
                <p className="text-[11px] uppercase tracking-[0.18em] text-blue-200 font-bold">Asistencia</p>
                <p className="mt-2">Si no encuentras tu caso, verifica número y RUT.</p>
                <p className="mt-2">Para ayuda directa, contáctanos por mesa central.</p>
              </section>
              <section className="border-t border-white/20 pt-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-blue-200 font-bold">Teléfonos</p>
                <p className="mt-2">Mesa Central: +56 75 276 0700</p>
                <p>Seguridad Pública: +56 75 276 01462</p>
              </section>
              <section className="border-t border-white/20 pt-4">
                <p>Horario: Lunes a Viernes de 08:30 a 14:00 hrs.</p>
              </section>
              <section className="border-t border-white/20 pt-4">
                <p className="text-blue-100 text-center">¿Aún no has ingresado un requerimiento, hazlo acá?</p>
                <div className="mt-3 flex justify-center">
                  <Link
                    href="/"
                    className="inline-flex rounded-xl bg-red-600 px-6 py-3 text-base font-extrabold text-white hover:bg-red-700"
                  >
                    Ingresar Requerimiento
                  </Link>
                </div>
              </section>
            </div>
          </aside>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-5 border-b border-slate-200 pb-4">
              <h2 className="text-3xl font-extrabold text-[#0f4a7f]">Consulta tu Requerimiento</h2>
              <p className="mt-1 text-slate-600">Ingresa tus datos para revisar estado y plazos.</p>
            </div>
            <SeguimientoForm />
          </section>
        </div>
      </PublicPageTemplate>
    </PublicLayout>
  );
}
