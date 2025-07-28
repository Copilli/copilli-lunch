
# Presentación de la Aplicación: Copilli Lunch

## Información General

**Nombre:** Copilli Lunch  
**Descripción:** Aplicación web para la gestión del consumo alimenticio en entornos escolares. Está diseñada para facilitar el control de desayunos mediante un sistema de tokens, periodos especiales y seguimiento por roles específicos: administración, oficina y cocina.

**Enlace de acceso:**  
🔗 [https://copilli.github.io/copilli-lunch](https://copilli.github.io/copilli-lunch)

**Usuarios de demostración:**

| Rol          | Usuario   | Contraseña        |
|--------------|-----------|---------------------|
| Administrador | `admin`   | `****`     |
| Oficina       | `oficina` | `****`   |
| Cocina        | `cocina`  | `****`    |

---

## Estructura y Funcionalidad por Panel

### 🛠 Panel de Administrador (`admin`)
- Visualiza la lista de estudiantes y sus calendarios de consumo.
- Modifica información de estudiantes: nombre, foto, grupo, estatus.
- Agrega tokens, periodos especiales y movimientos manuales de uso.
- Puede importar estudiantes desde un archivo CSV.
- Accede al historial detallado por alumno.
- Permite ver marcadores en calendario:
  - **Verde:** periodo activo
  - **Azul:** uso de token
  - **Rojo:** token usado en saldo negativo

### 🧾 Panel de Oficina (`oficina`)
- Visualiza lista de estudiantes y su historial.
- Consulta detalles por estudiante (tokens, periodos, historial).
- Agrega tokens o nuevos periodos especiales.
- **No permite modificar** datos personales del estudiante.
- Muestra el calendario y resumen visual del estatus del estudiante.

### 🍽 Panel de Cocina (`cocina`)
- Visualiza estudiantes organizados por grupo y nivel.
- Solo muestra nombre, foto y estatus visual:
  - **Verde:** desayuno cubierto por periodo
  - **Azul:** puede usar token
  - **Rojo:** sin periodo ni tokens (pasaría a negativo)
- Confirma con alerta si el alumno está por entrar en negativo.
- **Usuarios bloqueados** no pueden consumir si no tienen tokens.
- **Usuarios no bloqueados** pueden consumir en negativo si es necesario.

---

## Bugs Conocidos

1. **Redirección en la página de inicio:**  
   Carga componentes innecesariamente. Se requiere mejorar control de navegación.

2. **Fechas no válidas no representadas en el calendario:**  
   Se necesita implementar calendario de días inválidos (fines de semana, días puente), pintados en gris o negro, con íconos opcionales.

3. **Validación incorrecta de duración mínima de periodos:**  
   Los días inválidos están siendo contados para validar el mínimo de 5 días, lo cual es incorrecto.

4. **Periodos con inicio o fin en días inválidos:**  
   Actualmente se pueden crear periodos en fechas no válidas. Esto debe impedirse.

5. **Tokens pueden usarse en días no válidos:**  
   El sistema no bloquea el uso de tokens durante días no válidos, lo cual debe corregirse.

---

## Mejoras Planeadas

1. **Módulo de pagos:**  
   Implementar una tabla de pagos que se relacione con:
   - Fecha  
   - Monto pagado  
   - TokenMovement asociado  
   - Ticket o justificante  

2. **Flujo automatizado de pagos con notificación por correo:**  
   Al registrar un pago:
   - Se solicita el ticket
   - Se calcula el total basado en días válidos
   - Se envía un correo de confirmación al responsable

3. **Cálculo de costos solo con días válidos:**  
   Al generar periodos o semanas, solo deben contarse días hábiles. Días puente o festivos se omiten del cálculo y validación.

4. **Visualización de pagos por día o periodo:**  
   Panel para consultar todos los pagos realizados en:
   - El día actual  
   - Rango personalizado de fechas

5. **Funcionalidad de corte de caja:**  
   - Botón de "Corte" visible si existen pagos no consolidados  
   - Muestra total acumulado desde el último corte  
   - Botón se deshabilita si no hay nuevos pagos  
   - Registro histórico de todos los cortes
