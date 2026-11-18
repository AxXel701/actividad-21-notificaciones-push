const SOLICITUD = 'SOL-001';
const CANAL = 'solicitudes';

const EVENTOS = [
  {
    estado: 'registrado',
    etiqueta: 'Registrada',
    tipo: 'solicitud_registrada',
    titulo: 'Solicitud registrada',
    mensaje: 'Tu solicitud se registró correctamente.',
  },
  {
    estado: 'recibido',
    etiqueta: 'Recibida',
    tipo: 'cambio_estado',
    titulo: 'Actualización de solicitud',
    mensaje: 'El personal responsable recibió tu solicitud.',
  },
  {
    estado: 'en_proceso',
    etiqueta: 'En proceso',
    tipo: 'cambio_estado',
    titulo: 'Actualización de solicitud',
    mensaje: 'Tu solicitud se encuentra en proceso',
  },
  {
    estado: 'finalizado',
    etiqueta: 'Finalizada',
    tipo: 'cambio_estado',
    titulo: 'Actualización de solicitud',
    mensaje: 'Tu solicitud ha finalizado.',
  },
];

function eventoPorEstado(estado) {
  return EVENTOS.find((evento) => evento.estado === estado);
}

function leerAviso(notification) {
  const { identifier, content } = notification?.request ?? {};
  const data = content?.data;
  if (data?.identificador !== SOLICITUD || typeof identifier !== 'string' ||
      !Number.isFinite(notification.date)) return null;

  const evento = eventoPorEstado(data.estado);
  if (!evento || data.tipo !== evento.tipo) return null;

  return { id: identifier, estado: evento.estado, fecha: notification.date };
}

function combinarAvisos(actuales, nuevos) {
  const porId = new Map(actuales.map((aviso) => [aviso.id, aviso]));
  for (const aviso of nuevos) {
    if (aviso) porId.set(aviso.id, aviso);
  }
  return [...porId.values()].sort((a, b) => b.fecha - a.fecha);
}

function avanceDe(avisos) {
  return EVENTOS.findLastIndex((evento) => avisos.some((aviso) => aviso.estado === evento.estado));
}

module.exports = { SOLICITUD, CANAL, EVENTOS, eventoPorEstado, leerAviso, combinarAvisos, avanceDe };
