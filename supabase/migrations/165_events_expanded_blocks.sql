-- Какие блоки события развёрнуты по умолчанию (настраивается в «Блоки события»)
alter table events add column if not exists expanded_blocks text[] default array['schedule']::text[];
