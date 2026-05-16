import { PublicLayout } from "@/components/layout/PublicLayout";
import { PublicPageTemplate } from "@/components/layout/PublicPageTemplate";
import { RequerimientoForm } from "@/components/forms/RequerimientoForm";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Atención al Vecino — Sistema de ingreso de requerimientos municipales",
  description: "Ingrese su requerimiento a la Municipalidad. Reclamos, sugerencias, solicitudes y más.",
};

export default function PublicHomePage() {
  return (
    <PublicLayout>
      <PublicPageTemplate
        title="Atención al Vecino"
        subtitle="Estamos para escuchar y resolver tus inquietudes en toda la comuna."
      >
        <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6 items-start">
          <aside className="self-start rounded-2xl bg-[#0f4a7f] p-6 text-white shadow-md">
            <h2 className="text-3xl font-extrabold tracking-tight">Canales de Atención</h2>
            <div className="mt-6 space-y-6 text-sm">
              <section>
                <p className="text-[11px] uppercase tracking-[0.18em] text-blue-200 font-bold">Ubicaciones</p>
                <p className="mt-2 font-semibold">Edificio Consistorial:</p>
                <p>Yerbas Buenas 1389, Molina.</p>
                <p className="mt-3 font-semibold">Delegación Lontué:</p>
                <p>Av. 7 de Abril s/n.</p>
              </section>
              <section className="border-t border-white/20 pt-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-blue-200 font-bold">Teléfonos</p>
                <p className="mt-2">Mesa Central: +56 75 276 0700</p>
                <p>Seguridad Pública: 1462</p>
              </section>
              <section className="border-t border-white/20 pt-4">
                <p>Horario: Lunes a Viernes de 08:30 a 14:00 hrs.</p>
              </section>
              <section className="border-t border-white/20 pt-4">
                <p className="text-blue-100 text-center">Si ya ingresaste un requerimiento, puedes consultar el estado acá.</p>
                <div className="mt-3 flex justify-center">
                  <Link
                    href="/seguimiento"
                    className="inline-flex rounded-xl bg-[#7db928] px-6 py-3 text-base font-extrabold text-white hover:bg-[#6eab20]"
                  >
                    Consultar Estado
                  </Link>
                </div>
              </section>
            </div>
          </aside>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-5 border-b border-slate-200 pb-4">
              <h2 className="text-3xl font-extrabold text-[#0f4a7f]">Envíanos tu Requerimiento</h2>
              <p className="mt-1 text-slate-600">Complete el formulario para gestionar su solicitud.</p>
            </div>
            <RequerimientoForm />
          </section>
        </div>
      </PublicPageTemplate>
    </PublicLayout>
  );
}
