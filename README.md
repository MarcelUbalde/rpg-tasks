# RPG Tasks

Sistema de gamificación para equipos de desarrollo. Cada tarea completada o bug resuelto en Jira otorga recompensas RPG a los desarrolladores: EXP para subir de nivel y oro por corregir bugs.

## Stack

- **Node.js 22** — ES modules (`"type": "module"`)
- **Express 4.18** — servidor HTTP
- **PostgreSQL** — base de datos via `pg`
- **Vitest 1.6** — tests unitarios
- **Frontend** — HTML + JS vanilla (Canvas API para avatares, sin framework ni bundler)

## Inicio rapido

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con la conexion a tu base de datos Postgres

# 3. Aplicar migraciones
npm run migrate

# 4. Arrancar el servidor
npm start
# o en modo watch:
npm run dev
```

Abrir http://localhost:3000 en el navegador.

## Variables de entorno

| Variable | Por defecto | Descripcion |
|---|---|---|
| `DATABASE_URL` | — | URL de conexion Postgres (requerida) |
| `PORT` | `3000` | Puerto del servidor |
| `NODE_ENV` | `development` | `production` deshabilita los endpoints `/api/dev/*` |
| `JIRA_WEBHOOK_SECRET` | — | Secret para autenticar los webhooks de Jira |
| `JIRA_DONE_STATUS_NAME` | `Done` | Nombre del estado "terminado" en Jira |
| `JIRA_SP_FIELD` | `customfield_10009` | Campo Jira de Story Points |
| `JIRA_SEVERITY_FIELD` | _(vacio)_ | Campo Jira de severidad (solo para bugs) |
| `JIRA_DEVELOPERS_FIELD` | `customfield_10819` | Campo Jira con los desarrolladores asignados |
| `JIRA_QA_FIELD` | _(vacio)_ | Campo Jira con el QA asignado (user picker simple) |
| `JIRA_BUG_ISSUE_TYPES` | `Error,Defecto` | Issuetypes que se tratan como bug (otorgan oro). Separados por coma. |
| `JIRA_TASK_ISSUE_TYPES` | `Technical Story,Historia,Tarea` | Issuetypes que se tratan como tarea (otorgan EXP). El resto se ignora. |
| `USER_MAP_JSON` | `{}` | JSON que mapea Jira accountId a RPG userId |

Ejemplo de `USER_MAP_JSON`:
```json
{"jira-account-id-abc": "u1", "jira-account-id-xyz": "u2"}
```

## Scripts

```bash
npm start          # Arranca el servidor
npm run dev        # Arranca con --watch (recarga automatica)
npm test           # Ejecuta todos los tests
npm run migrate    # Aplica las migraciones SQL pendientes
npm run reset-db   # Reinicia la base de datos (DESTRUCTIVO)
```

## Arquitectura

El proyecto sigue un diseno DDD ligero con cuatro capas:

```
server/
  domain/          # Funciones puras, sin efectos secundarios
  application/     # Casos de uso (orquestacion)
  infrastructure/  # Repositorios Postgres, pool de conexiones
  routes/          # Rutas Express (validacion de input, HTTP)
  config/          # Configuracion centralizada (Jira)
public/            # Frontend estatico (HTML, CSS, JS)
migrations/        # Archivos SQL de migraciones
test/              # Tests unitarios
```

### Domain

- **[User.js](server/domain/User.js)** — funciones puras para crear usuarios, ganar EXP, subir de nivel y ganar oro. La progresion de niveles usa costes Fibonacci.
- **[Task.js](server/domain/Task.js)** — value object de tarea (id + storyPoints).
- **[RewardService.js](server/domain/RewardService.js)** — aplica EXP por tarea completada y construye el mensaje de log.
- **[BugReward.js](server/domain/BugReward.js)** — mapea severidad a oro: Low=1, Medium=2, High=3, Critical=5.

### Application (casos de uso)

| Archivo | Descripcion |
|---|---|
| [completeTask.js](server/application/completeTask.js) | Flujo legacy single-user: valida duplicado, aplica EXP, guarda. |
| [awardTaskExpToUsers.js](server/application/awardTaskExpToUsers.js) | Award de EXP a multiples usuarios por una tarea (idempotente). |
| [awardBugGoldToUsers.js](server/application/awardBugGoldToUsers.js) | Award de oro a multiples usuarios por un bug (idempotente). |
| [applyRewardEventToUsers.js](server/application/applyRewardEventToUsers.js) | Aplica un reward_event existente a una lista de usuarios en transaccion. |
| [createTaskRewardEvent.js](server/application/createTaskRewardEvent.js) | Crea un evento tipo TASK sin aplicarlo aun. |
| [createBugRewardEvent.js](server/application/createBugRewardEvent.js) | Crea un evento tipo BUG sin aplicarlo aun. |
| [jira/handleJiraWebhook.js](server/application/jira/handleJiraWebhook.js) | Orquesta el flujo completo del webhook de Jira. |
| [jira/parseJiraDoneEvent.js](server/application/jira/parseJiraDoneEvent.js) | Parsea el body del webhook; devuelve null si no es transicion a Done. |
| [jira/resolveRecipientUserIds.js](server/application/jira/resolveRecipientUserIds.js) | Mapea Jira accountIds a RPG userIds (prioridad: campo developers > assignee). |

### Idempotencia y reward events

Los awards de multi-usuario funcionan en dos fases:

1. **`assertSameOrCreate`** — inserta el `reward_event` (tipo + clave externa) de forma atomica via CTE en Postgres. Si la clave ya existe con el mismo payload, devuelve el existente. Si existe con payload distinto, lanza error `payload_mismatch` (HTTP 409).
2. **`insertIfNotExists`** — inserta la fila en `reward_event_users` solo si no existe. Si ya existe, devuelve `{ rewarded: false, reason: "duplicate" }` sin modificar al usuario.

Esto garantiza que reintentar el mismo webhook de Jira es seguro.

### Infrastructure

- **[db.pg.js](server/infrastructure/db.pg.js)** — pool Postgres + propagacion de transacciones via `AsyncLocalStorage`. `runInTransaction(fn)` envuelve `fn` en BEGIN/COMMIT/ROLLBACK; cualquier repositorio que llame `getDb()` dentro de esa funcion usa automaticamente el mismo cliente, sin necesidad de pasarlo explicitamente.
- **Repositorios** — cada entidad tiene un factory `.pg.factory.js` que devuelve el objeto repositorio usando `getDb()` en tiempo de query.

## API

### Endpoints publicos

| Metodo | Ruta | Descripcion |
|---|---|---|
| `GET` | `/api/user` | Estado del usuario `local` (nivel, EXP, oro, etapa de evolucion) |
| `GET` | `/api/users` | Lista todos los usuarios |
| `GET` | `/api/users/:userId/rewards` | Historial de rewards del usuario (`?limit=20`). Incluye issueKey, summary, storyPoints y severity. |
| `GET` | `/api/leaderboard` | Ranking de usuarios ordenado por nivel, EXP y oro. Excluye el usuario `local`. |
| `GET` | `/api/activity` | Feed global de actividad del equipo (`?limit=50`, max 200). Muestra todas las recompensas concedidas con contexto Jira. |
| `GET` | `/api/log` | Log de recompensas recientes del usuario `local` (`?limit=10`) |
| `POST` | `/api/tasks/complete` | Completa una tarea y otorga EXP al usuario `local` |
| `POST` | `/api/jira/webhook` | Recibe webhooks de Jira (requiere header `X-RPG-Secret`) |

#### Respuesta de `/api/leaderboard`

```json
{
  "leaderboard": [
    { "rank": 1, "userId": "u1", "level": 5, "exp": 8, "gold": 12 }
  ]
}
```

#### Respuesta de `/api/activity`

```json
{
  "items": [
    {
      "createdAt": "2026-03-08T10:00:00.000Z",
      "type": "TASK",
      "issueKey": "HU-123",
      "summary": "Implementar login",
      "storyPoints": 3,
      "severity": null,
      "userId": "u1",
      "expAwarded": 3,
      "goldAwarded": 0
    }
  ]
}
```

### Endpoints de desarrollo (solo `NODE_ENV !== production`)

| Metodo | Ruta | Body | Descripcion |
|---|---|---|---|
| `POST` | `/api/dev/reset` | — | Resetea el usuario `local` a L1 |
| `POST` | `/api/dev/reset-multi` | — | Resetea `u1`, `u2` y `u3` a L1 y limpia `reward_event_users` |
| `POST` | `/api/dev/add-gold` | `{ amount }` | Anade oro al usuario `local` |
| `POST` | `/api/dev/award-task` | `{ taskId, storyPoints, userIds }` | Otorga EXP por tarea a un array de usuarios |
| `POST` | `/api/dev/award-bug` | `{ jiraKey, severity, userIds }` | Otorga oro por bug a un array de usuarios |
| `POST` | `/api/dev/jira/task-done` | `{ issueKey, doneEventId, storyPoints, userIds }` | Simula un webhook de Jira Done (task) |
| `POST` | `/api/dev/create-task-event` | `{ taskId, storyPoints }` | Crea un reward_event tipo TASK sin aplicarlo |
| `POST` | `/api/dev/create-bug-event` | `{ jiraKey, severity }` | Crea un reward_event tipo BUG sin aplicarlo |
| `POST` | `/api/dev/apply-event` | `{ eventId, userIds }` | Aplica un reward_event existente a un array de usuarios |

### Webhook de Jira

```
POST /api/jira/webhook
X-RPG-Secret: <JIRA_WEBHOOK_SECRET>
Content-Type: application/json
```

El webhook procesa transiciones al estado configurado en `JIRA_DONE_STATUS_NAME`:

- **Issues tipo "Bug"** — otorga oro segun el campo de severidad (`JIRA_SEVERITY_FIELD`).
- **Resto de issues** — otorga EXP segun los Story Points (`JIRA_SP_FIELD`).

La clave de idempotencia es `{issueKey}-done-{changelog.id}`, lo que permite reintentos seguros.

**Resolucion de destinatarios:**
1. Se extraen los usuarios del campo `JIRA_DEVELOPERS_FIELD` (array de usuarios).
2. Si `JIRA_QA_FIELD` esta configurado, se añade ese usuario tambien.
3. Se deduplican accountIds antes de mapear.
4. Los Jira accountIds se traducen a RPG userIds via `USER_MAP_JSON`. Los no mapeados se reportan en `unmappedRecipients`.

**Codigos de error:**

| HTTP | Codigo | Descripcion |
|---|---|---|
| 400 | `missing_sp` | El campo de Story Points es nulo (issue sin estimar) |
| 400 | `invalid_sp` | El campo de SP no es un numero |
| 400 | `sp_not_estimated` | SP <= 0 |
| 400 | `invalid_severity` | Severidad no mapeada |
| 400 | `severity_field_not_configured` | `JIRA_SEVERITY_FIELD` no configurado |
| 409 | `payload_mismatch` | La clave ya existe con un payload diferente (SP o severidad cambiados) |

### Configuracion para Vibia

Los custom fields de Jira **no son universales** — cada instancia tiene IDs distintos.
Los siguientes valores estan confirmados para la instancia de Vibia a partir de la issue DV-6064.
La aplicacion sigue siendo configurable por variables de entorno para cualquier otra instancia.

#### Campos confirmados

| Variable | Valor confirmado | Notas |
|---|---|---|
| `JIRA_DONE_STATUS_NAME` | `Finalizada` | Nombre exacto del estado Done en Vibia (`statusCategory.key = "done"`) |
| `JIRA_SP_FIELD` | `customfield_10009` | Story Points; coincide con el valor por defecto del codigo |
| `JIRA_DEVELOPERS_FIELD` | `customfield_10819` | Array de usuarios; coincide con el valor por defecto del codigo |
| `JIRA_QA_FIELD` | `customfield_10818` | User picker simple (QA Analyst) |
| `JIRA_BUG_ISSUE_TYPES` | `Error,Defecto` | Issuetypes de bug en Vibia |
| `JIRA_TASK_ISSUE_TYPES` | `Technical Story,Historia,Tarea` | Issuetypes de tarea en Vibia |

#### Comportamiento de bugs en Vibia

En Vibia **no existe un campo de severidad separado**. La severidad funcional proviene de `fields.priority.name`. El codigo normaliza nombres en español al formato canonico ingles que usa `BugReward.js`.

| Aspecto | Valor en Vibia |
|---|---|
| Issuetypes de bug | `"Error"`, `"Defecto"` |
| Campo de severidad funcional | `fields.priority.name` |
| Ejemplo real | `priority.name = "Critica"` → `Critical` → 5 oro |

> Issuetypes no incluidos en ninguna de las dos listas (Epic, Test, Test Set, etc.) se ignoran sin otorgar recompensas (`reason: "unsupported_issuetype"`).

#### Ejemplo de USER_MAP_JSON para Vibia (entorno de desarrollo)

```json
{
  "712020:eb206518-3f3b-4297-87a8-d2ab988baf23": "u1",
  "712020:12a1eecc-1308-4946-b4e0-b2a7e1c905a0": "u2",
  "712020:8a73806b-493b-49c8-a003-5a9af5d4c4c2": "u3"
}
```

Este mapeo es un ejemplo local (Marcel→u1, Alejandro→u2, Luis Enrique→u3).
En produccion, los userId deben corresponder a los usuarios reales en la base de datos RPG.

## Base de datos

### Esquema

| Tabla | Descripcion |
|---|---|
| `users` | Usuarios con nivel, EXP (NUMERIC 12,2) y oro |
| `rewarded_tasks` | Registro legacy de tareas recompensadas (flujo single-user) |
| `reward_log` | Log de mensajes de recompensa |
| `reward_events` | Eventos inmutables (TASK o BUG), clave unica por `(type, external_key)`. Incluye metadatos Jira: `issue_key`, `summary`, `story_points`, `severity`. |
| `reward_event_users` | Relacion evento-usuario, unica por `(event_id, user_id)` |

### Usuarios semilla

La migracion inicial crea cuatro usuarios: `local`, `u1`, `u2`, `u3`, todos en L1 con 0 EXP y 0 oro.

### Migraciones

```bash
npm run migrate   # aplica migrations/NNN_*.sql en orden, omite los ya aplicados
```

| Archivo | Descripcion |
|---|---|
| `001_initial_schema.sql` | Esquema completo + usuarios semilla (`local`, `u1`, `u2`) |
| `002_exp_decimal.sql` | Cambia `exp` de INTEGER a NUMERIC(12,2) para soportar SP decimales |
| `003_seed_u3.sql` | Anade el usuario `u3` |
| `004_reward_event_metadata.sql` | Anade columnas de metadatos Jira a `reward_events` (`issue_key`, `summary`, `story_points`, `severity`) |

## Sistema de progresion

### EXP y niveles (Fibonacci)

| Transicion | Coste EXP |
|---|---|
| L1 -> L2 | 1 |
| L2 -> L3 | 2 |
| L3 -> L4 | 3 |
| L4 -> L5 | 5 |
| L5 -> L6 | 8 |
| L6 -> L7 | 13 |
| ... | ... |

Una sola tarea puede provocar multiples subidas de nivel si el EXP acumulado es suficiente.

### Oro por bugs

| Severidad | Oro |
|---|---|
| Low | 1 |
| Medium | 2 |
| High | 3 |
| Critical | 5 |

### Avatar

El avatar se dibuja en un `<canvas>` y cambia de color segun el nivel:

| Nivel | Color |
|---|---|
| 1 | Gris |
| 2-3 | Verde |
| 4-5 | Azul |
| 6-7 | Morado |
| 8+ | Dorado |

La etapa de evolucion (0-5) cambia cada 2 niveles, comenzando en L1.

## Mensajes de log

| Evento | Formato |
|---|---|
| Subida de nivel | `+N nivel(es) — TASK-ID (X SP)` |
| Solo EXP (sin level-up) | `+X EXP — TASK-ID (X SP)` |

## Tests

```bash
npm test
```

| Archivo | Que prueba |
|---|---|
| `test/completeTask.test.js` | Flujo completo single-user con repos in-memory |
| `test/awardMultiUser.test.js` | Award de EXP/oro a multiples usuarios, idempotencia |
| `test/splitEventApplication.test.js` | Separacion create-event / apply-event |
| `test/rewardHistory.test.js` | Historial de rewards por usuario |
| `test/jiraWebhook.test.js` | Parsing y orquestacion del webhook de Jira |
| `test/devRouteValidation.test.js` | Validacion de inputs en rutas dev |
| `test/userIds.test.js` | Deduplicacion de userIds |
| `test/pgCoerce.test.js` | Coercion de NUMERIC de Postgres a numero JS |
| `test/leaderboard.test.js` | Funcion pura `buildLeaderboard()` — ranking y asignacion de posiciones |
| `test/activity.test.js` | Funcion pura `mapActivityRow()` — mapeo y coercion de filas del feed de actividad |

Los tests de dominio y aplicacion usan repos in-memory sin dependencia de base de datos.
