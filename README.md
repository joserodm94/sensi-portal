# Portal de Personal — Sensi SRL

App real (React + Supabase), pensada para desplegarse en Vercel. Nadie necesita
cuenta de Claude, Google ni GitHub para usarla — solo su nombre y su PIN.

## Paso 1 — Supabase (base de datos)

1. Entra a tu proyecto de Supabase (o crea uno nuevo).
2. Ve a **SQL Editor** → **New query**.
3. Abre el archivo `supabase/schema.sql` de este proyecto, copia **todo** el
   contenido, pégalo ahí y dale **Run**. Esto crea las tablas y toda la
   lógica de la app. Solo se hace una vez.
4. Ve a **Settings → API**. Copia dos valores, los vas a necesitar en el Paso 3:
   - **Project URL**
   - **anon public key**

## Paso 2 — GitHub (código)

1. Crea un repositorio nuevo (puede ser privado), por ejemplo `sensi-portal-personal`.
2. Sube todos los archivos de esta carpeta. La forma más fácil sin usar
   terminal: en la página del repo, botón **Add file → Upload files**, arrastra
   toda la carpeta (o todos los archivos) y confirma el commit.
   - No hace falta subir la carpeta `node_modules` ni `dist` si aparecen — no
     van incluidas en lo que te entregué.

## Paso 3 — Vercel (publicación)

1. En Vercel: **Add New → Project → Import** y elige el repositorio que acabas
   de subir. Vercel detecta automáticamente que es un proyecto Vite.
2. Antes de darle "Deploy", abre **Environment Variables** y agrega:
   - `VITE_SUPABASE_URL` → el Project URL que copiaste en el Paso 1
   - `VITE_SUPABASE_ANON_KEY` → el anon public key que copiaste en el Paso 1
3. Dale **Deploy**. En un par de minutos te da un link tipo
   `https://sensi-portal-personal.vercel.app` — ese es el link que le mandas
   a las maestras.

## Primer uso

- Entra como **Administración** con el PIN por defecto: **1234**.
- Ve a **Ajustes** y cámbialo de inmediato.
- Ve a **Maestras** y agrégalas una por una (nombre + PIN de 4 dígitos que
  tú definas + días de vacaciones al año, 14 por defecto).
- Comparte el link de Vercel con cada maestra junto con su nombre y PIN.

## Si algo cambia en el código más adelante

Cualquier ajuste que le pidas a Claude sobre esta app se puede volver a subir
a GitHub (reemplazando los archivos) y Vercel la vuelve a publicar sola,
automáticamente, cada vez que el repositorio cambia.

## Notas de seguridad

- Las contraseñas (PINs) y toda la lógica sensible viven del lado de la base
  de datos (Supabase), protegidas con Row Level Security — nadie puede leer
  la tabla de maestras directamente desde el navegador, solo a través de las
  funciones controladas del archivo `schema.sql`.
- Aun así, es un sistema de PIN de 4 dígitos, no una autenticación robusta
  tipo usuario/contraseña con recuperación de cuenta. Está bien para un
  equipo pequeño y de confianza; si el centro crece mucho, se podría migrar
  a Supabase Auth más adelante.
