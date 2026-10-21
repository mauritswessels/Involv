# Opportunity service and programme filters

The website change depends on one additive Supabase migration:

`migrations/20261019000001_opportunity_service_programs.sql`

## Apply it

Run the whole migration in the SQL Editor for the same Supabase project Involv
uses. Apply it after the public opportunity-privacy migration. This migration
does not install or activate school-only login or trusted-role safeguards.

This migration adds only the `service_programs` column. It does not create a
Storage bucket, change image visibility, or add any image-upload capability.
It leaves existing row-level security policies unchanged and does not grant
access to organizer email. Existing opportunities receive no programme tags
automatically.

You can confirm setup with:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'opportunities'
  and column_name = 'service_programs';
```

The query should return one row.

## How the labels work

- Each opportunity has exactly one service type: Direct, Indirect, Advocacy, or
  Research. The existing `impact_type` column stores this value.
- An opportunity can have no programme tag, one tag, or both IB DP and HSP.
- HSP means High School Program.
- When multiple programme filters are selected, an opportunity matching either
  selected programme is shown. A selected service type and programme group are
  combined, so the opportunity must also match the chosen service type.
- Existing activities start with no IB DP/HSP tags. An approved publisher or
  admin should edit each listing and select only school-confirmed tags.

Image uploads are deferred until the school approves their use and visibility.
