# ActivaMente

App móvil de rehabilitación física guiada por cámara para adultos mayores. El paciente hace
ejercicios frente a la cámara frontal; MediaPipe detecta la pose y la app cuenta repeticiones
y corrige la postura. Los especialistas asignan rutinas y agendan citas; los administradores
gestionan usuarios.

| Directorio | Qué es |
| --- | --- |
| `activamente-back/` | API FastAPI + PostgreSQL 16 (Docker) |
| `activamente-front/` | App Expo 54 / React Native (Android, dev build) |

## Arranque

```bash
cp .env.example .env                      # completar SECRET_KEY
docker compose up --build                 # API en :8420, Postgres en :55432 (host)
cd activamente-front
cp .env.example .env                      # EXPO_PUBLIC_API_URL = IP de tu PC
npm install && npm run android && npm start   # Metro en :8421
```
