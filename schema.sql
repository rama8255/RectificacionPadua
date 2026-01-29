-- Extensión para generar UUIDs si está disponible
create extension if not exists "pgcrypto";

-- Tabla: articles
create table if not exists public.articles (
  id uuid default gen_random_uuid() primary key,
  code text,
  name text not null,
  measure text,
  qty integer default 0,
  price numeric(12,2) default 0,
  type text,
  brand text,
  model text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabla: motors
create table if not exists public.motors (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamptz default now()
);

-- Tabla: motor_items
create table if not exists public.motor_items (
  id uuid default gen_random_uuid() primary key,
  motor_id uuid references public.motors (id) on delete cascade,
  source_article_id uuid references public.articles (id) on delete set null,
  code text,
  name text not null,
  measure text,
  qty integer default 1,
  price numeric(12,2) default 0,
  is_labor boolean default false,
  created_at timestamptz default now()
);

-- Extensión para generar UUIDs si está disponible
create extension if not exists "pgcrypto";

-- Tabla: articles
create table if not exists public.articles (
  id uuid default gen_random_uuid() primary key,
  code text,
  name text not null,
  measure text,
  qty integer default 0,
  price numeric(12,2) default 0,
  type text,
  brand text,
  model text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabla: motors
create table if not exists public.motors (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamptz default now()
);

-- Tabla: motor_items
create table if not exists public.motor_items (
  id uuid default gen_random_uuid() primary key,
  motor_id uuid references public.motors (id) on delete cascade,
  source_article_id uuid references public.articles (id) on delete set null,
  code text,
  name text not null,
  measure text,
  qty integer default 1,
  price numeric(12,2) default 0,
  is_labor boolean default false,
  created_at timestamptz default now()
);