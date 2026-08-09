const fs = require('fs');
const path = require('path');

// Intentar leer las variables de diferentes fuentes
let supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
let supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Si no están en las variables de entorno, intentar leer del .env.production
if (!supabaseUrl || !supabaseAnonKey) {
  const envPath = path.join(__dirname, '../.env.production');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const urlMatch = envContent.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/);
    const keyMatch = envContent.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/);

    if (urlMatch) supabaseUrl = urlMatch[1].trim();
    if (keyMatch) supabaseAnonKey = keyMatch[1].trim();
  }
}

console.log('Injecting environment variables...');
console.log('URL:', supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'missing');
console.log('Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'missing');

const indexHtmlPath = path.join(__dirname, '../dist/index.html');

if (!fs.existsSync(indexHtmlPath)) {
  console.error('index.html not found at', indexHtmlPath);
  process.exit(1);
}

let html = fs.readFileSync(indexHtmlPath, 'utf-8');

// Inyectar las variables como globales antes del script
const envScript = `<script>
  window.__EXPO_PUBLIC_SUPABASE_URL__ = '${supabaseUrl || ''}';
  window.__EXPO_PUBLIC_SUPABASE_ANON_KEY__ = '${supabaseAnonKey || ''}';
</script>`;

// Insertar después del cierre de </head> o antes del primer script
if (html.includes('</head>')) {
  html = html.replace('</head>', envScript + '\n</head>');
} else {
  // Fallback: insertar antes del script principal
  html = html.replace(
    /<script[^>]*src="\/_expo\/static\/js\/web\//,
    envScript + '\n  <script src="/_expo/static/js/web/'
  );
}

fs.writeFileSync(indexHtmlPath, html);
console.log('Environment variables injected successfully');
