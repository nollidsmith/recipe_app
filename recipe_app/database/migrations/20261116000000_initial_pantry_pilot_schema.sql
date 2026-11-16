-- PantryPilot initial schema.
-- Apply through Supabase migrations; do not recreate this manually in production.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  instructions text not null check (char_length(trim(instructions)) > 0),
  prep_minutes integer check (prep_minutes is null or prep_minutes >= 0),
  cook_minutes integer check (cook_minutes is null or cook_minutes >= 0),
  servings integer check (servings is null or servings > 0),
  difficulty text check (difficulty is null or difficulty in ('easy', 'medium', 'hard')),
  image_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  quantity numeric check (quantity is null or quantity >= 0),
  unit text,
  notes text,
  position integer not null check (position >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (recipe_id, position)
);

create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  quantity numeric not null default 0 check (quantity >= 0),
  unit text not null,
  category text,
  low_stock_threshold numeric check (low_stock_threshold is null or low_stock_threshold >= 0),
  expires_on date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  quantity numeric check (quantity is null or quantity >= 0),
  unit text,
  source_recipe_id uuid references public.recipes(id) on delete set null,
  is_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, recipe_id)
);

create index recipes_user_updated_idx on public.recipes (user_id, updated_at desc);
create index recipes_user_title_idx on public.recipes (user_id, title);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, position);
create index pantry_items_user_name_idx on public.pantry_items (user_id, name);
create index pantry_items_user_expiry_idx on public.pantry_items (user_id, expires_on);
create index shopping_list_user_status_idx on public.shopping_list_items (user_id, is_completed, created_at);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger recipes_set_updated_at
before update on public.recipes
for each row execute function public.set_updated_at();

create trigger recipe_ingredients_set_updated_at
before update on public.recipe_ingredients
for each row execute function public.set_updated_at();

create trigger pantry_items_set_updated_at
before update on public.pantry_items
for each row execute function public.set_updated_at();

create trigger shopping_list_items_set_updated_at
before update on public.shopping_list_items
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.pantry_items enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.favorites enable row level security;

create policy "Users can view their own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can insert their own profile"
on public.profiles for insert
with check (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can manage their own recipes"
on public.recipes for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage ingredients for their recipes"
on public.recipe_ingredients for all
using (exists (
  select 1 from public.recipes
  where recipes.id = recipe_ingredients.recipe_id
    and recipes.user_id = auth.uid()
))
with check (exists (
  select 1 from public.recipes
  where recipes.id = recipe_ingredients.recipe_id
    and recipes.user_id = auth.uid()
));

create policy "Users can manage their own pantry items"
on public.pantry_items for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their own shopping list"
on public.shopping_list_items for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    source_recipe_id is null
    or exists (
      select 1 from public.recipes
      where recipes.id = shopping_list_items.source_recipe_id
        and recipes.user_id = auth.uid()
    )
  )
);

create policy "Users can manage their own favorites"
on public.favorites for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.recipes
    where recipes.id = favorites.recipe_id
      and recipes.user_id = auth.uid()
  )
);
