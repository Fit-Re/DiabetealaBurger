# Configuración de Supabase para Confirmación de Email

Para que la confirmación de email funcione correctamente, debes configurar las URLs de redirección en tu proyecto de Supabase.

## Pasos:

1. **Accede al Dashboard de Supabase**
   - Ve a https://app.supabase.com
   - Selecciona tu proyecto

2. **Configura las URLs de Redirección**
   - Ve a: **Authentication** → **URL Configuration**
   - En **Redirect URLs**, agrega:

### Para Desarrollo Local:
```
http://localhost:8081
http://localhost:8081/**
http://localhost:19006
```

### Para Web (Producción):
```
https://tu-dominio.com
https://tu-dominio.com/**
```

### Para Mobile (Expo):
```
exp://localhost:19000
exp+yourprojectname://
```

3. **Habilita Email Confirmation**
   - Ve a: **Authentication** → **Providers**
   - Busca **Email**
   - Asegúrate de que esté habilitado
   - Si es necesario, habilita "Confirm email" bajo las opciones

4. **Verifica el Proveedor SMTP** (si usas email personalizado)
   - Ve a: **Authentication** → **Email Templates**
   - Revisa que el email de confirmación esté correctamente configurado

## Cómo Funciona Ahora:

1. Usuario crea cuenta → recibe email
2. Hace clic en el enlace de confirmación
3. La app detecta el token en la URL (`detectSessionInUrl: true`)
4. Supabase valida el token y crea la sesión
5. El usuario ya está autenticado automáticamente

## Pruebas:

Para probar en desarrollo:
1. Crea una cuenta nueva con un email de prueba
2. Abre el email de confirmación
3. Haz clic en el enlace
4. Deberías ser redirigido a la app y estar automáticamente logueado
