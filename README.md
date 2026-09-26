# Nido 🪺 — Ahorro en pareja

App móvil (React Native + Expo) para que las parejas ahorren juntas: saldo conjunto, metas compartidas, aportes por persona e historial. Diseño inspirado en la app de PayPal (paleta navy/azul, tarjeta de saldo con degradado, botones tipo píldora, teclado numérico para montos y pantalla de confirmación).

## Correr la app

```bash
npm install
npx expo start        # luego i (iOS), a (Android) o w (web)
```

## Estructura

```
src/
  app/                 # rutas (Expo Router)
    (tabs)/            # Inicio, Metas, Actividad, Pareja, Ajustes
    goal/[id].tsx      # detalle de meta
    transfer.tsx       # modal Aportar / Retirar (teclado numérico)
    new-goal.tsx       # modal Nueva meta
    login.tsx          # inicio de sesión / registro (correo o usuario) con switch animado
    link.tsx           # vincular cuentas con el código de usuario (NIDO-XXXXX)
    currency.tsx       # moneda de ahorro de la pareja
  components/          # UI reutilizable (Icon con Lucide, BalanceCard, TabBar, Keypad…)
  i18n/                # traducciones (es, en)
  providers/           # preferencias: idioma, tema, useTheme/useT/makeStyles
  services/backend.ts  # "backend" local: cuentas, sesión, vinculación y datos
  store/               # sesión y resumen de ahorros (Context sobre el backend)
  theme.ts             # paletas clara/oscura, tipografía (Plus Jakarta Sans) y espaciado
  utils/               # formato de moneda/fechas, navegación
```

## Funciones

- **Varios nidos** por usuario (cambiar, renombrar, desvincular, ver archivados).
- **Aportes automáticos** semanales, quincenales o mensuales: al vencer aparecen en inicio para confirmar u omitir con un toque.
- **Notificaciones locales**: recordatorio de aportes automáticos, aviso de racha en riesgo (domingo 18:00) y resumen mensual (día 1).
- **Reparto acordado** por nido (50/50, 60/40…) con indicador de quién va adelante.
- **Bloqueo con Face ID / huella / código** y opción de ocultar saldos al abrir.
- **Invitar por enlace o QR** (`nido://invite?code=NIDO-XXXXX`) y escáner de QR.
- **Reacciones y comentarios** en cada movimiento.
- **Rachas, 12 logros y mascota (Nidito)** que evoluciona con XP: huevo → pollito → polluelo → pájaro → leyenda. Toda la gamificación se calcula del historial en `src/game/progress.ts`.
- **Exportar** movimientos a CSV o PDF.

> En Expo Go, Face ID usa el código del dispositivo; con un development build usa Face ID real.

## Supabase

1. Ejecuta en orden en el SQL Editor de Supabase: `supabase/schema.sql`, `supabase/migrations/002_identity.sql` y `supabase/migrations/003_groups_approvals.sql`.
2. Copia `.env.example` a `.env.local` con la URL y la anon key del proyecto.
3. En Authentication → URL Configuration agrega `nido://**` a las Redirect URLs.
4. En Authentication → Email Templates → **Reset Password**, incluye el código `{{ .Token }}` en el correo (la app pide ese código de 6 dígitos para cambiar la contraseña).

Sin `.env.local` la app usa el backend local (datos solo en el dispositivo; el código para restablecer la contraseña se muestra en pantalla).

## Nidos, familias y aprobaciones

- Un nido es una **pareja** (2 personas) o un **grupo familiar** con nombre (2 o más; cualquiera agrega integrantes con su código o QR).
- Los retiros, disolver el nido y salir de una familia son **solicitudes**: se ejecutan cuando todos los demás integrantes aprueban. Cualquiera puede rechazar y quien la creó puede cancelarla.
- Al disolver (o salir), el saldo se reintegra a cada persona en proporción a lo que aportó, como movimientos de "reintegro".
- En Supabase estas reglas se cumplen en la base de datos (funciones `create_request`, `approve_request`…); la app no puede insertar retiros directamente.

## Idiomas y temas

- Textos en `src/i18n/es.ts` y `src/i18n/en.ts`. Para agregar un idioma, crea otro archivo con las mismas claves y regístralo en `src/providers/Preferences.tsx`.
- Los colores salen de tokens semánticos (`theme.colors.surface`, `text`, `accent`…). Los estilos se crean con `makeStyles((theme) => ({ … }))`, así cada pantalla funciona en claro y oscuro.

## Backends

`src/services/backend.ts` elige Supabase cuando `.env.local` tiene la URL y la anon key, y si no usa el backend local (`localBackend.ts`). Ambos implementan el mismo contrato (`src/services/types.ts`), así que las pantallas no cambian.

```bash
npm run typecheck
npx expo lint
```
