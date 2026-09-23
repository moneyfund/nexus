# Firebase · NEXUS OS

NEXUS usa el proyecto Firebase `nexus-96795` para autenticación, Firestore, Storage y Analytics.

## Servicios que deben estar habilitados

1. **Authentication → Sign-in method → Google**.
2. **Cloud Firestore** en modo producción.
3. **Storage**.
4. En **Authentication → Settings → Authorized domains**, conserva `localhost`, `nexus-96795.firebaseapp.com` y añade el dominio público de NEXUS en Vercel.

## Reglas

El repositorio incluye `firestore.rules` y `storage.rules`. Ambas reglas aíslan los datos por `request.auth.uid`.

Despliegue con Firebase CLI:

```bash
firebase use nexus-96795
firebase deploy --only firestore:rules,storage
```

## Migración

NEXUS sigue siendo local-first. La primera vez que una cuenta Google inicia sesión:

- si ya existe un espacio en Firestore, se descarga y pasa a ser el espacio activo;
- si no existe, NEXUS toma el espacio local actual, reasigna sus registros al UID autenticado y lo sube;
- a partir de ahí, los cambios se guardan primero en el navegador y se sincronizan a Firestore con debounce;
- los archivos nuevos se suben a Firebase Storage y sus metadatos permanecen dentro del espacio NEXUS.

Firestore se divide en ocho documentos de dominio bajo `users/{uid}/nexus/*` para evitar concentrar todo el espacio en un único documento.

## Configuración web

La configuración cliente de Firebase vive en `src/lib/firebase.ts`. Es configuración pública de una Web App; la seguridad real depende de Authentication y de las reglas de Firestore/Storage. No coloques secretos de servidor ni claves privadas en ese archivo.
