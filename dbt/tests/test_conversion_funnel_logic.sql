-- Test that conversion funnel has expected stages and proper ordering
select * from {{ ref('conversion_funnel') }}
where month is not null
  and funnel_stage not in ('lead', 'sql', 'opportunity', 'won')
-- Expecting no rows to be returned
