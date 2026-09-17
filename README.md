# ActivaMente

App móvil de rehabilitación física guiada por cámara para adultos mayores. El paciente hace
ejercicios frente a la cámara frontal; MediaPipe detecta la pose y la app cuenta repeticiones
y corrige la postura. Los especialistas asignan rutinas y agendan citas; los administradores
gestionan usuarios.

| Directorio | Qué es |
| --- | --- |
| `activamente-back/` | API FastAPI + PostgreSQL 16 (Docker) |
| `activamente-front/` | App Expo 54 / React Native (Android, dev build) |

> **La app se prueba en un teléfono Android real, conectado por USB y hablándole al backend
> por la red local (WiFi).** El emulador de Android Studio no se usa: consume demasiada RAM y
> se cae, y además el plugin nativo de cámara necesita una cámara de verdad.
>
> Resumen del camino: levantar el backend → abrir los puertos del PC → conectar el teléfono →
> comprobar desde el teléfono que ve la API → recién ahí compilar y correr la app.

---

## Requisitos

| Herramienta | Versión probada | Para qué |
| --- | --- | --- |
| Docker + Docker Compose | 29.x / v5.x | Backend y base de datos |
| Node.js + npm | 22.x | Expo / Metro |
| JDK | 17 (Temurin) | Compilar el APK de desarrollo |
| Android SDK + `platform-tools` (`adb`) | — | Instalar la app en el teléfono |
| Teléfono Android | 8.0+, con cámara frontal | Ejecutar la app |

`adb` tiene que estar en el `PATH`. Si instalaste el SDK con Android Studio suele quedar en
`~/Android/Sdk/platform-tools`:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
adb version        # debe imprimir la versión
```

**El PC y el teléfono tienen que estar en la misma red WiFi** (el teléfono no puede estar en
datos móviles). Si tu red no lo permite, mirá [Plan B: todo por USB](#plan-b-todo-por-usb-sin-wifi).

---

## Paso 1 — Levantar el backend

```bash
cp .env.example .env     # completar SECRET_KEY (ver el comentario dentro del archivo)
docker compose up --build
```

Deja esa terminal abierta. La API queda en el puerto **8420** y Postgres en **55432** (puertos
no predeterminados a propósito, para no chocar con otros proyectos).

Comprobación desde el PC:

```bash
curl http://localhost:8420/health     # {"status":"ok"}
```

Swagger para explorar la API: <http://localhost:8420/docs>.

Para recrear la base de datos desde cero (vuelve a correr `init.sql` + `seed.sql`):

```bash
docker compose down -v && docker compose up --build
```

---

## Paso 2 — Averiguar la IP de tu PC en la red

```bash
hostname -I | awk '{print $1}'      # p. ej. 192.168.1.88
# o, más explícito:
ip -4 addr show scope global | grep inet
```

Anotá la IP de tu interfaz WiFi (algo como `192.168.1.88` o `10.0.x.x`). **Ignorá las
`172.17-172.26.x.x`: esas son redes internas de Docker y el teléfono no las alcanza.**

> La IP la asigna el router por DHCP y puede cambiar al reconectar. Si eso pasa hay que
> actualizar el `.env` del frontend (Paso 5). Lo más cómodo es reservarle una IP fija al PC
> en el router.

---

## Paso 3 — Abrir los puertos en el firewall del PC

El teléfono necesita llegar a dos puertos TCP de tu PC:

| Puerto | Servicio |
| --- | --- |
| **8420** | API FastAPI |
| **8421** | Metro / servidor de desarrollo de Expo |

**Fedora / RHEL (firewalld):**

```bash
firewall-cmd --list-all                         # ¿ya están abiertos?
sudo firewall-cmd --permanent --add-port=8420/tcp --add-port=8421/tcp
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports                  # debe listar 8420/tcp y 8421/tcp
```

> En Fedora Workstation la zona por defecto (`FedoraWorkstation`) ya trae abierto el rango
> `1025-65535/tcp`, así que puede que no haya que tocar nada. Verificá con `--list-all` antes.

**Ubuntu / Debian (ufw):**

```bash
sudo ufw allow 8420/tcp
sudo ufw allow 8421/tcp
sudo ufw status
```

**Comprobación (desde el PC, usando la IP real, no `localhost`):**

```bash
curl http://192.168.1.88:8420/health     # reemplazá por TU IP → {"status":"ok"}
```

Si esto falla, el problema es del backend o del firewall, no del teléfono. Resolvelo acá antes
de seguir.

---

## Paso 4 — Conectar el teléfono Android

1. **Activar opciones de desarrollador**: Ajustes → Acerca del teléfono → tocá
   *Número de compilación* 7 veces.
2. **Activar depuración USB**: Ajustes → Sistema → Opciones de desarrollador →
   *Depuración por USB* (y *Instalar vía USB* si tu marca lo pide).
3. Conectá el teléfono al PC con un **cable de datos** (muchos cables baratos son solo de carga).
4. En el teléfono aparece *¿Permitir depuración USB?* → **Permitir** y marcar
   *Siempre permitir desde este equipo*.
5. Verificá desde el PC:

```bash
adb devices
# List of devices attached
# R58M12AB3CD     device        ← tiene que decir "device", no "unauthorized" ni "offline"
```

6. Conectá el teléfono a **la misma WiFi que el PC** (y desactivá los datos móviles mientras
   pruebes, para que no salga por ahí).

---

## Paso 5 — Apuntar la app a tu backend

```bash
cd activamente-front
cp .env.example .env
```

Editá `.env` y poné la IP del Paso 2:

```
EXPO_PUBLIC_API_URL=http://192.168.1.88:8420
```

> Sin esta variable la app intenta `10.0.2.2:8420`, que es la dirección del host **para el
> emulador**: en un teléfono real no funciona.

---

## Paso 6 — Comprobar desde el teléfono que ve la API

Antes de compilar nada, abrí el navegador **del teléfono** y entrá a:

```
http://192.168.1.88:8420/health
```

Tiene que responder `{"status":"ok"}`.

- Si responde: red, firewall y backend están OK. Seguí al Paso 7.
- Si no responde: el problema es de red, no de la app. Revisá que ambos estén en la misma WiFi,
  que la IP sea la correcta, que el firewall tenga el puerto abierto y que el router no tenga
  *aislamiento de clientes* (AP isolation) activado. Si no lo podés resolver, usá el
  [Plan B por USB](#plan-b-todo-por-usb-sin-wifi).

---

## Paso 7 — Compilar y ejecutar la app

Con el teléfono conectado (`adb devices` lo muestra) y el backend arriba:

```bash
cd activamente-front
npm install
npm run android        # compila el dev build y lo instala en el teléfono (Metro en :8421)
```

La primera compilación descarga Gradle y las dependencias nativas: **puede tardar 10-20 minutos**.
Al terminar, la app se abre sola en el teléfono y queda conectada a Metro.

La app usa un **development build** (`expo-dev-client`) porque incluye un plugin nativo de
cámara con MediaPipe: **no funciona en Expo Go**.

Iniciá sesión con cualquiera de los usuarios de prueba del seed:

| Rol | Email | RUT | Contraseña |
| --- | --- | --- | --- |
| Admin | `admin@activamente.cl` | — | `Admin1234!` |
| Especialista (con paciente) | `maria.gonzalez@activamente.cl` | `12345678-5` | `Specialist1234!` |
| Paciente (con rutina para hoy) | `pedro.soto@test.com` | `98765432-5` | `Patient1234!` |

(La lista completa está en `activamente-back/database/seed.sql`. Son datos falsos de desarrollo.)

---

## Uso diario (después de la primera vez)

No hace falta recompilar todos los días: la app ya está instalada en el teléfono.

```bash
# Terminal 1 — backend
docker compose up

# Terminal 2 — Metro
cd activamente-front && npm start        # agregá  -- -c  para limpiar caché tras cambiar .env
```

Después abrí la app en el teléfono (debe estar en la misma WiFi). Si no se conecta sola,
sacudí el teléfono → *Settings* → *Enter URL manually* → `http://<IP-de-tu-PC>:8421`.

Hay que volver a correr `npm run android` solo cuando cambian dependencias o código nativo
(`android/`, plugins de Expo nuevos).

---

## Plan B: todo por USB (sin WiFi)

Si la WiFi no deja que el teléfono vea al PC (redes de universidad, hoteles, AP isolation), se
puede tunelizar todo por el cable USB con `adb reverse`:

```bash
adb reverse tcp:8420 tcp:8420      # API
adb reverse tcp:8421 tcp:8421      # Metro
```

Y en `activamente-front/.env`:

```
EXPO_PUBLIC_API_URL=http://localhost:8420
```

Luego `npm start -- -c`. Con esto `localhost` dentro del teléfono apunta a tu PC.

> Los `adb reverse` se pierden al desconectar el cable o reiniciar `adb`: hay que volver a
> correrlos. En este modo no hace falta abrir puertos en el firewall.

---

## Verificación antes de dar algo por terminado

```bash
# Backend (con la DB arriba: docker compose up -d db)
cd activamente-back && pip install -r requirements-dev.txt
pytest && ruff check app tests

# Frontend
cd activamente-front
npm run typecheck && npm run lint && npm test
```

---

## Problemas frecuentes

| Síntoma | Qué hacer |
| --- | --- |
| `adb devices` muestra `unauthorized` | Aceptar el diálogo en el teléfono y marcar *Siempre permitir*. Si no aparece: `adb kill-server && adb start-server` y reconectar. |
| `adb devices` no muestra nada | Probar otro cable (que sea de datos) u otro puerto USB; revisar que *Depuración USB* siga activa. |
| La app dice "Sin conexión" | Probar `http://<IP>:8420/health` en el navegador del teléfono (Paso 6). Si responde, el `.env` está mal: revisá `EXPO_PUBLIC_API_URL` y reiniciá Metro con `npm start -- -c`. |
| Funcionaba ayer y hoy no | Lo más probable es que cambió la IP del PC (DHCP). Repetí los pasos 2, 5 y `npm start -- -c`. |
| Metro no conecta con la app | Sacudir el teléfono → *Settings* → *Enter URL manually* → `http://<IP-de-tu-PC>:8421`. |
| Error al instalar por firma distinta | `adb uninstall com.activamente.app` y volver a `npm run android`. |
| Cambié el `.env` y no toma el valor nuevo | Las `EXPO_PUBLIC_*` se inyectan al compilar el bundle: `npm start -- -c`. |
| Agregué un módulo nativo y crashea | Recompilar el dev build: `npm run android`. |
| Errores raros de base de datos tras cambiar el esquema | No hay migraciones: `docker compose down -v && docker compose up --build`. |
