import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const TOTAL = Number(process.argv[2] || 30);

const NOMBRES = ["Camila", "Benjamin", "Javiera", "Matias", "Fernanda", "Diego", "Valentina", "Nicolas", "Daniela", "Sebastian"];
const APELLIDOS = ["Gonzalez", "Munoz", "Rojas", "Diaz", "Soto", "Contreras", "Silva", "Martinez", "Paredes", "Vargas"];
const COMUNAS = ["Molina", "Curico", "Romeral", "Sagrada Familia", "Teno"];
const TIPOS = ["Información", "Reclamo", "Sugerencia", "Felicitación", "Solicitud", "Denuncia"];
const ESTADOS = ["pendiente", "derivado", "en_proceso", "completado", "rechazado"];

const DIRECCIONES = [
  { key: "OPERACIONES", label: "Dirección de Operaciones", categorias: ["Alumbrado público", "Baches", "Retiro de escombros", "Limpieza de calles", "Contenedores de residuos"] },
  { key: "MEDIOAMBIENTE", label: "Dirección de Medioambiente, Energía y Sustentabilidad", categorias: ["Áreas verdes", "Microbasurales", "Reciclaje", "Poda y mantención de arbolado", "Contaminación"] },
  { key: "TRANSITO", label: "Dirección de Tránsito", categorias: ["Semáforos", "Señalización", "Demarcación vial", "Cruces peatonales", "Congestión vehicular"] },
  { key: "OBRAS", label: "Dirección de Obras", categorias: ["Veredas dañadas", "Permisos de obra", "Construcciones irregulares", "Fiscalización de faenas", "Accesibilidad universal en infraestructura"] },
  { key: "DIDECO", label: "Dirección de Desarrollo Comunitario", categorias: ["Ayuda social", "Subsidios", "Discapacidad", "Adulto mayor", "Asistencia social de emergencia"] },
  { key: "INSPECCION", label: "Dirección de Inspección", categorias: ["Comercio ilegal", "Ruidos molestos", "Fiscalización", "Incumplimiento de ordenanzas municipales", "Denuncias municipales"] },
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function addBusinessDays(start, businessDays) {
  const result = new Date(start);
  let added = 0;
  while (added < businessDays) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

function makeRut() {
  const base = String(randomInt(10000000, 25999999));
  const dv = randomItem(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "K"]);
  return `${base.slice(0, 2)}.${base.slice(2, 5)}.${base.slice(5)}-${dv}`;
}

function makePhone() {
  return `+569${randomInt(10000000, 99999999)}`;
}

function makePdfBuffer({ numeroSeguimiento, vecino, categoria }) {
  const lines = [
    "MUNICIPALIDAD DE MOLINA",
    "Documento adjunto de requerimiento",
    `N° seguimiento: ${numeroSeguimiento}`,
    `Vecino: ${vecino}`,
    `Categoria: ${categoria}`,
    `Fecha: ${new Date().toLocaleString("es-CL")}`,
  ];
  const content = lines.join("\\n");
  const stream = `BT /F1 11 Tf 50 760 Td (${content.replace(/[()]/g, "")}) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length ${stream.length}>>stream
${stream}
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000242 00000 n 
0000000345 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
413
%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function initFirebase() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error("Faltan variables FIREBASE_* en entorno (.env.local).");
    }
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
  return getFirestore();
}

function initR2() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Faltan variables R2_* en entorno (.env.local).");
  }
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return { client, bucket };
}

async function nextTrackingNumber(db) {
  const counterRef = db.collection("contadores").doc("requerimientos");
  const next = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists ? snap.data().current || 0 : 0;
    const val = current + 1;
    tx.set(counterRef, { current: val, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return val;
  });
  return `REQ-${new Date().getFullYear()}-${String(next).padStart(6, "0")}`;
}

async function uploadRandomPdf(r2, numeroSeguimiento, vecino, categoria) {
  const fileName = `adjunto-${numeroSeguimiento}.pdf`;
  const key = `requerimientos/seed-${randomUUID()}.pdf`;
  const body = makePdfBuffer({ numeroSeguimiento, vecino, categoria });
  await r2.client.send(
    new PutObjectCommand({
      Bucket: r2.bucket,
      Key: key,
      Body: body,
      ContentType: "application/pdf",
      ContentLength: body.length,
    })
  );
  return {
    nombre: fileName,
    nombreR2: key,
    url: `/api/documentos?key=${encodeURIComponent(key)}`,
    tipo: "application/pdf",
    tamanio: body.length,
  };
}

async function main() {
  const db = initFirebase();
  const r2 = initR2();
  const reqCol = db.collection("requerimientos");

  console.log(`Iniciando seed de ${TOTAL} requerimientos...`);

  for (let i = 0; i < TOTAL; i++) {
    const nombre = randomItem(NOMBRES);
    const primerApellido = randomItem(APELLIDOS);
    const segundoApellido = randomItem(APELLIDOS);
    const direccion = randomItem(DIRECCIONES);
    const categoria = randomItem(direccion.categorias);
    const tipo = randomItem(TIPOS);
    const estado = randomItem(ESTADOS);
    const ingreso = daysAgo(randomInt(0, 45));
    const limite = addBusinessDays(ingreso, 20);
    const numeroSeguimiento = await nextTrackingNumber(db);
    const vecinoNombre = `${nombre} ${primerApellido} ${segundoApellido}`;

    const documentos = [];
    const cantidadDocs = randomInt(1, 2);
    for (let d = 0; d < cantidadDocs; d++) {
      documentos.push(await uploadRandomPdf(r2, `${numeroSeguimiento}-${d + 1}`, vecinoNombre, categoria));
    }

    const notas = randomInt(0, 1)
      ? [
          {
            contenido: "Caso ingresado para pruebas de panel administrativo.",
            usuarioId: "seed-script",
            fecha: Timestamp.fromDate(ingreso),
          },
        ]
      : [];

    const historialEstados = [
      {
        estado: "pendiente",
        fecha: Timestamp.fromDate(ingreso),
        nota: "Ingreso automático por script de pruebas",
      },
    ];
    if (estado !== "pendiente") {
      historialEstados.push({
        estado,
        fecha: Timestamp.fromDate(daysAgo(randomInt(0, 10))),
        usuarioId: "seed-script",
        nota: "Cambio automático para diversidad de estados",
      });
    }

    await reqCol.add({
      numeroSeguimiento,
      vecino: {
        nombre,
        primerApellido,
        segundoApellido,
        rut: makeRut(),
        telefono: makePhone(),
        email: `${nombre.toLowerCase()}.${primerApellido.toLowerCase()}${randomInt(10, 999)}@mailinator.com`,
        region: "Maule",
        comuna: randomItem(COMUNAS),
        direccion: `Calle ${randomItem(["Los Alerces", "Las Flores", "San Martin", "Balmaceda", "OHiggins"])} ${randomInt(100, 2999)}`,
        tipoInmueble: randomItem(["Casa", "Departamento", "Oficina"]),
      },
      tipoRequerimiento: tipo,
      direccionMunicipal: direccion.key,
      direccionMunicipalLabel: direccion.label,
      categoria,
      descripcion: `Requerimiento de prueba generado automáticamente (${i + 1}/${TOTAL}) para validar filtros, dashboards y flujos de gestión administrativa.`,
      documentos,
      estado,
      historialEstados,
      notas,
      fechaIngreso: Timestamp.fromDate(ingreso),
      fechaLimite: Timestamp.fromDate(limite),
      ...(estado === "completado" ? { fechaResolucion: Timestamp.fromDate(daysAgo(randomInt(0, 5))) } : {}),
      creadoEn: Timestamp.fromDate(ingreso),
      actualizadoEn: Timestamp.now(),
    });

    process.stdout.write(`✔ ${i + 1}/${TOTAL} creado\r`);
  }

  console.log(`\nSeed finalizado: ${TOTAL} requerimientos creados (sin envío de correos).`);
}

main().catch((err) => {
  console.error("Error en seed:", err);
  process.exit(1);
});

