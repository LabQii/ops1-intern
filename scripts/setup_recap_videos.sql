-- Run this in Supabase SQL Editor to create the recap_videos table

create table if not exists recap_videos (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  url text not null,
  embed_url text not null,
  thumbnail_url text,
  created_at timestamptz default now()
);
