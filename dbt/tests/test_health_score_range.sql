-- Test that health scores are between 0 and 100
select * from {{ ref('health_scores') }}
where overall_health_score < 0 
   or overall_health_score > 100
   or health_status not in ('excellent', 'good', 'fair', 'poor')
-- Expecting no rows to be returned
