# Flujos E2E (Maestro)

Se corren a mano en un dispositivo/emulador con el dev build instalado y el
backend arriba (TS-16). Instalar Maestro: https://maestro.mobile.dev

```bash
cd activamente-front
maestro test .maestro/patient-session.yaml
maestro test .maestro/specialist-routine.yaml
```

Los flujos usan las credenciales del seed (`activamente-back/database/seed.sql`).
La pantalla de cámara no se automatiza: el flujo del paciente llega hasta la
instrucción y usa "Saltar ejercicio" para completar la sesión.
