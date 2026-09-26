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

## Idiomas y temas

- Textos en `src/i18n/es.ts` y `src/i18n/en.ts`. Para agregar un idioma, crea otro archivo con las mismas claves y regístralo en `src/providers/Preferences.tsx`.
- Los colores salen de tokens semánticos (`theme.colors.surface`, `text`, `accent`…). Los estilos se crean con `makeStyles((theme) => ({ … }))`, así cada pantalla funciona en claro y oscuro.

## Estado actual

Registro, inicio de sesión, vinculación por código y datos funcionan con un **backend local** (`src/services/backend.ts`) que guarda todo en el dispositivo. Por eso hoy dos cuentas solo se pueden vincular si se crean en el mismo teléfono. Para vincular teléfonos distintos hay que reemplazar ese archivo por un servidor real (p. ej. Supabase o Firebase) manteniendo las mismas funciones; las pantallas no cambian.

```bash
npm run typecheck
npx expo lint
```
