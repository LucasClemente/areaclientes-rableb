# Área de clientes · Rableb

Panel administrativo para la agencia. React + Vite, API en PHP con SQLite.

## Desarrollo

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. En **localhost** el login es sin código: solo escribe tu correo y entras (si no existes, se crea como usuario).

Para que el login funcione en local, la API PHP debe ejecutarse. Opción: después de `npm run build`, ejecuta `php -S localhost:8080 -t dist` y abre `http://localhost:8080` (entrarás sin código).

### Base de datos local de prueba

Para crear una BD con usuarios de ejemplo (y resetear la actual si existe):

```bash
php scripts/init_test_db.php
```

Se crea `public/panel.sqlite` (y `public/uploads/` si no existe) con:

- **info@rableb.com** — super_admin  
- **cliente1@test.com**, **cliente2@test.com**, **maria@ejemplo.com** — user  

En localhost puedes entrar con cualquiera de estos correos sin código.

## Build para Siteground

```bash
npm run build
```

Sube **todo el contenido** de la carpeta `dist/` a tu hosting (p. ej. `public_html`):

- `index.html`
- `assets/`
- `api.php`
- `.htaccess`
- `robots.txt`

**Base de datos y subidas:** La API crea sola, en la misma carpeta donde está `api.php`, el archivo `panel.sqlite` y la carpeta `uploads/` la primera vez que se llama (p. ej. al iniciar sesión). No hace falta ningún script extra; solo subí el contenido de `dist/` y asegurate de que el servidor tenga permisos de escritura en esa carpeta.

Requisitos en el servidor: **PHP** con PDO SQLite y envío de correo (mail) configurado.

### Entornos y base de datos

- **Local:** La API usa `public/panel.sqlite` y `public/uploads/` (los crea `init_test_db.php` o la propia API). Si usás solo `npm run dev`, el front usa datos mock y no toca ninguna BD real.
- **Servidor:** La API usa **solo** la base de datos del servidor. La primera vez que alguien entra (o se llama a la API), se crean `panel.sqlite` y `uploads/` en la raíz de lo subido. Esa base es independiente de la de tu PC; no se comparten datos entre local y producción.

## Usuarios

- **Super admin:** `info@rableb.com` (creado automáticamente la primera vez).
- En producción el acceso es por **código al correo**: se pide el email, se envía un código y hay 10 minutos para ingresarlo.
- En localhost el acceso es **directo** con el email (sin código).

## Estructura del panel

- **Inicio:** bienvenida (informes/reportes más adelante).
- **Usuarios:** solo visible para super admin; lista de usuarios registrados.
