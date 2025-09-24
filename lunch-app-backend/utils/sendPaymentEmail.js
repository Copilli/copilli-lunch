// utils/sendPaymentEmail.js
const nodemailer = require('nodemailer');
const Movement = require('../models/Movement');
const Lunch = require('../models/Lunch');
const Person = require('../models/Person');

const DEFAULT_CURRENCY = 'MXN';
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

function fmtMoney(n, currency = DEFAULT_CURRENCY) {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(n ?? 0);
  } catch {
    return `$${n} ${currency}`;
  }
}

function getPricesForPerson(person) {
  const level = (person.group?.level || '').toLowerCase();
  const groupName = (person.group?.name || '').toUpperCase();

  if (level === 'preescolar') {
    return { priceToken: 44, pricePeriod: 40 };
  }
  if (level === 'secundaria') {
    return { priceToken: 62, pricePeriod: 52 };
  }
  if (level === 'primaria') {
    if (/^[1-3]/.test(groupName)) {
      return { priceToken: 50, pricePeriod: 44 };
    }
    if (/^[4-6]/.test(groupName)) {
      return { priceToken: 57, pricePeriod: 47 };
    }
    // Grupo no válido: usar el precio más alto de primaria
    return { priceToken: 57, pricePeriod: 47 };
  }
  // Grupo no válido: usar el precio más alto de secundaria
  return { priceToken: 62, pricePeriod: 52 };
}

/**
 * Intenta inferir el concepto y la cantidad a partir del TokenMovement
 * - Tokens: change > 0  -> cantidad = change (tokens)
 * - Periodo: change == 0 -> cantidad ≈ amount / PRICE_PER_DAY (días)
 * También intenta extraer rango "YYYY-MM-DD → YYYY-MM-DD" de movement.note
 */
async function getConceptAndQty(payment) {
  try {
    const mov = await Movement.findById(payment.movementId).lean();
    if (!mov) return { concept: 'Pago', qty: null, units: '', rangeLabel: '' };

    // Buscar Person por entityId (Movement.entityId)
    let person = null;
    if (mov.entityId) {
      person = await Person.findOne({ entityId: mov.entityId }).lean();
    }
    if (!person) return { concept: 'Pago', qty: null, units: '', rangeLabel: '' };

    // Buscar Lunch por person._id
    let lunch = await Lunch.findOne({ person: person._id }).lean();
    if (!lunch) return { concept: 'Pago', qty: null, units: '', rangeLabel: '' };

    const prices = getPricesForPerson(person);

    // ¿Periodo? (nuestro flujo guarda change=0 para periodo)
    if (!mov.change || mov.change === 0) {
      const qty = Math.round((payment.amount || 0) / prices.pricePeriod) || 0;
      let rangeLabel = '';
      const m = mov.note && mov.note.match(/(\d{4}-\d{2}-\d{2}).*?(\d{4}-\d{2}-\d{2})/);
      if (m) rangeLabel = ` (${m[1]} → ${m[2]})`;
      return { concept: 'Periodo', qty, units: `día${qty === 1 ? '' : 's'}`, rangeLabel };
    }
    // Si no, lo tratamos como compra de tokens
    const qty = Number(mov.change) || Math.round((payment.amount || 0) / prices.priceToken) || 0;
    return { concept: 'Tokens', qty, units: `token${qty === 1 ? '' : 's'}`, rangeLabel: '' };
  } catch {
    return { concept: 'Pago', qty: null, units: '', rangeLabel: '' };
  }
}

/**
 * Envía el ticket por correo al alumno y marca payment.sentEmail = true si se envió.
 * @param {Object} student - Doc de Student (debe tener .email y .name)
 * @param {Object} payment - Doc de Payment (Mongoose) ya guardado
 * @param {string} currency - Ej: 'MXN' (opcional)
 * @returns {Promise<boolean>} true si se envió; false si no había email
 */

async function sendPaymentEmail(personObj, payment, currency = DEFAULT_CURRENCY) {
  // Buscar Person por entityId (payment.entityId)
  let person = null;
  if (personObj && personObj.email) {
    person = personObj;
  } else if (payment && payment.entityId) {
    person = await Person.findOne({ entityId: payment.entityId }).lean();
  }
  if (!person?.email) {
    console.log(`[ℹ️ Email] ${person?.name || 'Alumno'} sin correo; no se envía.`);
    return false;
  }

  // Enriquecer: concepto (Tokens/Periodo), cantidad y rango si aplica
  const { concept, qty, units, rangeLabel } = await getConceptAndQty(payment);

  const amountFmt = fmtMoney(payment.amount, currency);
  const dateStr = new Date(payment.date).toLocaleString('es-MX', {
    timeZone: MX_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit'
  });

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
        <img src="https://copilli.edu.mx/wp-content/uploads/2017/06/Favicon.jpeg" alt="Copilli" width="28" height="28" style="border-radius:6px" />
        <h2 style="color:#2c3e50; margin:0;">Ticket de Pago - Copilli Lunch</h2>
      </div>

      <p>Hola <strong>${person.name}</strong>,</p>
      <p>Se ha registrado tu pago correctamente. Aquí están los detalles:</p>

      <table style="width:100%; border-collapse:collapse; margin-top:10px;">
        <tr>
          <td style="border:1px solid #ddd; padding:8px; background:#fafafa;">Ticket</td>
          <td style="border:1px solid #ddd; padding:8px;">${payment.ticketNumber}</td>
        </tr>
        <tr>
          <td style="border:1px solid #ddd; padding:8px; background:#fafafa;">Fecha</td>
          <td style="border:1px solid #ddd; padding:8px;">${dateStr}</td>
        </tr>
        <tr>
          <td style="border:1px solid #ddd; padding:8px; background:#fafafa;">Alumno</td>
          <td style="border:1px solid #ddd; padding:8px;">${person.name}</td>
        </tr>
        <tr>
          <td style="border:1px solid #ddd; padding:8px; background:#fafafa;">Concepto</td>
          <td style="border:1px solid #ddd; padding:8px;">${concept}${rangeLabel}</td>
        </tr>
        <tr>
          <td style="border:1px solid #ddd; padding:8px; background:#fafafa;">Cantidad</td>
          <td style="border:1px solid #ddd; padding:8px;">${qty ?? '-'} ${units}</td>
        </tr>
        <tr>
          <td style="border:1px solid #ddd; padding:8px; background:#fafafa;">Monto</td>
          <td style="border:1px solid #ddd; padding:8px;">${amountFmt}</td>
        </tr>
      </table>

      <p style="margin-top:16px;">Gracias por tu pago.</p>
      <p style="font-size:12px; color:#888;">Este correo fue enviado automáticamente por el sistema Copilli Lunch.</p>
    </div>
  `;

  const mailOptions = {
    from: `"Copilli Lunch" <${process.env.MAIL_USER}>`,
    to: person.email,
    subject: `Confirmación de pago - Ticket ${payment.ticketNumber}`,
    html
  };

  try {
    await getTransporter().sendMail(mailOptions);
    payment.sentEmail = true;
    await payment.save();
    console.log(`[✅ Email] Ticket ${payment.ticketNumber} enviado a ${person.email}`);
    return true;
  } catch (err) {
    console.error('[❌ Email ERROR]', err);
    return false;
  }
}

module.exports = { sendPaymentEmail };