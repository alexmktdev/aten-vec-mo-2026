"use client";

export function DirectorHomePanel() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-5xl items-center justify-center px-6 xl:px-4">
      <section className="w-full max-w-4xl py-8 text-left">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.24em] text-blue-800">
          Municipalidad de Molina
        </p>
        <h1 className="mt-3 text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Sistema de Atención al Vecino
        </h1>
        <p className="mx-auto mt-5 max-w-3xl text-justify text-sm leading-7 text-slate-600 sm:text-base">
          Esta plataforma permite <span className="font-semibold text-blue-900">registrar, organizar, derivar y dar seguimiento</span> a los
          requerimientos ingresados por la comunidad, facilitando la coordinación entre las distintas áreas municipales y mejorando
          la trazabilidad de cada caso desde su ingreso hasta su cierre.
        </p>
        <p className="mx-auto mt-4 max-w-3xl text-justify text-sm leading-7 text-slate-600 sm:text-base">
          En el sistema es posible revisar estados, consultar antecedentes de los vecinos, mantener seguimiento de plazos,
          gestionar evidencias, visualizar usuarios registrados y asegurar que cada solicitud avance dentro del flujo definido,
          con una visión más ordenada del trabajo diario de cada dirección municipal.
        </p>
        <p className="mx-auto mt-4 max-w-3xl text-justify text-sm leading-7 text-slate-600 sm:text-base">
          El flujo completo de un requerimiento comienza cuando un vecino registra su solicitud en la plataforma. Luego, el caso
          ingresa al sistema para su revisión, se asigna o deriva a la dirección municipal correspondiente, pasa por las etapas de
          gestión interna y seguimiento, puede incorporar observaciones o evidencias, y finalmente avanza hasta su cierre como
          <span className="font-semibold text-emerald-700"> requerimiento completado</span> o
          <span className="font-semibold text-rose-700"> rechazado</span>, dejando siempre trazabilidad de las acciones realizadas.
        </p>
        <p className="mx-auto mt-4 max-w-3xl text-justify text-sm leading-7 text-slate-600 sm:text-base">
          La plataforma también ayuda a mantener un control más claro de los tiempos de respuesta, del historial de cada gestión,
          de las derivaciones entre áreas y del respaldo documental que acompaña cada solicitud, reduciendo pérdidas de información
          y mejorando la continuidad del trabajo institucional.
        </p>
        <p className="mx-auto mt-4 max-w-3xl text-justify text-sm leading-7 text-slate-600 sm:text-base">
          Además, el sistema permite que cada requerimiento quede asociado a un contexto claro: quién lo ingresó, a qué dirección fue
          enviado, qué acciones se realizaron, qué documentos o evidencias se adjuntaron, cuánto tiempo lleva en curso y cuál fue la
          resolución final adoptada por el municipio. Esto favorece una gestión más transparente, consistente y fácil de auditar.
        </p>
        <p className="mx-auto mt-4 max-w-3xl text-justify text-sm leading-7 text-slate-600 sm:text-base">
          Desde la perspectiva operativa, la plataforma sirve como un punto de encuentro entre atención ciudadana, administración y
          direcciones municipales, ayudando a ordenar prioridades, distribuir cargas de trabajo y evitar que las solicitudes queden
          sin seguimiento o sin una respuesta formal.
        </p>
        <p className="mx-auto mt-4 max-w-3xl text-justify text-sm leading-7 text-slate-600 sm:text-base">
          Desde su perfil de director puede trabajar especialmente en <strong className="text-blue-900">Requerimientos</strong> y consultar la sección de
          <strong className="text-amber-700"> Usuarios</strong>, con una navegación simplificada y enfocada en las funciones que necesita
          para su gestión diaria.
        </p>
      </section>
    </div>
  );
}
