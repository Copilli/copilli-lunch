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

async function sendUseEmail(personOrEntityId, useInfo) {
  let person = null;
  if (personOrEntityId && personOrEntityId.email) {
    person = personOrEntityId;
  } else if (typeof personOrEntityId === 'string') {
    person = await Person.findOne({ entityId: personOrEntityId }).lean();
  }
  if (!person?.email) {
    console.log(`[ℹ️ Email] ${person?.name || 'Alumno'} sin correo; no se envía.`);
    return false;
  }

  const dateStr = fmtDate(useInfo.date);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
        <img src="https://copilli.edu.mx/wp-content/uploads/2017/06/Favicon.jpeg" alt="Copilli" width="28" height="28" style="border-radius:6px" />
        <h2 style="color:#2c3e50; margin:0;">Ticket de Consumo - Copilli Lunch</h2>
      </div>

  <p>Hola <strong>${person.name}</strong>,</p>
      <p>Se ha registrado un consumo en el sistema. Aquí están los detalles:</p>

      <table style="width:100%; border-collapse:collapse; margin-top:10px;">
        <tr>
          <td style="border:1px solid #ddd; padding:8px; background:#fafafa;">Fecha</td>
          <td style="border:1px solid #ddd; padding:8px;">${dateStr}</td>
        </tr>
        <tr>
          <td style="border:1px solid #ddd; padding:8px; background:#fafafa;">Alumno</td>
          <td style="border:1px solid #ddd; padding:8px;">${person.name}</td>
        </tr>
        <tr>
          <td style="border:1px solid #ddd; padding:8px; background:#fafafa;">Tipo de uso</td>
          <td style="border:1px solid #ddd; padding:8px;">${useInfo.type}</td>
        </tr>
        <tr>
          <td style="border:1px solid #ddd; padding:8px; background:#fafafa;">Tokens restantes</td>
          <td style="border:1px solid #ddd; padding:8px;">${useInfo.tokens}</td>
        </tr>
        <tr>
          <td style="border:1px solid #ddd; padding:8px; background:#fafafa;">Nota</td>
          <td style="border:1px solid #ddd; padding:8px;">${useInfo.note || '-'} </td>
        </tr>
      </table>

      <p style="margin-top:16px;">Gracias por usar Copilli Lunch.</p>
      <p style="font-size:12px; color:#888;">Este correo fue enviado automáticamente por el sistema Copilli Lunch.</p>
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
