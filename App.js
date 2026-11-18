import { useEffect, useState } from 'react';
import {
  BackHandler, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { EVENTOS, SOLICITUD, avanceDe, eventoPorEstado } from './src/solicitudes.cjs';
import { useAvisos } from './src/useAvisos';
import { useRegistroPush } from './src/useRegistroPush';

const colores = {
  fondo: '#F3F5EF',
  papel: '#FFFFFF',
  tinta: '#132E25',
  secundario: '#475B52',
  verde: '#176747',
  suave: '#DFEFE5',
  borde: '#D9E1D8',
  alerta: '#87421C',
};

const mensajes = {
  consultando: 'Consultando los permisos del dispositivo.',
  sin_decidir: 'Permite las notificaciones para recibir los cambios de tu solicitud.',
  denegado: 'Permiso de notificaciones denegado.',
  sin_proyecto: 'Permiso concedido. Falta vincular el proyecto de Expo.',
  error_token: 'Permiso concedido. Revisa la conexión y la configuración de Firebase o APNs.',
  error_permiso: 'No se pudo consultar el permiso de notificaciones.',
  activo: 'Permiso concedido. Dispositivo registrado para recibir avisos.',
};

function Boton({ children, onPress, disabled, secundario = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        estilos.boton, secundario && estilos.botonSecundario,
        (disabled || pressed) && estilos.atenuado,
      ]}
    >
      <Text style={[estilos.botonTexto, secundario && estilos.botonTextoSecundario]}>{children}</Text>
    </Pressable>
  );
}

function Notificaciones() {
  const { registro, ocupado, actualizar } = useRegistroPush();
  const [mostrarToken, setMostrarToken] = useState(false);
  const [errorAjustes, setErrorAjustes] = useState(false);
  const token = ocupado ? null : registro.token;

  useEffect(() => {
    setMostrarToken(false);
  }, [registro.token]);

  return (
    <View style={estilos.tarjeta}>
      <Text style={estilos.tituloTarjeta} accessibilityRole="header">Notificaciones</Text>
      <Text accessibilityLiveRegion="polite" style={[
        estilos.texto, registro.estado === 'denegado' && estilos.alerta,
      ]}>
        {mensajes[registro.estado]}
      </Text>
      {registro.ajustes ? (
        <Boton onPress={() => {
          setErrorAjustes(false);
          void Linking.openSettings().catch(() => setErrorAjustes(true));
        }}>Abrir ajustes</Boton>
      ) : !token && (
        <Boton disabled={ocupado} onPress={() => actualizar(true)}>
          {ocupado ? 'Comprobando…' : registro.permiso ? 'Reintentar registro' : 'Permitir notificaciones'}
        </Boton>
      )}
      {errorAjustes && registro.ajustes && (
        <Text style={estilos.alerta}>Abre los ajustes de la aplicación desde el sistema.</Text>
      )}
      {token && (
        <>
          <Boton secundario onPress={() => setMostrarToken(!mostrarToken)}>
            {mostrarToken ? 'Ocultar token' : 'Mostrar token de prueba'}
          </Boton>
          {mostrarToken && (
            <>
              <Text style={estilos.texto}>Cópialo para el envío de prueba y ocúltalo antes de compartir capturas.</Text>
              <Text selectable style={estilos.token}>{token}</Text>
            </>
          )}
        </>
      )}
    </View>
  );
}

function Progreso({ avisos }) {
  const avance = avanceDe(avisos);
  return (
    <View style={estilos.progreso}>
      {EVENTOS.map((evento, posicion) => {
        const actual = posicion === avance;
        const alcanzado = posicion <= avance;
        return (
          <View key={evento.estado} style={estilos.paso}>
            <View style={[estilos.punto, alcanzado && estilos.puntoActivo]} />
            <Text style={[estilos.texto, actual && estilos.pasoActual]}>
              {evento.etiqueta}{actual ? ' · estado actual' : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Detalle({ aviso, avisos }) {
  const evento = eventoPorEstado(aviso.estado);
  return (
    <>
      <Text style={estilos.encabezado} accessibilityRole="header">Detalle de solicitud</Text>
      <View style={estilos.tarjeta}>
        <Text style={estilos.identificador}>{SOLICITUD}</Text>
        <Text style={estilos.tituloTarjeta}>{evento.titulo}</Text>
        <Text style={estilos.texto}>{evento.mensaje}</Text>
        <Text style={estilos.texto}>{evento.tipo === 'cambio_estado' ? 'Cambio de estado' : 'Registro de solicitud'}</Text>
      </View>
      <View style={estilos.tarjeta}>
        <Text style={estilos.tituloTarjeta} accessibilityRole="header">Estado de la solicitud</Text>
        <Progreso avisos={avisos} />
      </View>
    </>
  );
}

function Pantalla() {
  const [detalle, setDetalle] = useState(null);
  const { avisos, cargado } = useAvisos(setDetalle);
  const avance = avanceDe(avisos);

  useEffect(() => {
    if (!detalle) return;
    const atras = BackHandler.addEventListener('hardwareBackPress', () => {
      setDetalle(null);
      return true;
    });
    return () => atras.remove();
  }, [detalle]);

  return (
    <SafeAreaView style={estilos.raiz}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={estilos.contenido}>
        {detalle ? (
          <>
            <Boton secundario onPress={() => setDetalle(null)}>Volver a seguimiento</Boton>
            <Detalle aviso={detalle} avisos={avisos} />
          </>
        ) : (
          <>
            <Text style={estilos.encabezado} accessibilityRole="header">Seguimiento de solicitudes</Text>
            <View style={estilos.resumen}>
              <Text style={estilos.resumenEtiqueta}>Solicitud {SOLICITUD}</Text>
              <Text style={estilos.resumenEstado}>{EVENTOS[avance]?.etiqueta ?? 'En espera del primer aviso'}</Text>
            </View>
            <Notificaciones />
            <View style={estilos.tarjeta}>
              <Text style={estilos.tituloTarjeta} accessibilityRole="header">Avisos recibidos</Text>
              {!avisos.length && (
                <Text style={estilos.texto}>{cargado ? 'Todavía no hay avisos para esta solicitud.' : 'Cargando avisos…'}</Text>
              )}
              {avisos.map((aviso) => {
                const evento = eventoPorEstado(aviso.estado);
                return (
                  <Pressable
                    key={aviso.id}
                    accessibilityRole="button"
                    onPress={() => setDetalle(aviso)}
                    style={estilos.aviso}
                  >
                    <Text style={estilos.avisoTitulo}>{evento.titulo}</Text>
                    <Text style={estilos.texto}>{evento.mensaje}</Text>
                    <Text style={estilos.fecha}>{new Date(aviso.fecha).toLocaleString('es-MX')}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><Pantalla /></SafeAreaProvider>;
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 22, gap: 17, maxWidth: 560, width: '100%', alignSelf: 'center' },
  encabezado: { fontSize: 32, fontWeight: '800', color: colores.tinta, letterSpacing: -0.8 },
  resumen: { backgroundColor: colores.tinta, padding: 22, borderRadius: 18, gap: 7 },
  resumenEtiqueta: { fontSize: 14, color: '#C5E5D1', fontWeight: '700' },
  resumenEstado: { fontSize: 22, fontWeight: '700', color: colores.papel },
  tarjeta: { backgroundColor: colores.papel, padding: 18, borderRadius: 16, gap: 10, borderWidth: 1, borderColor: colores.borde },
  tituloTarjeta: { fontSize: 20, fontWeight: '700', color: colores.tinta },
  texto: { color: colores.secundario, fontSize: 15, lineHeight: 22 },
  alerta: { color: colores.alerta },
  boton: { backgroundColor: colores.verde, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  botonSecundario: { backgroundColor: colores.suave },
  botonTexto: { color: colores.papel, fontWeight: '700', fontSize: 14 },
  botonTextoSecundario: { color: colores.tinta },
  atenuado: { opacity: 0.65 },
  token: { color: colores.tinta, backgroundColor: colores.fondo, padding: 10, fontSize: 13 },
  aviso: { borderTopWidth: 1, borderTopColor: colores.borde, paddingVertical: 10, gap: 4 },
  avisoTitulo: { color: colores.tinta, fontSize: 16, fontWeight: '700' },
  fecha: { color: colores.secundario, fontSize: 12 },
  identificador: { color: colores.verde, fontSize: 14, fontWeight: '700' },
  progreso: { gap: 10 },
  paso: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  punto: { width: 11, height: 11, borderRadius: 6, backgroundColor: colores.borde },
  puntoActivo: { backgroundColor: colores.verde },
  pasoActual: { color: colores.verde, fontWeight: '700' },
});
