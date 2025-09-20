-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  role text default 'user' check (role in ('admin', 'user')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Create policies
create policy "Public profiles are viewable by everyone" on public.profiles
  for select using (true);

create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- Create function to handle user creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, role)
  values (new.id, new.raw_user_meta_data->>'username', 'user');
  return new;
end;
$$ language plpgsql security definer;

-- Create trigger for new user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Insert default admin user (şifre: admin123) - Eğer yoksa
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Auth kullanıcısını kontrol et
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@exchange.local') THEN
    -- Yeni auth kullanıcısı oluştur
    INSERT INTO auth.users (
      id,
      email,
      raw_user_meta_data,
      role,
      email_confirmed_at,
      created_at,
      updated_at
    ) VALUES (
      uuid_generate_v4(),
      'admin@exchange.local',
      jsonb_build_object('username', 'admin'),
      'authenticated',
      now(),
      now(),
      now()
    )
    RETURNING id INTO admin_user_id;
  ELSE
    -- Mevcut kullanıcının ID'sini al
    SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@exchange.local';
  END IF;

  -- Profile'ı kontrol et ve ekle/güncelle
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = admin_user_id) THEN
    INSERT INTO public.profiles (id, username, role) 
    VALUES (admin_user_id, 'admin', 'admin');
  ELSE
    UPDATE public.profiles 
    SET username = 'admin', role = 'admin', updated_at = now()
    WHERE id = admin_user_id;
  END IF;
END $$;