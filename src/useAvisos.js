import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { combinarAvisos, eventoPorEstado, leerAviso } from './solicitudes.cjs';

const CLAVE = 'avisos-solicitudes-v1';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const visible = Boolean(leerAviso(notification));
    return {
      shouldPlaySound: visible,
      shouldSetBadge: false,
      shouldShowBanner: visible,
      shouldShowList: visible,
    };
  },
});

export function useAvisos(abrirDetalle) {
  const [avisos, setAvisos] = useState([]);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    let activo = true;

    function guardar(nuevos) {
      const validos = nuevos.filter(Boolean);
      if (activo && validos.length) {
        setAvisos((actuales) => combinarAvisos(actuales, validos));
      }
    }

    async function leerBandeja() {
      try {
        const presentadas = await Notifications.getPresentedNotificationsAsync();
        guardar(presentadas.map(leerAviso));
      } catch {
        // Los listeners siguen activos si el dispositivo no expone su bandeja.
      }
    }

    function responder(response) {
      if (response?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const aviso = leerAviso(response.notification);
      if (aviso) {
        guardar([aviso]);
        abrirDetalle(aviso);
        Notifications.clearLastNotificationResponse();
      }
    }

    const recepcion = Notifications.addNotificationReceivedListener((notification) => {
      guardar([leerAviso(notification)]);
    });
    const seleccion = Notifications.addNotificationResponseReceivedListener(responder);
    const aplicacion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void leerBandeja();
    });

    responder(Notifications.getLastNotificationResponse());
    void leerBandeja();
    AsyncStorage.getItem(CLAVE)
      .then((valor) => {
        const guardados = valor ? JSON.parse(valor) : [];
        guardar(guardados.filter((aviso) => (
          typeof aviso?.id === 'string' && Number.isFinite(aviso.fecha) &&
          eventoPorEstado(aviso.estado)
        )));
      })
      .catch(() => {})
      .finally(() => {
        if (activo) setCargado(true);
      });

    return () => {
      activo = false;
      recepcion.remove();
      seleccion.remove();
      aplicacion.remove();
    };
  }, [abrirDetalle]);

  useEffect(() => {
    if (cargado) void AsyncStorage.setItem(CLAVE, JSON.stringify(avisos)).catch(() => {});
  }, [avisos, cargado]);

  return { avisos, cargado };
}
