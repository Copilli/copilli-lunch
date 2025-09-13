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

### 📅 Generar fechas inválidas

```bash
node scripts/generateInvalidDates.js
```

> Este script permite registrar en la base de datos las fechas en las que **no habrá desayuno** (por ejemplo, días festivos o vacaciones).  
> Se te pedirá ingresar las fechas manualmente en consola.

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
> `https://copilli.github.io/copilli-lunch/`

---

### ⚙️ Configuración de GitHub Pages

1. En el repositorio, ve a **Settings > Pages**.
2. Selecciona:
   - **Branch:** `gh-pages`
   - **Folder:** `/ (root)`
3. Asegúrate de tener configurado `base` en `vite.config.js`:

```js
base: '/copilli-lunch/'
```

---

## ✍️ Autor

- Luis David Gallegos Godoy