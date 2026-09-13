# ActivaMente — app móvil

Expo 54 / React Native 0.81 / expo-router. Requiere **development build** (plugin nativo de
cámara con MediaPipe en `android/`); no corre en Expo Go. Solo Android por ahora.

```bash
npm install
cp .env.example .env          # EXPO_PUBLIC_API_URL = http://<IP-de-tu-PC>:8420
npm run android               # compila e instala el dev build (Metro en :8421)
npm start                     # Metro en :8421 (-- -c para limpiar caché tras cambiar .env)
npm run typecheck && npm run lint
```
