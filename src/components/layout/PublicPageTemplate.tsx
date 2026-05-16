import Image from "next/image";

interface PublicPageTemplateProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  compact?: boolean;
}

export function PublicPageTemplate({ title, subtitle, children, compact = false }: PublicPageTemplateProps) {
  return (
    <div className={compact ? "space-y-0" : "space-y-8"}>
      <section
        className="relative overflow-hidden rounded-3xl border border-blue-900/60 bg-cover bg-center px-6 py-8 text-white shadow-lg sm:px-10"
        style={{ backgroundImage: "url('/foto-molina.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#173072]/86 via-[#1e3a8a]/84 to-[#162f6f]/86" />
        <div className="relative z-10 flex flex-col items-center text-center">
          <Image
            src="/logo-molina.png"
            alt="Municipalidad de Molina"
            width={220}
            height={70}
            className="h-auto w-[190px] rounded-xl bg-white/95 p-2 shadow-md sm:w-[220px]"
            priority
          />
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-blue-100 sm:text-base">{subtitle}</p>
        </div>
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue-300/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-indigo-300/15 blur-2xl" />
      </section>

      <section className={compact ? "rounded-b-3xl border border-t-0 border-slate-200 bg-white p-4 shadow-sm sm:p-6" : "rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"}>
        {children}
      </section>
    </div>
  );
}
