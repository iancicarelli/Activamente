# Backend ActivaMente — Ejecución y endpoints

Guía rápida para levantar el backend FastAPI y referencia de todos los endpoints
disponibles.

---

## Cómo levantar el backend

El backend corre en Docker junto con su base de datos PostgreSQL.

### Levantar el stack (recomendado)

Desde la **raíz del repo** (`activamente/`):

```bash
docker compose up --build
```

Esto levanta dos servicios:

- `backend` → FastAPI en `http://localhost:8000`
- `db` → PostgreSQL en `localhost:5432` (se inicializa con `init.sql` + `seed.sql`
  la primera vez)

### Resetear el backend (recrea la base desde cero)

```bash
docker compose down && docker compose up --build
```

> `docker compose down` borra los contenedores; al volver a subir, la base se
> reinicializa corriendo `init.sql` y `seed.sql` de nuevo. Útil cuando cambiás el
> esquema SQL.

### Datos de conexión a la base

Las credenciales se definen en el archivo `.env` de la raíz del repo y
`docker-compose.yml` las inyecta al contenedor. Valores reales:

| Campo    | Valor            |
| -------- | ---------------- |
| Host     | `localhost`      |
| Port     | `5432`           |
| User     | `activamente`    |
| Password | `change_me`      |
| DB       | `activamente_db` |

Connection string (desde tu máquina):

```
postgresql://activamente:change_me@localhost:5432/activamente_db
```

```bash
psql -h localhost -p 5432 -U activamente -d activamente_db
```

> El usuario/DB de Postgres solo se crean la **primera vez** que arranca el
> contenedor (volumen vacío). Si cambiaste el `.env` después de la primera
> corrida, las credenciales viejas quedan grabadas en el volumen: reinicializalo
> con `docker compose down -v && docker compose up --build` (el flag `-v` **borra
> los datos** y vuelve a sembrar `init.sql` + `seed.sql`).

### Docs interactivas (Swagger)

Con el backend arriba: **http://localhost:8000/docs**

---

## Autenticación

La mayoría de los endpoints requieren un JWT. Flujo:

1. `POST /api/auth/login` con `email` + `password` → devuelve `access_token`.
2. Enviar el token en cada request protegido:
   `Authorization: Bearer <access_token>`

Usuarios de desarrollo (admin / specialist / patient) y sus contraseñas están
documentados en el header de `database/seed.sql`.

---
http://localhost:8000/docs
## Endpoints disponibles

Leyenda de protección:
- 🔓 público
- 🔒 cualquier usuario autenticado (`get_current_user`)
- 👑 solo ADMIN (`require_admin`)
- 🩺 solo SPECIALIST (`require_specialist`)
- 🧍 solo PATIENT (`require_patient`)

### Auth — `/api/auth`

| Método | Ruta              | Prot. | Descripción |
| ------ | ----------------- | ----- | ----------- |
| POST   | `/api/auth/login` | 🔓    | Login con `email`/`password`. Devuelve `access_token`, `token_type`, `role`, `user_id`. |

### Users — `/api/users`

| Método | Ruta                       | Prot. | Descripción |
| ------ | -------------------------- | ----- | ----------- |
| GET    | `/api/users`               | 👑    | Lista usuarios. Query opcional `search` (nombre/email) y `role` (`admin`/`especialista`/`paciente`). Devuelve `UserListItem[]`. |
| PATCH  | `/api/users/{user_id}/status` | 👑 | Activa/desactiva un usuario (`is_active` en el body). No permite que el admin se desactive a sí mismo (400). |
| POST   | `/api/users`               | 👑    | Crea un usuario (+ fila `Patient`/`Specialist` según rol) con password temporal generado (`temp_password` en la respuesta). 409 si el email existe. |

### Patients — `/api/patients`

| Método | Ruta                              | Prot. | Descripción |
| ------ | --------------------------------- | ----- | ----------- |
| GET    | `/api/patients/`                  | 🔒    | Lista todos los pacientes. |
| GET    | `/api/patients/by-rut/{rut}`      | 🩺    | Busca un paciente por RUT. 404 si no existe. |
| GET    | `/api/patients/{patient_id}`      | 🔒    | Detalle de un paciente por id. 404 si no existe. |
| POST   | `/api/patients/assign`            | 🩺    | Asigna (por RUT en el body) el paciente al especialista del token. 409 si ya está asignado. |
| PATCH  | `/api/patients/{patient_id}/status` | 🔒  | Activa/desactiva un paciente (`active` en el body). |

### Exercises (biblioteca) — `/api/exercises`

| Método | Ruta             | Prot. | Descripción |
| ------ | ---------------- | ----- | ----------- |
| GET    | `/api/exercises` | 🔒    | Lista completa de ejercicios (`id`, `name`, `description`, `multimedia_url`). |

### Routines — `/api/routines`

| Método | Ruta                              | Prot. | Descripción |
| ------ | --------------------------------- | ----- | ----------- |
| POST   | `/api/routines`                   | 🩺    | Crea una rutina + sus `routine_exercises` en una transacción. `specialist_id` se toma del token. Body: `RoutineCreate`. |
| GET    | `/api/routines?patient_id={uuid}` | 🔒    | Lista las rutinas de un paciente (query param `patient_id` obligatorio), con sus ejercicios anidados. |

### Sessions — `/api/sessions`

| Método | Ruta                                                  | Prot. | Descripción |
| ------ | ----------------------------------------------------- | ----- | ----------- |
| POST   | `/api/sessions`                                       | 🔒    | Crea una sesión para un paciente + rutina (`is_completed=False`). |
| POST   | `/api/sessions/{session_id}/complete`                 | 🔒    | Marca la sesión como completada. 404 si no existe. |
| PUT    | `/api/sessions/{session_id}/exercises/{session_exercise_id}` | 🔒 | Persiste series/reps (y `accuracy_score`/`feedback` opcionales) de un ejercicio terminado. 404 si no existe la fila. |

### Surveys — `/surveys`

> ⚠️ Ojo: este router cuelga de `/surveys`, **no** de `/api/surveys` como el resto.

| Método | Ruta             | Prot. | Descripción |
| ------ | ---------------- | ----- | ----------- |
| POST   | `/surveys/pre`   | 🧍    | Encuesta previa a la sesión. Body `SurveyCreatePre` (`session_id`, `pain_level` 1-10, `fatigue_level` 1-10, `comments?`). Guarda `type='PRE_SESSION'`. |
| POST   | `/surveys/post`  | 🧍    | Encuesta posterior. Body `SurveyCreatePost` (`session_id`, `mood_level` 1-5, `comments?`). Mapea `mood_level → fatigue_level`, `type='POST_SESSION'`. |

### Otros

| Método | Ruta | Prot. | Descripción |
| ------ | ---- | ----- | ----------- |
| GET    | `/`  | 🔓    | Healthcheck placeholder, devuelve `{"message": "Hello World"}`. |

---

## Flujo de una sesión de ejercicio (referencia)

```
PatientHome
  → POST /api/sessions                                  crea la sesión al iniciar
  → PUT  /api/sessions/{id}/exercises/{seid}            guarda progreso por serie
  → POST /api/sessions/{id}/complete                    marca completada al terminar
  → PatientHistory
```

### Consultas SQL útiles para depurar

```sql
SELECT * FROM sessions;
SELECT * FROM session_exercises;
SELECT * FROM routines;
SELECT * FROM routine_exercises;
```
