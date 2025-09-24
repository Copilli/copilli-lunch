const nodemailer = require('nodemailer');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);
const Person = require('../models/Person');
const MX_TZ = 'America/Mexico_City';
let _transporter = null;


function getTransporter() {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
  });
  return _transporter;
}

function fmtDate(date) {
  return dayjs(date).tz(MX_TZ).format('YYYY-MM-DD HH:mm');
}

async function sendUseEmail(personOrEntityId, movement, lunch) {
  // Usar el objeto person recibido directamente
  const person = personOrEntityId;
  if (!person?.email) {
    console.log(`[ℹ️ Email] ${person?.name || 'Alumno'} sin correo; no se envía.`);
    return false;
  }

  // Extraer info del movimiento recibido
  const dateStr = fmtDate(movement.timestamp);
  // Determinar tipo de uso
  let type = movement.reason || 'uso';
  if (type === 'uso-con-deuda') type = 'Consumo con deuda';
  else if (type === 'uso-periodo') type = 'Consumo con periodo';
  else if (type === 'uso') type = 'Consumo';

  let extraLabel = '';
  if (type === 'Consumo con periodo' && lunch?.specialPeriod?.endDate) {
    const endDateStr = dayjs(lunch.specialPeriod.endDate).tz(MX_TZ).format('YYYY-MM-DD');
    extraLabel = `<tr>
      <td style="border:1px solid #ddd; padding:8px; background:#fafafa; color:#222;">Fin de periodo</td>
      <td style="border:1px solid #ddd; padding:8px; color:#222;">${endDateStr}</td>
    </tr>`;
  } else {
    extraLabel = `<tr>
      <td style="border:1px solid #ddd; padding:8px; background:#fafafa; color:#222;">Tokens restantes</td>
      <td style="border:1px solid #ddd; padding:8px; color:#222;">${lunch?.tokens ?? '-'} </td>
    </tr>`;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; color:#222;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
        <img src="https://copilli.edu.mx/wp-content/uploads/2017/06/Favicon.jpeg" alt="Copilli" width="28" height="28" style="border-radius:6px" />
        <h2 style="color:#222; margin:0;">Ticket de Consumo - Copilli Lunch</h2>
      </div>

      <p style="color:#222;">Hola <strong>${person.name}</strong>,</p>
      <p style="color:#222;">Se ha registrado un consumo en el sistema. Aquí están los detalles:</p>

      <table style="width:100%; border-collapse:collapse; margin-top:10px; color:#222;">
        <tr>
          <td style="border:1px solid #ddd; padding:8px; background:#fafafa; color:#222;">Fecha</td>
          <td style="border:1px solid #ddd; padding:8px; color:#222;">${dateStr}</td>
        </tr>
        <tr>
          <td style="border:1px solid #ddd; padding:8px; background:#fafafa; color:#222;">Alumno</td>
          <td style="border:1px solid #ddd; padding:8px; color:#222;">${person.name}</td>
        </tr>
        <tr>
          <td style="border:1px solid #ddd; padding:8px; background:#fafafa; color:#222;">Tipo de uso</td>
          <td style="border:1px solid #ddd; padding:8px; color:#222;">${type}</td>
        </tr>
        ${extraLabel}
        <tr>
          <td style="border:1px solid #ddd; padding:8px; background:#fafafa; color:#222;">Nota</td>
          <td style="border:1px solid #ddd; padding:8px; color:#222;">${movement.note || '-'} </td>
        </tr>
      </table>

      <p style="margin-top:16px; color:#222;">Gracias por usar Copilli Lunch.</p>
      <p style="font-size:12px; color:#222;">Este correo fue enviado automáticamente por el sistema Copilli Lunch.</p>
    </div>
  `;

  const mailOptions = {
    from: `"Copilli Lunch" <${process.env.MAIL_USER}>`,
    to: person.email,
    subject: `Confirmación de consumo - ${dateStr}`,
    html
  };

  try {
    await getTransporter().sendMail(mailOptions);
    console.log(`[✅ Email] Consumo registrado enviado a ${person.email}`);
    return true;
  } catch (err) {
    console.error('[❌ Email ERROR]', err);
    return false;
  }
}

module.exports = { sendUseEmail };