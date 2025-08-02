const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const readline = require('readline');
require('dotenv').config();
const User = require('../models/User');

async function promptUserData() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (question) =>
    new Promise((resolve) => rl.question(question, resolve));

  const username = await ask('Usuario: ');
  const password = await ask('Contraseña: ');
  const role = await ask('Rol (admin, oficina, cocina): ');
  rl.close();

  return { username, password, role };
}

async function createUser() {
  const { username, password, role } = await promptUserData();

  if (!['admin', 'oficina', 'cocina'].includes(role)) {
    console.error('Rol inválido. Usa: admin, oficina o cocina.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const passwordHash = await bcrypt.hash(password, 10);

  const user = new User({ username, passwordHash, role });
  await user.save();

  console.log(`✅ Usuario "${username}" con rol "${role}" creado correctamente.`);
  mongoose.disconnect();
}

createUser();
