# 🚀 Despliegue del Backend en Render.com

Guía para desplegar el backend (Express + MongoDB) del sistema de desayunos escolares en [Render.com](https://render.com).

---

## ✅ 1. Preparar el código

### Requisitos mínimos en tu backend:

- `package.json` con el script de inicio:

```json
"scripts": {
  "start": "node server.js"
}
```

- Asegúrate de tener un archivo como `server.js` o `index.js` como punto de entrada.
- Agrega un archivo `.env.example` si gustas documentar las variables necesarias.

---

## 🌐 2. Subir a GitHub

Tu repositorio debe estar subido a GitHub. Si el backend está dentro de una carpeta (`/backend`), toma nota.

---

## 🛠️ 3. Crear servicio en Render

1. Inicia sesión en [https://render.com](https://render.com).
2. Haz clic en **New Web Service**.
3. Elige **"Deploy from GitHub"** y conecta tu cuenta si es necesario.
4. Selecciona el repositorio correspondiente.
5. Completa los datos:

| Campo             | Valor                               |
|-------------------|-------------------------------------|
| Name              | desayuno-backend                    |
| Root Directory    | `backend/` (si tu código está ahí)  |
| Build Command     | `npm install`                       |
| Start Command     | `npm start`                         |
| Environment       | Node                                |

6. Haz clic en "Advanced → Add Environment Variables" y agrega:

```
MONGODB_URI=<tu cadena de conexión de MongoDB Atlas>
JWT_SECRET=algosecreto123
PORT=10000
```

7. Presiona **"Create Web Service"**.

---

## ⏳ 4. Esperar y obtener URL

Render instalará dependencias y levantará tu servidor. Verás logs en tiempo real.

Tu API estará disponible en una URL como:

```
https://desayuno-backend.onrender.com/api
```

---

## 🌐 5. Conectar con el frontend

En el proyecto frontend, cambia tu archivo `.env`:

```env
VITE_API_URL=https://desayuno-backend.onrender.com/api
```

Y luego:

```bash
cd frontend
npm run build
npm run deploy
```

¡Listo! Tu sistema está completamente desplegado 🎉

---

## 🧪 Recomendación

Prueba primero localmente (`npm run dev` en backend y frontend) antes de subir.