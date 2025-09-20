# Copilli School App - Frontend

Aplicación web (React + Vite) para la gestión escolar, incluyendo módulos como desayunos, pagos, usuarios y más.

---

## 📁 Estructura del Proyecto

```
lunch-app-frontend/
├── src/            # Código fuente React
├── public/         # Archivos estáticos
├── package.json    # Dependencias y scripts
├── vite.config.js  # Configuración de Vite
└── ...
```

---

## � Requisitos

- Node.js (v16+ recomendado)

---

## � Variables de entorno

Crea un archivo `.env` en la raíz del frontend:

```env
VITE_API_URL=http://localhost:3000/api
```

> Cambia la URL si el backend está desplegado en otra parte.

---

## ▶️ Comandos principales

```bash
cd lunch-app-frontend
npm install
npm run dev     # Desarrollo local
npm run build   # Genera /dist para producción
npm run deploy  # Publica en GitHub Pages (rama gh-pages)
```

---

## 🚀 Despliegue en GitHub Pages

1. Asegúrate de tener configurado el campo `base` en `vite.config.js`:

```js
base: '/copilli-lunch/'
```

2. Ejecuta:

```bash
npm run build
npm run deploy
```

3. La aplicación estará disponible en:

```
https://copilli.github.io/copilli-lunch/
```

4. Configura GitHub Pages:
   - Ve a **Settings > Pages** en el repositorio.
   - Selecciona **Branch:** `gh-pages` y **Folder:** `/ (root)`.

---

## 🧪 Recomendación

Prueba primero localmente (`npm run dev`) antes de desplegar.

---

## ✍️ Autor

- Luis David Gallegos Godoy