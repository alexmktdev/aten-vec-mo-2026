"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useRequerimiento,
  useUpdateRequerimiento,
  useUpdateRequerimientoDatos,
  useDerivarRequerimiento,
  useDeleteRequerimiento,
  useEnviarRespuestaVecino,
  useDeleteEvidenciaResolucion,
  useDerivarRespuestaFinal,
  useRevertirEstado,
} from "@/hooks/useRequerimientos";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { RequerimientoStatusBadge } from "@/components/features/requerimientos/RequerimientoStatusBadge";
import { AlertaVencimiento } from "@/components/features/requerimientos/AlertaVencimiento";
import {
  ESTADO_LABELS,
  ESTADOS_REQUERIMIENTO,
  EstadoRequerimiento,
  ESTADOS_PERMITEN_EVIDENCIA,
  requiereRespuestaFinalPorAdmin,
  usaRespuestaAutomaticaAdminCompletado,
} from "@/types/requerimiento.types";
import { RequerimientoCreateInput } from "@/lib/validations/requerimiento.schema";
import { ArrowLeft, Loader2, Mail, Pencil, Send, Trash2, Undo2, Users } from "lucide-react";
import {
  canDeleteRequerimiento,
  canDerivarRequerimiento,
  canDerivarRespuestaFinal,
  canEditRequerimientoData,
  canEnviarRespuestaFinal,
  canRevertirEstado,
  puedeRevertirEstadoPorDatos,
  getAllowedNextStates,
} from "@/lib/requerimiento-permissions";
import { esRolAdminPlataforma } from "@/types/usuario.types";
import { ApiClientError } from "@/lib/api/fetch-json";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { EvidenciaResolucionForm } from "@/components/features/requerimientos/EvidenciaResolucionForm";
import type { CierreRespuesta } from "@/components/features/requerimientos/RespuestaVecinoModal";

const DerivacionModal = dynamic(
  () => import("@/components/features/requerimientos/DerivacionModal").then((mod) => mod.DerivacionModal),
  { ssr: false }
);

const RespuestaVecinoModal = dynamic(
  () => import("@/components/features/requerimientos/RespuestaVecinoModal").then((mod) => mod.RespuestaVecinoModal),
  { ssr: false }
);

const EditarRequerimientoModal = dynamic(
  () => import("@/components/features/requerimientos/EditarRequerimientoModal").then((mod) => mod.EditarRequerimientoModal),
  { ssr: false }
);

const DerivarRespuestaFinalModal = dynamic(
  () =>
    import("@/components/features/requerimientos/DerivarRespuestaFinalModal").then(
      (mod) => mod.DerivarRespuestaFinalModal
    ),
  { ssr: false }
);

export default function RequerimientoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useAuth();
  const { data: req, isLoading, error } = useRequerimiento(id);
  const updateMutation = useUpdateRequerimiento();
  const updateDatosMutation = useUpdateRequerimientoDatos();
  const derivarMutation = useDerivarRequerimiento();
  const deleteMutation = useDeleteRequerimiento();
  const respuestaMutation = useEnviarRespuestaVecino();
  const deleteEvidenciaMutation = useDeleteEvidenciaResolucion();
  const derivarFinalMutation = useDerivarRespuestaFinal();
  const revertirMutation = useRevertirEstado();

  const [newEstado, setNewEstado] = useState("");
  const [nota, setNota] = useState("");
  const [showEditar, setShowEditar] = useState(false);
  const [showDerivar, setShowDerivar] = useState(false);
  const [showDerivarFinal, setShowDerivarFinal] = useState(false);
  const [showRespuesta, setShowRespuesta] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRevertirConfirm, setShowRevertirConfirm] = useState(false);
  const [showConfirmCierreEstado, setShowConfirmCierreEstado] = useState(false);
  const [showPendienteEvidenciaModal, setShowPendienteEvidenciaModal] = useState(false);
  const [pendienteEvidenciaNota, setPendienteEvidenciaNota] = useState<string | undefined>();
  const [pendienteEvidenciaActionLoading, setPendienteEvidenciaActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setNewEstado("");
    setNota("");
  }, [id]);

  const hasRespuestaVecino = !!req && (req.respuestasVecino?.length || 0) > 0;
  const estadoAnteriorReapertura =
    req &&
    (req.estado === "completado" || req.estado === "rechazado") &&
    !hasRespuestaVecino &&
    (req.historialEstados?.length ?? 0) >= 2
      ? (req.historialEstados[req.historialEstados.length - 2]!.estado as EstadoRequerimiento)
      : undefined;
  const estadoTransitionContext = {
    hasRespuestaVecino,
    estadoAnteriorReapertura,
    tipoRequerimiento: req?.tipoRequerimiento,
  };
  const tipo = req?.tipoRequerimiento;
  const esTipoRespuestaAdmin = !!tipo && requiereRespuestaFinalPorAdmin(tipo);

  const canDerivar =
    !!user && !!req && canDerivarRequerimiento(user.rol, req.tipoRequerimiento) && req.estado === "pendiente";
  const canDelete = !!user && canDeleteRequerimiento(user.rol);
  const canEditarDatos = !!user && !!req && canEditRequerimientoData(user.rol, req.estado, req.tipoRequerimiento);
  const muestraBotonEditarDatos =
    !!user &&
    !!req &&
    (user.rol === "superadmin" ||
      esRolAdminPlataforma(user.rol) ||
      user.rol === "administradora-municipal");
  const isAdmin = !!user && esRolAdminPlataforma(user.rol);
  const allowedNextStates =
    !!user && !!req ? getAllowedNextStates(user.rol, req.estado, estadoTransitionContext) : [];
  const canChangeEstado =
    allowedNextStates.length > 0 &&
    !(hasRespuestaVecino && (req?.estado === "completado" || req?.estado === "rechazado"));

  const puedeDerivarFinal = !!user && !!req && canDerivarRespuestaFinal(user, req);
  const puedeEnviarRespuestaFinal = !!user && !!req && canEnviarRespuestaFinal(user, req);
  const puedeRevertirDatos = !!req && puedeRevertirEstadoPorDatos(req);
  const puedeRevertir = !!user && !!req && canRevertirEstado(user.rol, req);
  const esSuperadmin = user?.rol === "superadmin";

  const evidenciaPermitida =
    !!req && ESTADOS_PERMITEN_EVIDENCIA.includes(req.estado);
  const evidenciaPuedeGestionar =
    !!user && evidenciaPermitida && (user.rol === "director" || user.rol === "superadmin");

  const isProcessingAction =
    updateMutation.isPending ||
    derivarMutation.isPending ||
    respuestaMutation.isPending ||
    deleteMutation.isPending ||
    updateDatosMutation.isPending ||
    derivarFinalMutation.isPending ||
    revertirMutation.isPending ||
    pendienteEvidenciaActionLoading;

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof ApiClientError) {
      const details = Array.isArray(err.details) ? err.details : [];
      const firstIssue = details.length > 0 && typeof details[0]?.message === "string" ? details[0].message : null;
      return firstIssue || err.message || "Error al actualizar el requerimiento";
    }
    if (err instanceof Error) return err.message;
    return "Error al actualizar el requerimiento";
  };

  const handleUpdateEstado = async () => {
    if (!req) return;
    if (!newEstado && !nota) return;
    const estadoEnviar = newEstado ? (newEstado as EstadoRequerimiento) : undefined;

    if (
      estadoEnviar === "pendiente" &&
      (req.estado === "en_proceso" ||
        req.estado === "en_espera_1" ||
        req.estado === "en_espera_2") &&
      req.evidenciaResolucion
    ) {
      setPendienteEvidenciaNota(nota.trim() || undefined);
      setShowPendienteEvidenciaModal(true);
      return;
    }

    if (estadoEnviar === "completado" || estadoEnviar === "rechazado") {
      setShowConfirmCierreEstado(true);
      return;
    }

    setErrorMsg("");
    try {
      await updateMutation.mutateAsync({
        id,
        estado: estadoEnviar,
        nota: nota || undefined,
      });
      setSuccessMsg("Requerimiento actualizado");
      setNewEstado("");
      setNota("");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  const handleConfirmPendienteConEliminarEvidencia = async () => {
    if (!req) return;
    setErrorMsg("");
    setPendienteEvidenciaActionLoading(true);
    try {
      await deleteEvidenciaMutation.mutateAsync(id);
      await updateMutation.mutateAsync({
        id,
        estado: "pendiente",
        nota: pendienteEvidenciaNota,
      });
      setShowPendienteEvidenciaModal(false);
      setPendienteEvidenciaNota(undefined);
      setNewEstado("");
      setNota("");
      setSuccessMsg("Evidencia eliminada y requerimiento vuelto a pendiente");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
      setShowPendienteEvidenciaModal(false);
    } finally {
      setPendienteEvidenciaActionLoading(false);
    }
  };

  const handleDerivar = async (payload: { direccionMunicipal: string; emailDestinatario: string }) => {
    setErrorMsg("");
    try {
      await derivarMutation.mutateAsync({ id, ...payload });
      setSuccessMsg("Requerimiento derivado exitosamente");
      setNewEstado("");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  const handleDerivarRespuestaFinal = async (payload: { adminUid: string; nota?: string }) => {
    setErrorMsg("");
    try {
      await derivarFinalMutation.mutateAsync({ id, ...payload });
      setSuccessMsg("Requerimiento derivado al admin para respuesta final");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
      throw err;
    }
  };

  const handleEnviarRespuesta = async (payload: {
    emailDestino: string;
    asunto: string;
    mensaje: string;
    cierre?: CierreRespuesta;
  }) => {
    setErrorMsg("");
    try {
      await respuestaMutation.mutateAsync({ id, payload });
      setSuccessMsg("Correo de respuesta enviado y registrado en el requerimiento");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
      throw err;
    }
  };

  const handleConfirmCierreEstado = async () => {
    if (!req) return;
    const estadoEnviar = newEstado ? (newEstado as EstadoRequerimiento) : undefined;
    if (estadoEnviar !== "completado" && estadoEnviar !== "rechazado") {
      setShowConfirmCierreEstado(false);
      return;
    }
    setErrorMsg("");
    setShowConfirmCierreEstado(false);
    try {
      await updateMutation.mutateAsync({
        id,
        estado: estadoEnviar,
        nota: nota || undefined,
      });
      setSuccessMsg("Requerimiento actualizado");
      setNewEstado("");
      setNota("");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    }
  };

  const handleRevertir = async () => {
    setErrorMsg("");
    try {
      const result = await revertirMutation.mutateAsync(id);
      setShowRevertirConfirm(false);
      setSuccessMsg(
        `Estado revertido: ${ESTADO_LABELS[result.estadoAntes]} → ${ESTADO_LABELS[result.estadoDespues]}`
      );
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
      setShowRevertirConfirm(false);
    }
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(id);
    setShowDeleteConfirm(false);
    router.push("/requerimientos");
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-slate-100 rounded w-48" />
        <div className="h-64 bg-slate-100 rounded-2xl" />
      </div>
    );
  }

  if (error || !req) {
    return <Alert variant="error">Requerimiento no encontrado</Alert>;
  }

  const estadoOptions = req && user
    ? [req.estado, ...getAllowedNextStates(user.rol, req.estado, estadoTransitionContext)]
        .filter((estado, index, arr) => arr.indexOf(estado) === index)
        .map((estado) => ({ value: estado, label: ESTADO_LABELS[estado] }))
    : ESTADOS_REQUERIMIENTO.map((e) => ({ value: e, label: ESTADO_LABELS[e] }));

  const handleActualizarDatos = async (payload: RequerimientoCreateInput) => {
    await updateDatosMutation.mutateAsync({ id, payload });
    setSuccessMsg("Datos del requerimiento actualizados exitosamente");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const requireCierreEnRespuesta = !(req.estado === "completado" || req.estado === "rechazado");
  const autoMensajeSiCompletado =
    !!tipo && usaRespuestaAutomaticaAdminCompletado(tipo) && requireCierreEnRespuesta;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
          <h1 className="admin-title">{req.numeroSeguimiento}</h1>
          <RequerimientoStatusBadge estado={req.estado} />
        </div>
        {isAdmin && req.estado === "pendiente" && canDerivar && (
          <Alert variant="info">
            <p className="text-sm">
              Para pasar este requerimiento a «{ESTADO_LABELS.derivado}», use el botón{" "}
              <strong>Derivar</strong> en el panel de acciones. Al derivar se enviará el correo a la
              dirección correspondiente y el estado cambiará automáticamente.
            </p>
          </Alert>
        )}
        {isAdmin && req.estado === "pendiente" && !canDerivar && (
          <Alert>
            <p className="text-sm text-slate-700">
              Este requerimiento es de tipo <strong>{req.tipoRequerimiento}</strong> y le corresponde
              gestionar la derivación a otro rol de administración. Usted lo verá pero no puede
              derivarlo.
            </p>
          </Alert>
        )}
        {isAdmin && req.estado !== "pendiente" && req.estado !== "derivado_respuesta_final" && (
          <Alert>
            <p className="text-sm text-slate-700">
              Como administrador, usted no puede modificar el estado manualmente. Si la derivación fue
              incorrecta, el director de la dirección asignada puede devolver el requerimiento a «{ESTADO_LABELS.pendiente}»
              para que pueda derivar nuevamente.
            </p>
          </Alert>
        )}
        {req.estado === "derivado_respuesta_final" && req.adminAsignadoRespuesta && (
          <Alert variant="info">
            <p className="text-sm">
              Derivado a <strong>{req.adminAsignadoRespuesta.nombre}</strong> (
              {req.adminAsignadoRespuesta.email}) para enviar la respuesta final al vecino. Use el botón{" "}
              <strong>Respuesta final al requerimiento</strong>: ahí elige Completado o Rechazado y se envía el
              correo; el estado se actualiza automáticamente al confirmar el envío.
            </p>
          </Alert>
        )}
      </div>

      <AlertaVencimiento diasHabilesRestantes={req.diasHabilesRestantes} vencido={req.vencido} />
      {successMsg && <Alert variant="success">{successMsg}</Alert>}
      {errorMsg && <Alert variant="error">{errorMsg}</Alert>}
      {esSuperadmin &&
        req &&
        (req.estado === "completado" || req.estado === "rechazado") &&
        !hasRespuestaVecino &&
        puedeRevertirDatos && (
          <Alert variant="info">
            <p className="text-sm">
              Si marcó «{ESTADO_LABELS[req.estado]}» por error y <strong>aún no envió el correo al vecino</strong>,
              use <strong>Revertir último cambio de estado</strong> para volver al paso anterior, o elige en{" "}
              <strong>Cambiar estado</strong> el estado previo si aparece en la lista.
            </p>
          </Alert>
        )}
      {isProcessingAction && (
        <Alert>
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Procesando solicitud. Unos segundos por favor.
          </span>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Datos del Vecino</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><dt className="text-slate-500">Nombre</dt><dd className="font-medium">{req.vecino.nombre} {req.vecino.primerApellido} {req.vecino.segundoApellido || ""}</dd></div>
                <div><dt className="text-slate-500">RUT</dt><dd className="font-medium">{req.vecino.rut}</dd></div>
                <div><dt className="text-slate-500">Email</dt><dd className="font-medium">{req.vecino.email}</dd></div>
                <div><dt className="text-slate-500">Teléfono</dt><dd className="font-medium">{req.vecino.telefono}</dd></div>
                <div><dt className="text-slate-500">Dirección</dt><dd className="font-medium">{req.vecino.direccion}</dd></div>
                <div><dt className="text-slate-500">Comuna</dt><dd className="font-medium">{req.vecino.comuna}, {req.vecino.region}</dd></div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Datos del Requerimiento</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
                <div><dt className="text-slate-500">Tipo</dt><dd className="font-medium">{req.tipoRequerimiento}</dd></div>
                <div>
                  <dt className="text-slate-500">Dirección Municipal</dt>
                  <dd className="font-medium">{req.direccionMunicipalLabel || "Pendiente de derivación"}</dd>
                </div>
                <div><dt className="text-slate-500">Fecha Ingreso</dt><dd className="font-medium">{new Date(req.fechaIngreso).toLocaleDateString("es-CL")}</dd></div>
                <div><dt className="text-slate-500">Fecha Límite</dt><dd className="font-medium">{new Date(req.fechaLimite).toLocaleDateString("es-CL")}</dd></div>
                <div><dt className="text-slate-500">Días Hábiles Restantes</dt><dd className="font-medium">{req.vencido ? "Vencido" : req.diasHabilesRestantes}</dd></div>
              </dl>
              <div><p className="text-sm text-slate-500 mb-1">Descripción</p><p className="text-sm">{req.descripcion}</p></div>
            </CardContent>
          </Card>

          {/* Documentos */}
          {req.documentos && req.documentos.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Documentos Adjuntos</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {req.documentos.map((doc, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">{doc.nombre}</p>
                          <p className="text-xs text-slate-500">{(doc.tamanio / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <a
                        href={`/api/documentos?key=${encodeURIComponent(doc.nombreR2)}&requerimientoId=${encodeURIComponent(req.id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 font-medium hover:text-blue-800 px-3 py-1 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                      >
                        Ver / Descargar
                      </a>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Evidencia de resolución */}
          {evidenciaPuedeGestionar && (
            <EvidenciaResolucionForm
              requerimientoId={req.id}
              canManage
              evidenciaExistente={req.evidenciaResolucion}
            />
          )}
          {!evidenciaPuedeGestionar && req.evidenciaResolucion && (
            <EvidenciaResolucionForm
              requerimientoId={req.id}
              evidenciaExistente={req.evidenciaResolucion}
            />
          )}

          {/* Historial */}
          <Card id="historial-estados">
            <CardHeader><CardTitle>Historial de Estados</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {req.historialEstados.map((h, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                    <div>
                      <p className="font-medium">{ESTADO_LABELS[h.estado as EstadoRequerimiento] || h.estado}</p>
                      <p className="text-xs text-slate-400">{new Date(h.fecha).toLocaleString("es-CL")}</p>
                      {h.nota && <p className="text-xs text-slate-500 mt-0.5">{h.nota}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Acciones</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {canChangeEstado && (
                <>
                  <Select
                    label="Cambiar estado"
                    options={estadoOptions}
                    value={newEstado || req.estado}
                    onChange={(e) => setNewEstado(e.target.value)}
                    placeholder="Seleccione nuevo estado"
                  />
                  <Textarea
                    label="Nota (opcional)"
                    rows={3}
                    maxLength={1000}
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    placeholder="Agregar nota al cambio..."
                  />
                  <Button
                    size="full"
                    onClick={handleUpdateEstado}
                    loading={updateMutation.isPending}
                    disabled={
                      updateMutation.isPending ||
                      (!nota.trim() && (!newEstado || newEstado === req.estado))
                    }
                  >
                    Guardar cambios
                  </Button>
                </>
              )}
              {!canChangeEstado && hasRespuestaVecino && (req.estado === "completado" || req.estado === "rechazado") && (
                <Alert variant="warning">
                  <p className="text-sm">
                    Ya se envió una respuesta al vecino. El estado del requerimiento no se puede modificar.
                  </p>
                </Alert>
              )}

              {muestraBotonEditarDatos && (
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="full"
                    disabled={!canEditarDatos || updateDatosMutation.isPending}
                    title={
                      canEditarDatos
                        ? undefined
                        : req.estado === "completado" || req.estado === "rechazado"
                          ? "No puede editar datos completos en completado o rechazado. Si aún no envió correo al vecino, vuelva primero a «En proceso de solución»."
                          : !!user && (esRolAdminPlataforma(user.rol) || user.rol === "administradora-municipal")
                            ? `Solo puede editar datos completos con el requerimiento en «${ESTADO_LABELS.pendiente}» y siempre que el tipo le corresponda. Si ya derivó, espere a que un director devuelva el caso a pendiente.`
                            : undefined
                    }
                    onClick={() => {
                      if (canEditarDatos) setShowEditar(true);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" /> Editar datos completos
                  </Button>
                </div>
              )}

              {canDerivar && (
                <Button
                  variant="secondary"
                  size="full"
                  onClick={() => setShowDerivar(true)}
                >
                  <Send className="h-4 w-4 mr-2" /> Derivar
                </Button>
              )}

              {/* Derivar para respuesta final (Información/Reclamo/… desde proceso) */}
              {esTipoRespuestaAdmin && puedeDerivarFinal && (
                <Button
                  variant="secondary"
                  size="full"
                  onClick={() => setShowDerivarFinal(true)}
                  className="bg-purple-100 text-purple-900 hover:bg-purple-200"
                >
                  <Users className="h-4 w-4 mr-2" /> Derivar para respuesta final al requerimiento
                </Button>
              )}

              {/* Respuesta final (admin asignado o superadmin) */}
              {esTipoRespuestaAdmin && puedeEnviarRespuestaFinal && (
                <Button
                  size="full"
                  className="bg-blue-900 hover:bg-blue-950 text-white"
                  onClick={() => setShowRespuesta(true)}
                >
                  <Mail className="h-4 w-4 mr-2" /> Respuesta final al requerimiento
                </Button>
              )}

              {/* Admin no asignado en derivado_respuesta_final */}
              {esTipoRespuestaAdmin &&
                req.estado === "derivado_respuesta_final" &&
                !!user &&
                esRolAdminPlataforma(user.rol) &&
                !puedeEnviarRespuestaFinal &&
                !hasRespuestaVecino && (
                  <Button
                    size="full"
                    variant="secondary"
                    disabled
                    className="bg-slate-200 text-slate-500 hover:bg-slate-200 cursor-not-allowed"
                    title={
                      req.adminAsignadoRespuesta
                        ? `Asignado a ${req.adminAsignadoRespuesta.nombre} (${req.adminAsignadoRespuesta.email})`
                        : "Solo el admin asignado por el director puede enviar la respuesta final"
                    }
                  >
                    <Mail className="h-4 w-4 mr-2" /> Respuesta final al requerimiento
                  </Button>
                )}

              {hasRespuestaVecino && (
                <Alert variant="success">
                  <p className="text-sm">
                    Ya se envió la respuesta final al vecino. No es posible enviar otra respuesta.
                  </p>
                </Alert>
              )}

              {puedeRevertirDatos && (
                <Button
                  variant="outline"
                  size="full"
                  disabled={!puedeRevertir || revertirMutation.isPending}
                  title={
                    !esSuperadmin
                      ? "Esta función es solo para superadmin"
                      : !puedeRevertir
                        ? "No se puede revertir: ya se envió correo al vecino o no hay estado anterior"
                        : undefined
                  }
                  className={
                    !esSuperadmin
                      ? "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-100 cursor-not-allowed"
                      : undefined
                  }
                  onClick={() => {
                    if (puedeRevertir) setShowRevertirConfirm(true);
                  }}
                >
                  <Undo2 className="h-4 w-4 mr-2" /> Revertir último cambio de estado
                </Button>
              )}

              {canDelete && (
                <Button
                  variant="destructive"
                  size="full"
                  onClick={() => setShowDeleteConfirm(true)}
                  loading={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {req.notas.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Notas Internas</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {req.notas.map((n, i) => (
                    <div key={i} className="bg-slate-50 rounded-lg p-3 text-sm">
                      <p>{n.contenido}</p>
                      <p className="text-xs text-slate-400 mt-1">{new Date(n.fecha).toLocaleString("es-CL")}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {req.respuestasVecino.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Respuestas Enviadas al Vecino</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {req.respuestasVecino
                    .slice()
                    .reverse()
                    .map((respuesta, i) => (
                      <div key={`${respuesta.fecha}-${i}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800">{respuesta.asunto}</p>
                          <p className="text-xs text-slate-400">{new Date(respuesta.fecha).toLocaleString("es-CL")}</p>
                        </div>
                        <p className="mt-1 text-xs font-medium text-blue-800">{respuesta.emailDestino}</p>
                        <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{respuesta.mensaje}</p>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDeleteModal
        open={showPendienteEvidenciaModal}
        onOpenChange={(open) => {
          setShowPendienteEvidenciaModal(open);
          if (!open) setPendienteEvidenciaNota(undefined);
        }}
        title="Eliminar evidencia para volver a pendiente"
        confirmLabel={`Eliminar evidencia y volver a ${ESTADO_LABELS.pendiente}`}
        description={
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              Se debe eliminar la evidencia que subió para volver al estado anterior de «
              {ESTADO_LABELS.pendiente}».
            </p>
            <p>
              Cuando el requerimiento vuelva a estar en «{ESTADO_LABELS.en_proceso}», deberá volver a subir
              evidencia si corresponde.
            </p>
            <p>
              Si no elimina la evidencia, no puede volver al estado «{ESTADO_LABELS.pendiente}».
            </p>
          </div>
        }
        onConfirm={handleConfirmPendienteConEliminarEvidencia}
        loading={pendienteEvidenciaActionLoading}
      />

      <ConfirmDeleteModal
        open={showConfirmCierreEstado}
        onOpenChange={setShowConfirmCierreEstado}
        title="Confirmar cierre del requerimiento"
        confirmLabel={
          newEstado === "completado"
            ? "Sí, marcar como completado"
            : newEstado === "rechazado"
              ? "Sí, marcar como rechazado"
              : "Confirmar"
        }
        danger
        description={
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              Va a marcar el requerimiento como{" "}
              <strong>
                {newEstado === "completado"
                  ? ESTADO_LABELS.completado
                  : newEstado === "rechazado"
                    ? ESTADO_LABELS.rechazado
                    : "cerrado"}
              </strong>
              . Confirme que corresponde cerrar el caso y que ya envió o enviará la respuesta formal al vecino si aplica.
            </p>
            {esSuperadmin && (
              <p>
                Si fue un clic por error y <strong>todavía no</strong> envió correo al vecino, después podrá usar{" "}
                <strong>Revertir último cambio de estado</strong> para deshacer este paso.
              </p>
            )}
          </div>
        }
        onConfirm={handleConfirmCierreEstado}
        loading={updateMutation.isPending}
      />

      <ConfirmDeleteModal
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Eliminar requerimiento"
        description={
          <>
            ¿Está seguro de eliminar el requerimiento{" "}
            <span className="font-semibold text-slate-700">{req.numeroSeguimiento}</span>?
          </>
        }
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />

      <ConfirmDeleteModal
        open={showRevertirConfirm}
        onOpenChange={setShowRevertirConfirm}
        title="Revertir último cambio de estado"
        confirmLabel="Sí, revertir"
        cancelLabel="Cancelar"
        danger={false}
        description={
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              Vuelve el requerimiento al estado inmediatamente anterior (según el historial). Si el estado actual era
              «{ESTADO_LABELS.en_espera_1}» o «{ESTADO_LABELS.en_espera_2}», se ajustará el plazo. Si era «
              {ESTADO_LABELS.derivado_respuesta_final}», se quitará el admin asignado.
            </p>
            <p>
              Disponible solo para superadmin mientras no se haya enviado correo al vecino. Queda registrado en el
              historial.
            </p>
          </div>
        }
        onConfirm={handleRevertir}
        loading={revertirMutation.isPending}
      />

      <DerivacionModal
        key={`derivar-${id}-${showDerivar ? "open" : "closed"}-${req.direccionMunicipal}`}
        open={showDerivar}
        onClose={() => setShowDerivar(false)}
        onSubmit={handleDerivar}
        direccionMunicipalInicial={req.direccionMunicipal}
        tipoRequerimiento={req.tipoRequerimiento}
      />

      {showDerivarFinal && (
        <DerivarRespuestaFinalModal
          open={showDerivarFinal}
          onClose={() => setShowDerivarFinal(false)}
          onSubmit={handleDerivarRespuestaFinal}
          tipoRequerimiento={req.tipoRequerimiento}
        />
      )}

      {showRespuesta && (
        <RespuestaVecinoModal
          open={showRespuesta}
          onClose={() => setShowRespuesta(false)}
          defaultEmail={req.vecino.email}
          numeroSeguimiento={req.numeroSeguimiento}
          requireCierre={requireCierreEnRespuesta}
          autoMensajeSiCompletado={autoMensajeSiCompletado}
          title="Respuesta final al requerimiento"
          onSubmit={handleEnviarRespuesta}
        />
      )}
      {showEditar && (
        <EditarRequerimientoModal
          key={`editar-${req.id}-${req.actualizadoEn}-${showEditar ? "open" : "closed"}`}
          open={showEditar}
          requerimiento={req}
          onClose={() => setShowEditar(false)}
          onSubmit={handleActualizarDatos}
        />
      )}
    </div>
  );
}
