import { requerimientoService } from "@/services/requerimiento.service";
import { RequerimientoDTO } from "@/types/requerimiento.types";
import { RequerimientoFilters } from "@/repositories/requerimiento.repository";

export const reporteService = {
  /**
   * Generate report data for requerimientos
   */
  async generateReportData(
    filters: RequerimientoFilters,
    direccionRestriccion?: string[]
  ): Promise<{ data: RequerimientoDTO[]; nextCursor?: string }> {
    if (filters.limit || filters.cursor) {
      return requerimientoService.list(filters, direccionRestriccion);
    }

    const data = await requerimientoService.getForReport(filters, direccionRestriccion);
    return { data };
  },
};
