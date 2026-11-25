-- Esquema local de cuentas y documentos.
-- Se aplica con `npm run db:init`. Es idempotente: puede ejecutarse varias veces.
-- No contiene datos ni contraseñas: solo la estructura.

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null
    check (char_length(btrim(nombre)) between 1 and 120),
  correo text not null
    check (char_length(btrim(correo)) between 3 and 254),
  contrasena_hash text not null,
  creado_en timestamptz not null default now()
);

-- El correo se normaliza a minúsculas en la aplicación, pero el índice protege
-- también ante inserciones manuales.
create unique index if not exists usuarios_correo_lower_unico
  on usuarios (lower(correo));

create table if not exists sesiones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  token_hash text not null unique,
  creado_en timestamptz not null default now(),
  expira_en timestamptz not null,
  check (expira_en > creado_en)
);

create index if not exists sesiones_usuario_idx
  on sesiones (usuario_id);

create index if not exists sesiones_expira_idx
  on sesiones (expira_en);

create table if not exists documentos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  titulo text not null default 'Sin título'
    check (char_length(btrim(titulo)) between 1 and 200),
  tipo_documento text not null default 'texto-abierto'
    check (tipo_documento in (
      'ensayo-argumentativo',
      'reporte-investigacion',
      'texto-abierto'
    )),
  version smallint not null default 3
    check (version >= 1),
  contenido jsonb not null
    default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (jsonb_typeof(contenido) = 'object')
);

create index if not exists documentos_usuario_actualizado_idx
  on documentos (usuario_id, actualizado_en desc);
