-- Test that SLA compliance rates are between 0 and 100
select * from {{ ref('ticket_sla_compliance') }}
where sla_compliance_rate_pct < 0 
   or sla_compliance_rate_pct > 100
-- Expecting no rows to be returned
