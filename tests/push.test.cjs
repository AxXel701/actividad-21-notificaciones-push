const assert = require('node:assert/strict');
const test = require('node:test');
const { crearMensaje, enviar, consultarRecibo } = require('../scripts/push.cjs');
const { registrarPush } = require('../src/registro.cjs');
const { EVENTOS, leerAviso, combinarAvisos, avanceDe } = require('../src/solicitudes.cjs');

const demo = {
  EXPO_PUSH_TOKEN: 'ExpoPushToken[destino_de_prueba]',
  EXPO_ACCESS_TOKEN: 'acceso-de-prueba',
};
const ticket = 'abc12345-1234-1234-1234-123456789abc';
const projectId = 'proyecto-de-prueba';

function aviso(estado, id, fecha, identificador = 'SOL-001') {
  const { data } = crearMensaje(estado, demo.EXPO_PUSH_TOKEN);
  return { request: { identifier: id, content: { data: { ...data, identificador } } }, date: fecha };
}

test('genera el contenido de los cuatro estados con destinatario, canal e identificador', () => {
  for (const evento of EVENTOS) {
    const mensaje = crearMensaje(evento.estado, demo.EXPO_PUSH_TOKEN);
    assert.equal(mensaje.to, demo.EXPO_PUSH_TOKEN);
    assert.equal(mensaje.channelId, 'solicitudes');
    assert.equal(mensaje.title, evento.titulo);
    assert.equal(mensaje.body, evento.mensaje);
    assert.deepEqual(mensaje.data, {
      tipo: evento.tipo, identificador: 'SOL-001', estado: evento.estado,
    });
  }
  assert.equal(
    crearMensaje('en_proceso', demo.EXPO_PUSH_TOKEN).body,
    'Tu solicitud se encuentra en proceso',
  );
  assert.throws(() => crearMensaje('otro', demo.EXPO_PUSH_TOKEN), /Usa registrado/);
  assert.throws(() => crearMensaje('registrado', 'destino-invalido'), /token de destino/);
});

test('procesa dos alertas, ignora destinos ajenos y evita duplicados al seleccionar', () => {
  const primero = leerAviso(aviso('registrado', 'registro', 20));
  const segundo = leerAviso(aviso('en_proceso', 'cambio', 10));
  const ajeno = leerAviso(aviso('finalizado', 'ajeno', 30, 'SOL-002'));
  const invalido = aviso('en_proceso', 'invalido', 50);
  invalido.request.content.data.tipo = 'otro';
  assert.equal(ajeno, null);
  assert.equal(leerAviso(invalido), null);
  const historial = combinarAvisos([segundo], [primero, segundo, ajeno]);
  assert.equal(historial.length, 2);
  assert.equal(EVENTOS[avanceDe(historial)].estado, 'en_proceso');
});

test('un permiso denegado no solicita el token', async () => {
  let solicitados = 0;
  const registro = await registrarPush({
    notifications: {
      getPermissionsAsync: async () => ({ granted: false, status: 'undetermined', canAskAgain: true }),
      requestPermissionsAsync: async () => ({ granted: false, status: 'denied', canAskAgain: false }),
      getExpoPushTokenAsync: async () => { solicitados += 1; },
    },
    projectId,
    pedirPermiso: true,
  });
  assert.deepEqual(registro, { estado: 'denegado', permiso: false, ajustes: true });
  assert.equal(solicitados, 0);
});

test('un permiso concedido genera el token del proyecto; sin vinculación informa el estado', async () => {
  const notifications = {
    getPermissionsAsync: async () => ({ granted: true }),
    getExpoPushTokenAsync: async (opciones) => {
      assert.deepEqual(opciones, { projectId });
      return { data: demo.EXPO_PUSH_TOKEN };
    },
  };
  assert.deepEqual(await registrarPush({ notifications, projectId }), {
    estado: 'activo', permiso: true, token: demo.EXPO_PUSH_TOKEN,
  });
  assert.deepEqual(await registrarPush({ notifications }), { estado: 'sin_proyecto', permiso: true });
});

test('envía por HTTPS con acceso autenticado y devuelve el ticket de la respuesta simulada', async () => {
  const id = await enviar('registrado', demo, async (url, opciones) => {
    assert.equal(url, 'https://exp.host/--/api/v2/push/send');
    assert.equal(opciones.method, 'POST');
    assert.equal(opciones.headers.Authorization, 'Bearer acceso-de-prueba');
    assert.equal(JSON.parse(opciones.body).data.tipo, 'solicitud_registrada');
    return Response.json({ data: { status: 'ok', id: ticket } });
  });
  assert.equal(id, ticket);
});

test('bloquea el envío sin acceso y propaga el error de un token retirado sin revelar credenciales', async () => {
  await assert.rejects(
    enviar('registrado', { EXPO_PUSH_TOKEN: demo.EXPO_PUSH_TOKEN }, () => assert.fail('envío sin acceso')),
    /EXPO_ACCESS_TOKEN/,
  );
  await assert.rejects(
    enviar('registrado', demo, async () => Response.json({
      data: { status: 'error', details: { error: 'DeviceNotRegistered' }, message: demo.EXPO_PUSH_TOKEN },
    })),
    { message: 'DeviceNotRegistered. Retira ese token y vuelve a registrar el dispositivo.' },
  );
});

test('distingue un recibo pendiente de uno aceptado por el proveedor', async () => {
  const pendiente = await consultarRecibo(ticket, demo, async (url, opciones) => {
    assert.equal(url, 'https://exp.host/--/api/v2/push/getReceipts');
    assert.deepEqual(JSON.parse(opciones.body), { ids: [ticket] });
    return Response.json({ data: {} });
  });
  const aceptado = await consultarRecibo(ticket, demo, async () => Response.json({
    data: { [ticket]: { status: 'ok' } },
  }));
  assert.equal(pendiente, 'pendiente');
  assert.equal(aceptado, 'aceptado');
});
