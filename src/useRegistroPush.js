import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { registrarPush } from './registro.cjs';
import { CANAL } from './solicitudes.cjs';

export function useRegistroPush() {
  const [registro, setRegistro] = useState({ estado: 'consultando' });
  const [ocupado, setOcupado] = useState(false);
  const enCurso = useRef(false);

  const actualizar = useCallback(async (pedirPermiso = false) => {
    if (enCurso.current) return;
    enCurso.current = true;
    setOcupado(true);
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CANAL, {
          name: 'Actualizaciones de solicitudes',
          importance: Notifications.AndroidImportance.HIGH,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
        });
      }
      const projectId = Constants.expoConfig?.extra?.eas?.projectId
        ?? Constants.easConfig?.projectId;
      const resultado = await registrarPush({
        notifications: Notifications,
        projectId,
        pedirPermiso,
        autorizadoIOS: Platform.OS === 'ios' ? Notifications.IosAuthorizationStatus.AUTHORIZED : undefined,
      });
      setRegistro(resultado);
    } catch {
      setRegistro({ estado: 'error_permiso' });
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  }, []);

  useEffect(() => {
    void actualizar();
    const aplicacion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void actualizar();
    });
    const cambioToken = Notifications.addPushTokenListener(() => {
      void actualizar();
    });
    return () => {
      aplicacion.remove();
      cambioToken.remove();
    };
  }, [actualizar]);

  return { registro, ocupado, actualizar };
}
