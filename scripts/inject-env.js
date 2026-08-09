const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('Injecting environment variables...');
console.log('URL:', supabaseUrl ? 'set' : 'missing');
console.log('Key:', supabaseAnonKey ? 'set' : 'missing');

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

// Insertar antes del script principal (maneja 'defer' y otros atributos)
html = html.replace(
  /<script[^>]*src="\/_expo\/static\/js\/web\//,
  envScript + '\n  <script src="/_expo/static/js/web/'
);

fs.writeFileSync(indexHtmlPath, html);
console.log('Environment variables injected successfully');
