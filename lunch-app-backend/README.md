
# 🍽️ Backend - Copilli BE

Servidor Express + MongoDB para la gestión de desayunos escolares.

---

## 📁 Estructura del Proyecto

```
lunch-app-backend/
├── index.js         # Punto de entrada principal
├── package.json     # Dependencias y scripts
├── models/          # Modelos de datos (Mongoose)
├── routes/          # Rutas de la API
├── middleware/      # Middlewares personalizados
├── scripts/         # Scripts utilitarios
└── utils/           # Utilidades
```

---

## 🔧 Requisitos

- Node.js
- MongoDB Atlas o local
- Archivo `.env` con las siguientes variables:

```env
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/copilli-lunch
JWT_SECRET=clave_super_segura_123
PORT=3000
```

---

## ▶️ Comandos básicos

```bash
cd lunch-app-backend
npm install
npm run dev
```

> El servidor correrá por defecto en: `http://localhost:3000`

---

## � Crear usuarios manualmente

```bash
node scripts/createUser.js
```

> Este script te pedirá en consola el nombre, contraseña y rol del nuevo usuario (`admin`, `oficina`, `cocina`).

---

## 📅 Generar fechas inválidas

```bash
node scripts/generateInvalidDates.js
```

> Este script permite registrar en la base de datos las fechas en las que **no habrá desayuno** (por ejemplo, días festivos o vacaciones). Se te pedirá ingresar las fechas manualmente en consola.

---

## 🚀 Despliegue en Render.com

1. Sube tu código a GitHub.
2. En [https://render.com](https://render.com), crea un **New Web Service**:
  - **Root Directory:** `lunch-app-backend/`
  - **Build Command:** `npm install`
  - **Start Command:** `npm start` o `node index.js`
  - **Environment:** Node
  - **Variables de entorno:**

```env
MONGODB_URI=<tu cadena de conexión de MongoDB Atlas>
JWT_SECRET=algosecreto123
PORT=10000
```

3. Render instalará dependencias y levantará tu servidor. Verás logs en tiempo real.
4. Tu API estará disponible en una URL como:

```
https://copilli-lunch-backend.onrender.com
```

---

## 🌐 Conectar con el frontend

En el proyecto frontend, cambia tu archivo `.env`:

```env
VITE_API_URL=https://copilli-lunch-backend.onrender.com
```

---

## 🧪 Recomendación

Prueba primero localmente (`npm run dev` en backend y frontend) antes de subir.