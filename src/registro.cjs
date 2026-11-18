function permisoConcedido(permisos, autorizadoIOS) {
  return permisos.granted || (
    autorizadoIOS !== undefined && permisos.ios?.status === autorizadoIOS
  );
}

async function registrarPush({
  notifications,
  projectId,
  pedirPermiso,
  autorizadoIOS,
}) {
  let permisos = await notifications.getPermissionsAsync();
  if (!permisoConcedido(permisos, autorizadoIOS) && pedirPermiso && permisos.canAskAgain) {
    permisos = await notifications.requestPermissionsAsync();
  }
  if (!permisoConcedido(permisos, autorizadoIOS)) {
    return {
      estado: permisos.status === 'undetermined' ? 'sin_decidir' : 'denegado',
      permiso: false,
      ajustes: !permisos.canAskAgain,
    };
  }
  if (!projectId) return { estado: 'sin_proyecto', permiso: true };

  try {
    const { data: token } = await notifications.getExpoPushTokenAsync({ projectId });
    return { estado: 'activo', permiso: true, token };
  } catch {
    return { estado: 'error_token', permiso: true };
  }
}

module.exports = { registrarPush };
