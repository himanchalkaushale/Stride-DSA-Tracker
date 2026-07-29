-- Keep common CSV topic variants synchronized with the canonical app filters.
-- Custom topics are preserved as entered.

update public.problems
set topics = array(
  select case
    when regexp_replace(lower(trim(topic)), '[^a-z0-9]', '', 'g') in ('linkedlist', 'linkedlists')
      then 'Linked Lists'
    else trim(topic)
  end
  from unnest(topics) as topic
)
where exists (
  select 1
  from unnest(topics) as topic
  where regexp_replace(lower(trim(topic)), '[^a-z0-9]', '', 'g') in ('linkedlist', 'linkedlists')
);

-- Earlier CSV sheets used learning subtopics in the topic column. Add the
-- canonical parent topic without removing that useful subtopic metadata.
update public.problems
set topics = array_append(topics, 'Linked Lists')
where not ('Linked Lists' = any(topics))
  and (
    lower(concat_ws(' ', title, description, array_to_string(topics, ' '), array_to_string(patterns, ' ')))
      ~ '(linked[ -]?lists?|singly|doubly)'
    or lower(title) in ('swap nodes in pairs', 'merge nodes in between zeros', 'reverse nodes in k-group')
  );
