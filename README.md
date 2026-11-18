# Actividad 21 · Seguimiento de solicitudes

[Descargar el APK firmado para Android](https://github.com/AxXel701/actividad-21-notificaciones-push/releases/tag/v1.0.0)

Prototipo móvil en React Native y Expo SDK 58. Sigue la solicitud de ejemplo **SOL-001** y recibe sus cambios mediante **Expo Push Notifications**. La prueba está preparada para Android con Firebase Cloud Messaging v1. El código móvil incluye configuración y lógica para iOS, que requiere credenciales propias de APNs.

La versión vinculada usa el proyecto Expo `@axeloooooo/seguimiento-solicitudes` y el proyecto Firebase `actividad21-push-4397a7`. El paquete Android es `com.equipos.seguimientosolicitudes`. El archivo `google-services.json` contiene la configuración cliente registrada para ese paquete. La clave privada FCM se administra en Expo Credentials.

## Cómo viaja una notificación

```text
Dispositivo → Expo (registro con projectId) → ExpoPushToken
Terminal del equipo (evento + token) → Expo Push API → FCM v1 → Android
Android → muestra el aviso → usuario toca → app abre el detalle de SOL-001
```

El token de destino identifica a esta instalación de la app para el proyecto de Expo. La app lo solicita después de obtener permiso y el equipo lo entrega de forma privada al emisor. El emisor lo usa en el campo `to` para dirigir el mensaje a ese dispositivo. El token de acceso de Expo autentica al emisor y se administra aparte. El sistema operativo recibe y presenta el aviso cuando la app está en segundo plano. Con la app abierta, la notificación activa el listener, permite mostrar un banner y se agrega a «Avisos recibidos». Al tocar, incluso al iniciar la app desde una alerta del sistema, se abre el detalle de SOL-001. La app conserva los avisos que procesa en un historial local y revisa los que siguen en la bandeja al abrirse.

Expo Push simplifica el envío con una API y un formato de mensaje común. FCM directo también es viable y usa el token nativo de Firebase, credenciales OAuth 2.0 y su propia API. En esta práctica, Expo se comunica con FCM por el equipo. Si se extiende a iOS, Expo reenvía mediante APNs.

## 1. Vincular Expo y configurar Firebase para Android

Para reconstruir esta versión desde la cuenta Expo propietaria, ejecuta `npm ci` y `npx eas-cli@latest build --platform android --profile preview`. Los siguientes pasos permiten repetir la configuración con otro proyecto del equipo.

1. Instala Node.js 22.13 o superior. Abre una terminal en la carpeta que contiene `package.json` y ejecuta `npm ci`.
2. Si vas a personalizar el identificador Android `com.equipos.seguimientosolicitudes`, edita `expo.android.package` en `app.json` antes de registrar la app en Firebase.
3. Ejecuta `npx eas-cli@latest login` y `npx eas-cli@latest project:init`. Comprueba que `app.json` contenga `expo.extra.eas.projectId`. Si EAS solicita actualizar la configuración manualmente por el uso de `app.config.js`, agrega dentro de `expo` esta propiedad con el UUID real del proyecto.

   ```json
   "extra": { "eas": { "projectId": "UUID-REAL-DEL-PROYECTO" } }
   ```

4. En Firebase, crea o selecciona un proyecto del equipo y registra una aplicación Android con el mismo identificador del paso 2. Descarga `google-services.json` y colócalo junto a `app.json`. `app.config.js` incorpora ese archivo de configuración cliente en la compilación cuando está presente.
5. En el mismo proyecto de Firebase, habilita la API **Firebase Cloud Messaging API (V1)** y prepara una cuenta de servicio con el rol **Firebase Cloud Messaging API Admin** según la [guía de Expo para FCM v1](https://docs.expo.dev/push-notifications/fcm-credentials/). Desde **Credentials → Android → Service credentials → FCM V1 service account key** en el proyecto de EAS, carga el JSON de la cuenta de servicio. También puedes usar `npx eas-cli@latest credentials -p android` y seleccionar el perfil `preview`. Guarda el JSON privado fuera del proyecto móvil.
6. En la cuenta de Expo del equipo, activa la seguridad reforzada de push para el proyecto y genera un token de acceso autorizado. La [guía de seguridad de Expo Push](https://docs.expo.dev/push-notifications/sending-notifications/#additional-security) describe el ajuste y la cabecera de autenticación que usa el script.
7. Ejecuta `npx expo config --type public` y verifica localmente `extra.eas.projectId`, el paquete Android y `android.googleServicesFile`. Compila el APK con `npx eas-cli@latest build --platform android --profile preview` e instálalo desde el enlace de EAS en un Android con servicios de Google Play. El APK de este perfil lleva el JavaScript incluido. Las pruebas de push remoto se realizan con este APK.

## 2. Registrar el dispositivo y enviar los mensajes

1. Abre la aplicación y pulsa **Permitir notificaciones**. Concede el permiso en el diálogo del sistema. El canal Android `solicitudes` se crea antes de consultar el permiso y obtener el token.
2. Cuando aparezca **Dispositivo registrado**, pulsa **Mostrar token de prueba**. Copia el valor de forma privada y pulsa **Ocultar token**.
3. En la computadora desde la que se harán los envíos, crea `.env.push` junto a `package.json` con los valores reales. Tanto Git como EAS excluyen este archivo.

   ```dotenv
   EXPO_PUSH_TOKEN="ExpoPushToken[VALOR_REAL_DEL_DISPOSITIVO]"
   EXPO_ACCESS_TOKEN="VALOR_REAL_DE_ACCESO"
   ```

4. Comprueba la estructura del mensaje y realiza los envíos con estos comandos. Sustituye `ID_DEL_TICKET` por el valor que devuelve Expo para cada envío.

   ```sh
   npm run push -- vista en_proceso
   npm run push -- enviar registrado
   npm run push -- enviar en_proceso
   npm run push -- recibo ID_DEL_TICKET
   ```

   Envía `recibido` o `finalizado` para probar los otros estados. El comando `vista` imprime el JSON con el destinatario oculto. Cada `enviar` realiza una petición HTTPS a Expo. El ticket confirma que Expo aceptó el mensaje. El recibo indica si FCM o APNs lo aceptó. La aparición en el dispositivo se verifica aparte. Expo recomienda consultar el recibo aproximadamente 15 minutos después del envío.

| Estado enviado | Título | Cuerpo | `data.tipo` |
|---|---|---|---|
| `registrado` | Solicitud registrada | Tu solicitud se registró correctamente. | `solicitud_registrada` |
| `recibido` | Actualización de solicitud | El personal responsable recibió tu solicitud. | `cambio_estado` |
| `en_proceso` | Actualización de solicitud | Tu solicitud se encuentra en proceso | `cambio_estado` |
| `finalizado` | Actualización de solicitud | Tu solicitud ha finalizado. | `cambio_estado` |

Todos los mensajes usan `data.identificador = "SOL-001"` y `data.estado`. El script acepta únicamente estos cuatro estados y la app valida la combinación de identificador, tipo y estado antes de abrir un detalle interno.

## 3. Pruebas y capturas de la práctica

| Prueba | Acción | Resultado esperado y evidencia |
|---|---|---|
| Permiso y registro | En una instalación nueva, pulsa **Permitir notificaciones** y acepta. | Captura del diálogo del SO y de «Dispositivo registrado» con el token oculto. |
| Recepción 1 | Abre la app y ejecuta `npm run push -- enviar registrado`. | Alerta «Solicitud registrada» e ingreso en «Avisos recibidos». Guarda captura y ticket. |
| Recepción 2 | Envía la app a segundo plano con Inicio y ejecuta `npm run push -- enviar en_proceso`. | Alerta «Actualización de solicitud» en la bandeja. Guarda captura y ticket. |
| Selección | Toca la segunda alerta desde la bandeja. Repite el envío con la app cerrada desde recientes si quieres probar el arranque. | Se abre el detalle de SOL-001 y muestra «En proceso». Guarda captura del detalle. |
| Permiso denegado | Reinstala o borra datos para repetir el diálogo. Pulsa **No permitir**, o desactiva las notificaciones desde los ajustes del sistema. | Se indica que el permiso está denegado y la app no muestra ni solicita un token nuevo. Guarda captura de la app. Si verificas con el token anterior tras revocar el permiso, comprueba que el sistema no presente el aviso. |

`npm test` verifica el contrato de los cuatro mensajes, la lógica del historial y la respuesta a permisos, y usa respuestas HTTP simuladas para el envío autenticado, los tickets y los recibos. Las capturas del dispositivo corresponden a la prueba con credenciales reales.

## Seguridad

- El emisor usa HTTPS y envía un token de acceso como `Authorization: Bearer`. Si falta, el script detiene la operación antes de contactar Expo. La exigencia de autenticar todos los envíos se configura en el proyecto de Expo.
- La aplicación mantiene el token de destino oculto hasta que el equipo decide mostrarlo y no lo escribe al historial. El script no imprime tokens en la vista, los tickets ni los errores.
- El mensaje solo incluye el estado, el identificador de prueba y texto genérico. El canal Android solicita visibilidad privada en la pantalla bloqueada. El detalle se selecciona mediante el contrato interno del prototipo, sin abrir URLs recibidas en el mensaje.
- Ante `DeviceNotRegistered`, retira el token de `.env.push` y registra nuevamente el dispositivo. El prototipo toma un único destino, sin un padrón de usuarios. En el caso empresarial el servidor vincularía los tokens a usuarios autenticados y autorizaría el acceso a cada solicitud.

## Fuentes oficiales

- [Configuración de Expo Push](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [API de Expo Notifications](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/)
- [Credenciales de FCM v1 en Expo](https://docs.expo.dev/push-notifications/fcm-credentials/)
- [Envío, recibos y autenticación de Expo Push](https://docs.expo.dev/push-notifications/sending-notifications/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
