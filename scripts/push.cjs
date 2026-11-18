const { eventoPorEstado, CANAL, SOLICITUD } = require('../src/solicitudes.cjs');

const API_EXPO = 'https://exp.host/--/api/v2/push';
const TOKEN_EXPO = /^(?:ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{8,160}\]$/;
const ID_TICKET = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const CODIGOS_EXPO = new Set([
  'DeviceNotRegistered', 'MessageTooBig', 'MessageRateExceeded', 'MismatchSenderId',
  'InvalidCredentials', 'UNAUTHORIZED', 'TOO_MANY_REQUESTS', 'PUSH_TOO_MANY_EXPERIENCE_IDS',
]);

function crearMensaje(estado, destinatario) {
  const evento = eventoPorEstado(estado);
  if (!evento) throw new Error('Usa registrado, recibido, en_proceso o finalizado.');
  if (!TOKEN_EXPO.test(destinatario ?? '')) {
    throw new Error('Configura un token de destino de Expo válido en EXPO_PUSH_TOKEN.');
  }
  return {
    to: destinatario,
    title: evento.titulo,
    body: evento.mensaje,
    sound: 'default',
    priority: 'high',
    channelId: CANAL,
    ttl: 3600,
    data: {
      tipo: evento.tipo,
      identificador: SOLICITUD,
      estado: evento.estado,
    },
  };
}

function errorExpo(codigo) {
  if (codigo === 'DeviceNotRegistered') {
    return new Error('DeviceNotRegistered. Retira ese token y vuelve a registrar el dispositivo.');
  }
  const detalle = CODIGOS_EXPO.has(codigo) ? ' (' + codigo + ')' : '';
  return new Error('Expo rechazó la operación' + detalle + '.');
}

async function llamarExpo(operacion, cuerpo, acceso, fetchImpl) {
  if (!acceso?.trim()) {
    throw new Error('Configura EXPO_ACCESS_TOKEN para autenticar el envío o consultar el recibo.');
  }
  let respuesta;
  let json;
  try {
    respuesta = await fetchImpl(API_EXPO + '/' + operacion, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: 'Bearer ' + acceso.trim(),
      },
      body: JSON.stringify(cuerpo),
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    json = await respuesta.json();
  } catch {
    throw new Error('No fue posible obtener una respuesta válida de Expo. Revisa la red antes de volver a enviar.');
  }
  if (json?.errors?.length) throw errorExpo(json.errors[0].code);
  if (!respuesta.ok) throw new Error('Expo devolvió HTTP ' + respuesta.status + '.');
  if (!json?.data) throw new Error('Expo no devolvió resultados para la operación.');
  return json.data;
}

async function enviar(estado, entorno, fetchImpl = fetch) {
  const mensaje = crearMensaje(estado, entorno.EXPO_PUSH_TOKEN);
  const datos = await llamarExpo('send', mensaje, entorno.EXPO_ACCESS_TOKEN, fetchImpl);
  const ticket = Array.isArray(datos) ? datos[0] : datos;
  if (ticket?.status === 'error') throw errorExpo(ticket.details?.error);
  if (ticket?.status !== 'ok' || !ID_TICKET.test(ticket.id ?? '')) {
    throw new Error('Expo no devolvió un ticket válido.');
  }
  return ticket.id;
}

async function consultarRecibo(id, entorno, fetchImpl = fetch) {
  if (!ID_TICKET.test(id ?? '')) throw new Error('Indica un ID de ticket de Expo válido.');
  const datos = await llamarExpo('getReceipts', { ids: [id] }, entorno.EXPO_ACCESS_TOKEN, fetchImpl);
  const recibo = datos[id];
  if (!recibo) return 'pendiente';
  if (recibo.status === 'error') throw errorExpo(recibo.details?.error);
  if (recibo.status !== 'ok') throw new Error('Expo devolvió un recibo inesperado.');
  return 'aceptado';
}

async function main([comando, valor, ...resto]) {
  if (resto.length || !valor) {
    throw new Error('Uso: npm run push -- vista|enviar <estado> o npm run push -- recibo <ticket>.');
  }
  switch (comando) {
    case 'vista': {
      const ejemplo = crearMensaje(valor, 'ExpoPushToken[SOLO_VISTA]');
      console.log(JSON.stringify({ ...ejemplo, to: '[token del dispositivo registrado]' }, null, 2));
      break;
    }
    case 'enviar': {
      const ticket = await enviar(valor, process.env);
      console.log('Expo aceptó el mensaje. Ticket ' + ticket);
      console.log('Consulta el recibo y verifica la notificación en el dispositivo.');
      break;
    }
    case 'recibo': {
      const estado = await consultarRecibo(valor, process.env);
      const mensajes = {
        aceptado: 'El proveedor móvil aceptó el mensaje. Comprueba su aparición en el dispositivo.',
        pendiente: 'El recibo todavía no está disponible. Vuelve a consultarlo más tarde.',
      };
      console.log(mensajes[estado]);
      break;
    }
    default:
      throw new Error('Usa vista, enviar o recibo.');
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { crearMensaje, enviar, consultarRecibo };
