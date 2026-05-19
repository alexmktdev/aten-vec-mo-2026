"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequerimiento, useUpdateRequerimiento, useUpdateRequerimientoDatos, useDerivarRequerimiento, useDeleteRequerimiento, useEnviarRespuestaVecino } from "@/hooks/useRequerimientos";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { RequerimientoStatusBadge } from "@/components/features/requerimientos/RequerimientoStatusBadge";
import { AlertaVencimiento } from "@/components/features/requerimientos/AlertaVencimiento";
import { ESTADO_LABELS, ESTADOS_REQUERIMIENTO, EstadoRequerimiento } from "@/types/requerimiento.types";
import { RequerimientoCreateInput } from "@/lib/validations/requerimiento.schema";
import { ArrowLeft, Loader2, Mail, Pencil, Send, Trash2 } from "lucide-react";
import { canDeleteRequerimiento, canDerivarRequerimiento, canEditRequerimientoData, canSendCitizenResponse, getAllowedNextStates } from "@/lib/requerimiento-permissions";
import { ApiClientError } from "@/lib/api/fetch-json";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { EvidenciaResolucionForm } from "@/components/features/requerimientos/EvidenciaResolucionForm";

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

  const [newEstado, setNewEstado] = useState("");
  const [nota, setNota] = useState("");
  const [showEditar, setShowEditar] = useState(false);
  const [showDerivar, setShowDerivar] = useState(false);
  const [showRespuesta, setShowRespuesta] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setNewEstado("");
    setNota("");
  }, [id]);

  const canDerivar = !!user && !!req && canDerivarRequerimiento(user.rol) && req.estado === "pendiente";
  const canDelete = !!user && canDeleteRequerimiento(user.rol);
  const canResponderVecino = !!user && !!req && canSendCitizenResponse(user.rol) && (req.estado === "completado" || req.estado === "rechazado");
  const canEditarDatos = !!user && canEditRequerimientoData(user.rol);
  const hasRespuestaVecino = !!req && (req.respuestasVecino?.length || 0) > 0;
  const isAdmin = user?.rol === "admin";
  const allowedNextStates = !!user && !!req ? getAllowedNextStates(user.rol, req.estado) : [];
  const canChangeEstado = allowedNextStates.length > 0 && !(hasRespuestaVecino && (req?.estado === "completado" || req?.estado === "rechazado"));
  const isProcessingAction =
    updateMutation.isPending ||
    derivarMutation.isPending ||
    respuestaMutation.isPending ||
    deleteMutation.isPending ||
    updateDatosMutation.isPending;

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof ApiClientError) {
      const details = Array.isArray(error.details) ? error.details : [];
      const firstIssue = details.length > 0 && typeof details[0]?.message === "string" ? details[0].message : null;
      return firstIssue || error.message || "Error al actualizar el requerimiento";
    }
    if (error instanceof Error) return error.message;
    return "Error al actualizar el requerimiento";
  };

  const handleUpdateEstado = async () => {
    if (!newEstado && !nota) return;
    const estadoEnviar = newEstado ? (newEstado as EstadoRequerimiento) : undefined;

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
    } catch (error) {
      setErrorMsg(getErrorMessage(error));
    }
  };

  const handleDerivar = async (payload: { direccionMunicipal: string; emailDestinatario: string }) => {
    setErrorMsg("");
    try {
      await derivarMutation.mutateAsync({ id, ...payload });
      setSuccessMsg("Requerimiento derivado exitosamente");
      setNewEstado("");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (error) {
      setErrorMsg(getErrorMessage(error));
    }
  };

  const handleEnviarRespuesta = async (payload: { emailDestino: string; asunto: string; mensaje: string }) => {
    setErrorMsg("");
    try {
      await respuestaMutation.mutateAsync({ id, payload });
      setSuccessMsg("Correo de respuesta enviado y registrado en el requerimiento");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (error) {
      setErrorMsg(getErrorMessage(error));
    }
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(id);
    setShowDeleteConfirm(false);
    router.push("/requerimientos");
  };

  if (isLoading) {
    return <div className="animate-pulse space-y-6"><div className="h-8 bg-slate-100 rounded w-48" /><div className="h-64 bg-slate-100 rounded-2xl" /></div>;
  }

  if (error || !req) {
    return <Alert variant="error">Requerimiento no encontrado</Alert>;
  }

  const estadoOptions = req && user
    ? [req.estado, ...getAllowedNextStates(user.rol, req.estado)].filter(
        (estado, index, arr) => arr.indexOf(estado) === index
      ).map((estado) => ({ value: estado, label: ESTADO_LABELS[estado] }))
    : ESTADOS_REQUERIMIENTO.map((e) => ({ value: e, label: ESTADO_LABELS[e] }));

  const handleActualizarDatos = async (payload: RequerimientoCreateInput) => {
    await updateDatosMutation.mutateAsync({ id, payload });
    setSuccessMsg("Datos del requerimiento actualizados exitosamente");
    setTimeout(() => setSuccessMsg(""), 3000);
  };

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
        {isAdmin && req.estado === "pendiente" && (
          <Alert variant="info">
            <p className="text-sm">
              Para pasar este requerimiento a «{ESTADO_LABELS.derivado}», use el botón{" "}
              <strong>Derivar</strong> en el panel de acciones. Al derivar se enviará el correo a la
              dirección correspondiente y el estado cambiará automáticamente.
            </p>
          </Alert>
        )}
        {isAdmin && req.estado !== "pendiente" && (
          <Alert>
            <p className="text-sm text-slate-700">
              Como administrador, usted no puede modificar el estado manualmente. Si la derivación fue
              incorrecta, el director de la dirección asignada puede devolver el requerimiento a «{ESTADO_LABELS.pendiente}»
              para que pueda derivar nuevamente.
            </p>
          </Alert>
        )}
      </div>

      <AlertaVencimiento diasHabilesRestantes={req.diasHabilesRestantes} vencido={req.vencido} />
      {successMsg && <Alert variant="success">{successMsg}</Alert>}
      {errorMsg && <Alert variant="error">{errorMsg}</Alert>}
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
                <div><dt className="text-slate-500">Dirección Municipal</dt><dd className="font-medium">{req.direccionMunicipalLabel}</dd></div>
                <div><dt className="text-slate-500">Categoría</dt><dd className="font-medium">{req.categoria}</dd></div>
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
          {req.estado === "en_proceso" && !!user && (user.rol === "director" || user.rol === "superadmin") && (
            <EvidenciaResolucionForm
              requerimientoId={req.id}
              evidenciaExistente={req.evidenciaResolucion}
            />
          )}
          {req.estado !== "en_proceso" && req.evidenciaResolucion && (
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

              {canEditarDatos && (
                <Button
                  variant="outline"
                  size="full"
                  onClick={() => setShowEditar(true)}
                >
                  <Pencil className="h-4 w-4 mr-2" /> Editar datos completos
                </Button>
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

              {canResponderVecino && (
                <Button
                  size="full"
                  variant={hasRespuestaVecino ? "secondary" : "default"}
                  className={
                    hasRespuestaVecino
                      ? "cursor-not-allowed bg-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-500"
                      : "bg-blue-900 hover:bg-blue-950 text-white"
                  }
                  disabled={hasRespuestaVecino}
                  onClick={() => {
                    if (!hasRespuestaVecino) {
                      setShowRespuesta(true);
                    }
                  }}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  {hasRespuestaVecino ? "Respuesta ya enviada" : "Enviar respuesta al vecino"}
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

      <DerivacionModal
        key={`derivar-${id}-${showDerivar ? "open" : "closed"}-${req.direccionMunicipal}`}
        open={showDerivar}
        onClose={() => setShowDerivar(false)}
        onSubmit={handleDerivar}
        direccionMunicipalInicial={req.direccionMunicipal}
      />
      {showRespuesta && (
        <RespuestaVecinoModal
          open={showRespuesta}
          onClose={() => setShowRespuesta(false)}
          defaultEmail={req.vecino.email}
          numeroSeguimiento={req.numeroSeguimiento}
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
