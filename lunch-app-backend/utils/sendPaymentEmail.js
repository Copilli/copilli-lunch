// utils/sendPaymentEmail.js
const nodemailer = require('nodemailer');

let _transporter = null;
function getTransporter() {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
  });
  return _transporter;
}

/**
 * Envía el ticket por correo al alumno y marca payment.sentEmail = true si se envió.
 * @param {Object} student - Doc de Student (debe tener .email y .name)
 * @param {Object} payment - Doc de Payment (Mongoose) ya guardado
 * @param {string} currency - Ej: 'MXN' (opcional)
 * @returns {Promise<boolean>} true si se envió; false si no había email
 */
async function sendPaymentEmail(student, payment, currency = 'MXN') {
  if (!student?.email) {
    console.log(`[ℹ️ Email] ${student?.name || 'Alumno'} sin correo; no se envía.`);
    return false;
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="color: #2c3e50;">🎟️ Ticket de Pago - Copilli Lunch</h2>
      <p>Hola <strong>${student.name}</strong>,</p>
      <p>Se ha registrado tu pago correctamente. Aquí están los detalles:</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Ticket</td><td style="border: 1px solid #ddd; padding: 8px;">${payment.ticketNumber}</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Fecha</td><td style="border: 1px solid #ddd; padding: 8px;">${new Date(payment.date).toLocaleDateString()}</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Alumno</td><td style="border: 1px solid #ddd; padding: 8px;">${student.name}</td></tr>
        <tr><td style="border: 1px solid #ddd; padding: 8px;">Monto</td><td style="border: 1px solid #ddd; padding: 8px;">$${payment.amount} ${currency}</td></tr>
      </table>
      <p style="margin-top: 20px;">Gracias por tu pago.</p>
      <p style="font-size: 12px; color: #888;">Este correo fue enviado automáticamente por el sistema Copilli Lunch.</p>
    </div>
  `;

  const mailOptions = {
    from: `"Copilli Lunch" <${process.env.MAIL_USER}>`,
    to: student.email,
    subject: `Confirmación de pago - Ticket ${payment.ticketNumber}`,
    html
  };

  try {
    await getTransporter().sendMail(mailOptions);
    payment.sentEmail = true;
    await payment.save();
    console.log(`[✅ Email] Ticket ${payment.ticketNumber} enviado a ${student.email}`);
    return true;
  } catch (err) {
    console.error('[❌ Email ERROR]', err);
    return false;
  }
}

module.exports = { sendPaymentEmail };
