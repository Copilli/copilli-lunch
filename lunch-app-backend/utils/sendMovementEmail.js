// utils/sendMovementEmail.js
const nodemailer = require('nodemailer');
const Person = require('../models/Person');
const Payment = require('../models/Payment');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);
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

function fmtMoney(n, currency = 'MXN') {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(n ?? 0);
  } catch {
    return `$${n} ${currency}`;
  }
}

function fmtDate(date) {
  return new Date(date).toLocaleString('es-MX', {
    timeZone: MX_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}

function getMovementType(movement) {
  switch (movement.reason) {
    case 'pago':
      return 'Pago';
    case 'uso':
    case 'uso-con-deuda':
    case 'uso-periodo':
      return 'Consumo';
    case 'justificado':
      return 'Justificado';
    case 'ajuste manual':
      return 'Ajuste manual';
    case 'periodo-activado':
      return 'Periodo activado';
    case 'periodo-expirado':
      return 'Periodo expirado';
    case 'periodo-removido':
      return 'Periodo removido';
    default:
      if (movement.reason && movement.reason.includes('periodo')) return 'Periodo';
      return 'Movimiento';
  }
}

async function sendMovementEmail(movement, extra = {}) {
  // Buscar persona
  let person = null;
  if (movement.entityId) {
    person = await Person.findOne({ entityId: movement.entityId }).lean();
  }
  if (!person?.email) {
    console.log(`[ℹ️ Email] ${person?.name || 'Alumno'} sin correo; no se envía.`);
    return false;
  }

  // Si es pago y tiene paymentId, obtener ticket y monto directamente
  let amount = '';
  let ticket = '';
  if (movement.reason === 'pago' && movement.paymentId) {
    const payment = await Payment.findById(movement.paymentId);
    if (payment) {
      amount = fmtMoney(payment.amount);
      ticket = payment.ticketNumber;
    }
  } else {
    amount = extra.amount ? fmtMoney(extra.amount) : '';
    ticket = extra.ticketNumber || '';
  }

  // Corrige la fecha para evitar desfase por zona horaria
  let dateObj = movement.timestamp || movement.dateAffected || Date.now();
  // Si es string o number, pásalo directo a dayjs (sin new Date)
  const dateStr = dayjs(dateObj).tz(MX_TZ).format('DD/MM/YYYY HH:mm');

  const type = getMovementType(movement);
  let details = '';
  if (type === 'Pago') {
    details += `<tr><td style="border:1px solid #ddd; padding:8px; background:#fafafa;">Ticket</td><td style="border:1px solid #ddd; padding:8px;">${ticket}</td></tr>`;
    details += `<tr><td style="border:1px solid #ddd; padding:8px; background:#fafafa;">Monto</td><td style="border:1px solid #ddd; padding:8px;">${amount}</td></tr>`;
  }
  details += `<tr><td style="border:1px solid #ddd; padding:8px; background:#fafafa;">Motivo</td><td style="border:1px solid #ddd; padding:8px;">${movement.reason}</td></tr>`;
  details += `<tr><td style="border:1px solid #ddd; padding:8px; background:#fafafa;">Nota</td><td style="border:1px solid #ddd; padding:8px;">${movement.note || '-'} </td></tr>`;
  details += `<tr><td style="border:1px solid #ddd; padding:8px; background:#fafafa;">Cambio</td><td style="border:1px solid #ddd; padding:8px;">${movement.change}</td></tr>`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; color: #111;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
        <img src="https://copilli.edu.mx/wp-content/uploads/2017/06/Favicon.jpeg" alt="Copilli" width="28" height="28" style="border-radius:6px" />
        <h2 style="color:#111; margin:0;">Ticket de ${type} - Copilli Lunch</h2>
      </div>

      <p style="color:#111;">Hola <strong>${person.name}</strong>,</p>
      <p style="color:#111;">Se ha registrado un ${type.toLowerCase()} en el sistema. Aquí están los detalles:</p>

      <table style="width:100%; border-collapse:collapse; margin-top:10px; color:#111;">
        ${ticket ? `<tr><td style=\"border:1px solid #ddd; padding:8px; background:#fafafa; color:#111;\">Ticket</td><td style=\"border:1px solid #ddd; padding:8px; color:#111;\">${ticket}</td></tr>` : ''}
        <tr><td style="border:1px solid #ddd; padding:8px; background:#fafafa; color:#111;">Fecha</td><td style="border:1px solid #ddd; padding:8px; color:#111;">${dateStr}</td></tr>
        <tr><td style="border:1px solid #ddd; padding:8px; background:#fafafa; color:#111;">Alumno</td><td style="border:1px solid #ddd; padding:8px; color:#111;">${person.name}</td></tr>
        ${details}
      </table>

      <p style="margin-top:16px; color:#111;">Gracias por usar Copilli Lunch.</p>
      <p style="font-size:12px; color:#888;">Este correo fue enviado automáticamente por el sistema Copilli Lunch.</p>
    </div>
  `;

  const mailOptions = {
    from: `"Copilli Lunch" <${process.env.MAIL_USER}>`,
    to: person.email,
    subject: `Confirmación de ${type}${ticket ? ' - Ticket ' + ticket : ''}`,
    html
  };

  try {
    await getTransporter().sendMail(mailOptions);
    console.log(`[✅ Email] ${type} registrado enviado a ${person.email}`);
    return true;
  } catch (err) {
    console.error('[❌ Email ERROR]', err);
    return false;
  }
}

module.exports = { sendMovementEmail };
