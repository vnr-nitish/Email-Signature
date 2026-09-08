-- Run this once in the Supabase SQL Editor. Adds the new optional column
-- for a non-default signature's custom social-icon color.
alter table signatures add column if not exists icon_color text default '#0e6f5f';
