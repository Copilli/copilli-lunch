# Desayuno App 🍽️

Sistema web para la gestión de desayunos escolares, incluyendo control de tokens, periodos pagados, roles de usuario (admin, cocina, oficina), y registro de estudiantes.

---

## 📁 Estructura del Proyecto

```
desayuno-app/
├── backend/      # Servidor Express + MongoDB
├── frontend/     # Aplicación React (deploy a GitHub Pages)
```

---

## 🚀 Backend (Express + MongoDB)

### 🔧 Requisitos

- Node.js
- MongoDB Atlas o local
- Archivo `.env` con las siguientes variables:

```env
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/desayuno-app
JWT_SECRET=clave_super_segura_123
PORT=3000
```

### ▶️ Comandos

```bash
cd backend
npm install
npm run dev
```

> El servidor correrá por defecto en: `http://localhost:3000/api`

---

### 👤 Crear usuarios manualmente

```bash
node scripts/createUser.js
```

> Este script te pedirá en consola el nombre, contraseña y rol del nuevo usuario (`admin`, `oficina`, `cocina`).

---

## 🌐 Frontend (React + Vite + GitHub Pages)

### 🔧 Requisitos

- Node.js

### 📦 Variables de entorno

📁 `frontend/.env`

```env
VITE_API_URL=http://localhost:3000/api
```

> Cambia la URL si el backend está desplegado en otra parte.

---

### ▶️ Comandos

```bash
cd frontend
npm install
npm run dev     # Desarrollo
npm run build   # Genera /dist
npm run deploy  # Publica en GitHub Pages (rama gh-pages)
```

> La aplicación estará disponible en:  
> `https://<tu-usuario>.github.io/<nombre-del-repo>/`

---

### ⚙️ Configuración de GitHub Pages

1. En el repositorio, ve a **Settings > Pages**.
2. Selecciona:
   - **Branch:** `gh-pages`
   - **Folder:** `/ (root)`
3. Asegúrate de tener configurado `base` en `vite.config.js`:

```js
base: '/<nombre-del-repo>/'
```

---

## ✍️ Autor

- Luis David Gallegos Godoy