// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsPdfDoc = any;
import {
  ESTADO_LABELS,
  type EstadoRequerimiento,
  type FichaPdfVariant,
  type RequerimientoDTO,
} from "@/types/requerimiento.types";
import { ROL_LABELS, type RolUsuario } from "@/types/usuario.types";
import { formatReporteFecha, formatReporteFechaYHora } from "@/lib/reportes/formato-fecha-reporte";

const BRAND_RGB: [number, number, number] = [30, 58, 138];

function getNextY(doc: JsPdfDoc, fallback: number): number {
  const finalY = (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
  return typeof finalY === "number" ? finalY + 6 : fallback;
}

function ensurePage(doc: JsPdfDoc, y: number, needed = 40): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 14) {
    doc.addPage();
    return 18;
  }
  return y;
}

function addHeader(doc: JsPdfDoc, tituloFicha: string, numeroSeguimiento: string) {
  const now = new Date();
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_RGB);
  doc.text("Ilustre Municipalidad de Molina", 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Sistema de Atención al Vecino", 14, 22);
  doc.setFontSize(14);
  doc.setTextColor(...BRAND_RGB);
  doc.text(tituloFicha, 14, 32);
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text(`N° de seguimiento: ${numeroSeguimiento}`, 14, 39);
  doc.text(`Documento generado: ${formatReporteFechaYHora(now)}`, 14, 45);
}

async function addKvTable(
  doc: JsPdfDoc,
  startY: number,
  sectionTitle: string,
  rows: [string, string][]
): Promise<number> {
  const { default: autoTable } = await import("jspdf-autotable");
  let y = ensurePage(doc, startY, 30);
  autoTable(doc, {
    startY: y,
    theme: "grid",
    headStyles: { fillColor: BRAND_RGB, fontSize: 9 },
    head: [[sectionTitle, ""]],
    body: rows.map(([label, value]) => [label, value || "—"]),
    styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
    columnStyles: {
      0: { cellWidth: 52, fontStyle: "bold", textColor: [51, 65, 85] },
      1: { cellWidth: "auto" },
    },
    margin: { left: 14, right: 14 },
  });
  return getNextY(doc, y + 20);
}

function nombreVecino(v: RequerimientoDTO["vecino"]): string {
  return [v.nombre, v.primerApellido, v.segundoApellido].filter(Boolean).join(" ");
}

function estadoLabel(estado: string): string {
  return ESTADO_LABELS[estado as EstadoRequerimiento] || estado;
}

function rolLabel(rol?: string): string {
  if (!rol) return "";
  return ROL_LABELS[rol as RolUsuario] || rol;
}

export async function buildRequerimientoFichaPdf(
  req: RequerimientoDTO,
  variant: FichaPdfVariant
): Promise<ArrayBuffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const tituloFicha =
    variant === "ingreso"
      ? "Ficha formal de ingreso de requerimiento"
      : "Ficha formal de requerimiento resuelto";

  addHeader(doc, tituloFicha, req.numeroSeguimiento);

  let y = 52;

  y = await addKvTable(doc, y, "Identificación del caso", [
    ["N° seguimiento", req.numeroSeguimiento],
    ["Tipo de requerimiento", req.tipoRequerimiento],
    ["Estado actual", estadoLabel(req.estado)],
    ["Dirección municipal", req.direccionMunicipalLabel || "Sin asignar"],
    ["Categoría", req.categoria || "—"],
  ]);

  y = await addKvTable(doc, y, "Datos del solicitante (vecino)", [
    ["Nombre completo", nombreVecino(req.vecino)],
    ["RUT", req.vecino.rut],
    ["Teléfono", req.vecino.telefono],
    ["Correo electrónico", req.vecino.email],
    ["Región", req.vecino.region],
    ["Comuna", req.vecino.comuna],
    ["Dirección", req.vecino.direccion],
    ["Tipo de inmueble", req.vecino.tipoInmueble],
  ]);

  y = await addKvTable(doc, y, "Detalle del requerimiento", [
    ["Fecha de ingreso", formatReporteFechaYHora(req.fechaIngreso)],
    ["Fecha límite", req.fechaLimite ? formatReporteFecha(req.fechaLimite) : "—"],
    [
      "Días hábiles restantes",
      req.diasHabilesRestantes !== undefined ? String(req.diasHabilesRestantes) : "—",
    ],
    ["Descripción", req.descripcion],
  ]);

  const documentos = req.documentos || [];
  if (documentos.length > 0) {
    y = await addKvTable(
      doc,
      y,
      "Documentos adjuntos al ingreso",
      documentos.map((d, i) => [
        `Documento ${i + 1}`,
        `${d.nombre} (${Math.round((d.tamanio || 0) / 1024)} KB)`,
      ])
    );
  }

  if (variant === "resuelto") {
    y = await addKvTable(doc, y, "Cierre y plazos", [
      ["Estado final", estadoLabel(req.estado)],
      [
        "Fecha de resolución",
        req.fechaResolucion ? formatReporteFechaYHora(req.fechaResolucion) : "—",
      ],
      [
        "Respuesta enviada al vecino",
        (req.respuestasVecino?.length ?? 0) > 0 ? "Sí" : "No",
      ],
    ]);

    const historial = [...(req.historialEstados || [])].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    );
    if (historial.length > 0) {
      const { default: autoTable } = await import("jspdf-autotable");
      y = ensurePage(doc, y, 40);
      autoTable(doc, {
        startY: y,
        theme: "striped",
        headStyles: { fillColor: BRAND_RGB, fontSize: 8 },
        head: [["Fecha", "Estado", "Registrado por", "Nota"]],
        body: historial.map((h) => {
          const autor = [h.usuarioNombre, h.usuarioRol ? rolLabel(h.usuarioRol) : ""]
            .filter(Boolean)
            .join(" • ");
          return [
            formatReporteFechaYHora(h.fecha),
            estadoLabel(h.estado),
            autor || "—",
            h.nota || "—",
          ];
        }),
        styles: { fontSize: 7, cellPadding: 1.8, overflow: "linebreak" },
        margin: { left: 14, right: 14 },
      });
      y = getNextY(doc, y + 24);
    }

    const notas = req.notas || [];
    if (notas.length > 0) {
      y = await addKvTable(
        doc,
        y,
        "Notas internas",
        notas.map((n, i) => {
          const autor = [n.usuarioNombre, n.usuarioRol ? rolLabel(n.usuarioRol) : ""]
            .filter(Boolean)
            .join(" • ");
          return [
            `Nota ${i + 1} (${formatReporteFechaYHora(n.fecha)})`,
            `${autor ? `${autor}: ` : ""}${n.contenido}`,
          ];
        })
      );
    }

    const respuestas = req.respuestasVecino || [];
    if (respuestas.length > 0) {
      y = await addKvTable(
        doc,
        y,
        "Respuestas enviadas al vecino",
        respuestas.flatMap((r, i) => [
          [`Respuesta ${i + 1} — fecha`, formatReporteFechaYHora(r.fecha)],
          [`Respuesta ${i + 1} — destino`, r.emailDestino],
          [`Respuesta ${i + 1} — asunto`, r.asunto],
          [`Respuesta ${i + 1} — mensaje`, r.mensaje],
        ])
      );
    }

    if (req.evidenciaResolucion) {
      const ev = req.evidenciaResolucion;
      const esDocumento = ev.tipo === "documento";
      y = await addKvTable(doc, y, "Evidencia de resolución", [
        ["Tipo", esDocumento ? "Documento PDF" : "Enlace"],
        ["Nombre / referencia", ev.nombre || ev.url],
        ["Fecha", ev.fecha ? formatReporteFechaYHora(ev.fecha) : "—"],
        [
          "Inclusión en este archivo",
          esDocumento
            ? "El PDF de evidencia se anexa a continuación en las páginas siguientes de este mismo documento."
            : "La evidencia es un enlace externo; no se puede incrustar como PDF en este archivo.",
        ],
      ]);
    }

    if (req.adminAsignadoRespuesta) {
      const a = req.adminAsignadoRespuesta;
      y = await addKvTable(doc, y, "Admin asignado (respuesta final)", [
        ["Nombre", a.nombre],
        ["Correo", a.email],
        ["Asignado el", formatReporteFechaYHora(a.asignadoEn)],
      ]);
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Municipalidad de Molina — Ficha ${variant === "ingreso" ? "de ingreso" : "resuelta"} — Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.getHeight() - 8
    );
  }

  return doc.output("arraybuffer") as ArrayBuffer;
}

export function buildFichaPdfFilename(
  numeroSeguimiento: string,
  variant: FichaPdfVariant
): string {
  const slug = numeroSeguimiento.replace(/[^\w-]+/g, "_");
  return variant === "ingreso"
    ? `ficha-ingreso-${slug}.pdf`
    : `ficha-resuelto-${slug}.pdf`;
}
