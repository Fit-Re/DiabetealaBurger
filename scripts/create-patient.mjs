// Da de alta una cuenta de paciente en Supabase (sin pantalla de auto-registro en la app).
//
// Uso:
//   SUPABASE_SERVICE_ROLE_KEY=xxxx node scripts/create-patient.mjs paciente@email.com "contraseña temporal"
//
// La service_role key NUNCA debe ir en la app ni en un commit — se usa solo acá, en tu máquina,
// pasada por variable de entorno en el momento. La sacás de Supabase Dashboard →
// Project Settings → API → Project API keys → service_role (secret).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// `node` no carga .env automáticamente (solo `expo start` lo hace), así que lo leemos a mano.
function loadDotEnv() {
  const envPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    ".env"
  );
  let contents;
  try {
    contents = readFileSync(envPath, "utf8");
  } catch {
    return;
  }
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnv();

const [, , email, password] = process.argv;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

if (!email || !password) {
  console.error('Uso: node scripts/create-patient.mjs <email> "<contraseña>"');
  process.exit(1);
}
if (!serviceRoleKey) {
  console.error("Falta SUPABASE_SERVICE_ROLE_KEY en el entorno (no la guardes en archivos).");
  process.exit(1);
}
if (!supabaseUrl) {
  console.error("Falta EXPO_PUBLIC_SUPABASE_URL (ya debería estar en tu .env).");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey);

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (error) {
  console.error("Error al crear paciente:", error.message);
  process.exit(1);
}

console.log(`Paciente creado: ${data.user.email} (id: ${data.user.id})`);
console.log("Ya puede iniciar sesión en la app con ese email y contraseña.");
