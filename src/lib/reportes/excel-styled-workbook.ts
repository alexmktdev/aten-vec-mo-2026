import type { Workbook, Worksheet } from "exceljs";

export type CellVal = string | number | boolean | Date | null | undefined;

const BORDER = {
  top: { style: "thin" as const, color: { argb: "FF94A3B8" } },
  left: { style: "thin" as const, color: { argb: "FF94A3B8" } },
  bottom: { style: "thin" as const, color: { argb: "FF94A3B8" } },
  right: { style: "thin" as const, color: { argb: "FF94A3B8" } },
};

const HEADER_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FF1E3A8A" },
};

const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" }, size: 11, name: "Calibri" };

const SUBHEADER_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FF64748B" },
};

const ZEBRA_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFF1F5F9" },
};

const TOTAL_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFBFDBFE" },
};

const ACCENT_FILL = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFE0E7FF" },
};

function cellStr(v: CellVal): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function isBlankRow(row: CellVal[]): boolean {
  return row.every((c) => c === "" || c == null);
}

function isTotalRow(row: CellVal[]): boolean {
  const s = cellStr(row[0]).toUpperCase();
  return Boolean(s && (s.includes("TOTAL") || s.includes("TOTALES")));
}

/** Ancho de columna según contenido (límite razonable para legibilidad). */
function setColumnWidths(ws: Worksheet, rows: CellVal[][], maxCol: number, cap = 48, floor = 12) {
  for (let c = 1; c <= maxCol; c++) {
    let w = floor;
    for (const row of rows) {
      const v = row[c - 1];
      const len = cellStr(v).length;
      w = Math.min(cap, Math.max(w, Math.ceil(len * 0.92) + 3));
    }
    ws.getColumn(c).width = w;
  }
}

/**
 * Tabla con encabezado congelado, zebra, bordes, fila TOTAL resaltada.
 */
export function addAoATable(
  wb: Workbook,
  sheetName: string,
  rows: CellVal[][],
  options: {
    freezeHeader?: boolean;
    /** Columnas numéricas 1-based (para alinear derecha y formato). */
    numericCols?: Set<number>;
    /** Columnas de porcentaje (número ya viene como 45.2 = 45.2%) */
    percentCols?: Set<number>;
  } = {}
): void {
  const freezeHeader = options.freezeHeader !== false;
  const ws = wb.addWorksheet(sanitizeSheetName(sheetName), {
    views: [{ state: "frozen", ySplit: freezeHeader ? 1 : 0, activeCell: "A2", showGridLines: true }],
  });

  if (!rows.length) {
    ws.addRow(["Sin datos"]);
    return;
  }

  const maxCol = Math.max(...rows.map((r) => r.length), 1);
  const dataStart = freezeHeader ? 1 : 0;

  rows.forEach((raw, ri) => {
    const excelRow = ws.addRow(raw);
    const isHeader = freezeHeader && ri === 0;
    const blank = isBlankRow(raw);
    const total = !blank && isTotalRow(raw);

    if (blank) {
      excelRow.height = 6;
      return;
    }

    if (isHeader) {
      excelRow.height = 26;
      excelRow.eachCell({ includeEmpty: true }, (cell, ci) => {
        if (ci <= maxCol) {
          cell.fill = HEADER_FILL;
          cell.font = HEADER_FONT;
          cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
          cell.border = BORDER;
        }
      });
      return;
    }

    excelRow.height = 20;
    const bodyIndex = ri - dataStart;
    const zebra = bodyIndex > 0 && bodyIndex % 2 === 1;

    excelRow.eachCell({ includeEmpty: true }, (cell, ci) => {
      if (ci > maxCol) return;
      cell.border = BORDER;
      if (total) {
        cell.fill = TOTAL_FILL;
        cell.font = { bold: true, name: "Calibri", size: 11 };
      } else if (zebra) {
        cell.fill = ZEBRA_FILL;
      }
      const isNum = typeof cell.value === "number";
      const pctCol = options.percentCols?.has(ci);
      const numCol = options.numericCols?.has(ci);
      if (isNum) {
        cell.numFmt = pctCol ? "0.00" : "0.##";
        cell.alignment = { vertical: "middle", horizontal: "right", wrapText: true };
      } else {
        cell.alignment = {
          vertical: "middle",
          horizontal: ci === 1 ? "left" : "center",
          wrapText: true,
        };
      }
      if (numCol && isNum) {
        cell.alignment = { vertical: "middle", horizontal: "right", wrapText: true };
      }
    });
  });

  setColumnWidths(ws, rows, maxCol);
}

/** Tabla desde objetos (primera fila = claves legibles). */
export function addJsonTable(
  wb: Workbook,
  sheetName: string,
  records: Record<string, CellVal>[],
  headerLabels?: Record<string, string>,
  opts?: { numericKeys?: string[]; percentKeys?: string[] }
): void {
  if (!records.length) {
    const ws = wb.addWorksheet(sanitizeSheetName(sheetName));
    ws.addRow(["Sin datos en esta hoja"]);
    ws.getRow(1).font = { italic: true, color: { argb: "FF64748B" } };
    return;
  }
  const keys = Object.keys(records[0]);
  const headers = keys.map((k) => headerLabels?.[k] ?? k);
  const aoa: CellVal[][] = [
    headers,
    ...records.map((r) => keys.map((k) => r[k] ?? "")),
  ];
  const colIndex = (k: string) => keys.indexOf(k) + 1;
  const numericCols = new Set<number>();
  const percentCols = new Set<number>();
  for (const k of opts?.numericKeys ?? []) {
    const i = colIndex(k);
    if (i > 0) numericCols.add(i);
  }
  for (const k of opts?.percentKeys ?? []) {
    const i = colIndex(k);
    if (i > 0) percentCols.add(i);
  }
  addAoATable(wb, sheetName, aoa, {
    freezeHeader: true,
    numericCols: numericCols.size ? numericCols : undefined,
    percentCols: percentCols.size ? percentCols : undefined,
  });
}

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, "-").slice(0, 31);
  return cleaned || "Hoja";
}

/** Hoja de instrucciones con título y secciones claras. */
export function addInstruccionesSheet(wb: Workbook, instr: CellVal[][]): void {
  const ws = wb.addWorksheet("Instrucciones", {
    views: [{ showGridLines: false }],
  });

  let r = 1;
  const title = cellStr(instr[0]?.[0]) || "Exportación";
  ws.mergeCells(r, 1, r, 8);
  const titleRow = ws.getRow(r);
  titleRow.height = 36;
  const tc = titleRow.getCell(1);
  tc.value = title;
  tc.fill = HEADER_FILL;
  tc.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  tc.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  r += 2;

  for (let i = 1; i < instr.length; i++) {
    const row = instr[i];
    if (!row || isBlankRow(row)) {
      r += 1;
      continue;
    }
    const a = row[0];
    const b = row[1];
    if (b === undefined || b === "") {
      const line = ws.getRow(r);
      line.height = 22;
      const c = line.getCell(1);
      c.value = a ?? "";
      c.font = { size: 11, name: "Calibri" };
      c.alignment = { vertical: "top", horizontal: "left", wrapText: true };
      ws.mergeCells(r, 1, r, 8);
      r += 1;
      continue;
    }
    const line = ws.getRow(r);
    line.height = 20;
    const c1 = line.getCell(1);
    const c2 = line.getCell(2);
    c1.value = a ?? "";
    c2.value = b ?? "";
    c1.font = { bold: true, size: 11, name: "Calibri" };
    c2.font = { size: 11, name: "Calibri" };
    c1.fill = ACCENT_FILL;
    c1.border = BORDER;
    c2.border = BORDER;
    c1.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    c2.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    ws.mergeCells(r, 2, r, 8);
    r += 1;
  }

  ws.getColumn(1).width = 38;
  ws.getColumn(2).width = 72;
}

/** Matriz con primera fila y primera columna como encabezados (estilo distinto en esquina). */
export function addMatrixSheet(
  wb: Workbook,
  sheetName: string,
  matrix: CellVal[][],
  options: { percentBody?: boolean } = {}
): void {
  const ws = wb.addWorksheet(sanitizeSheetName(sheetName), {
    views: [{ state: "frozen", ySplit: 1, xSplit: 1, activeCell: "B2" }],
  });
  if (!matrix.length) return;

  const maxCol = Math.max(...matrix.map((row) => row.length), 1);

  matrix.forEach((raw, ri) => {
    const excelRow = ws.addRow(raw);
    const isHeaderRow = ri === 0;
    excelRow.height = isHeaderRow ? 24 : 20;

    excelRow.eachCell({ includeEmpty: true }, (cell, ci) => {
      if (ci > maxCol) return;
      cell.border = BORDER;
      const corner = ri === 0 && ci === 1;
      const topHeader = ri === 0 && ci > 1;
      const rowLabel = ri > 0 && ci === 1;

      if (corner || rowLabel) {
        cell.fill = SUBHEADER_FILL;
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Calibri" };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      } else if (topHeader) {
        cell.fill = HEADER_FILL;
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Calibri" };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      } else {
        const zebra = ri % 2 === 0;
        if (zebra) cell.fill = ZEBRA_FILL;
        const isLastCol = ci === maxCol;
        if (typeof cell.value === "number") {
          if (options.percentBody && !isLastCol) {
            cell.numFmt = "0.00";
            cell.alignment = { vertical: "middle", horizontal: "right" };
          } else {
            cell.numFmt = "0";
            cell.alignment = { vertical: "middle", horizontal: "right" };
          }
        } else {
          cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        }
      }
    });
  });

  setColumnWidths(ws, matrix, maxCol, 22, 14);
}

export async function newWorkbook(): Promise<Workbook> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema Atención al Vecino — Municipalidad";
  wb.created = new Date();
  wb.modified = new Date();
  return wb;
}

export async function workbookToBuffer(wb: Workbook): Promise<Buffer> {
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
