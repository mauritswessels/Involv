# Opportunity service filters and images

The website change depends on one additive Supabase migration:

`migrations/20261019000001_opportunity_service_programs_images.sql`

## Apply it

Run the whole migration in the SQL Editor for the same Supabase project Involv
uses. It must be applied after the school-access/trusted-role and public
opportunity-privacy migrations. The SQL checks that the publisher and admin
authorization functions exist before it changes anything.

This migration adds `service_programs` and `image_path`, grants public reads of
only those two new opportunity fields (not organizer email), and creates the
`opportunity-images` public Storage bucket and access policies. It is additive:
existing opportunities get no programme tags and no image automatically.

You can confirm setup with:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'opportunities'
  and column_name in ('service_programs', 'image_path');

select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'opportunity-images';
```

Both opportunity columns should appear. The bucket should be public, limited to
5,242,880 bytes, and allow JPEG, PNG, and WebP.

## How the labels work

- Each opportunity has exactly one service type: Direct, Indirect, Advocacy, or
  Research.
- An opportunity can have no programme tag, one tag, or both IB DP and HSP.
- When multiple programme filters are selected, an opportunity matching either
  selected programme is shown. A selected service type and programme group are
  combined, so the opportunity must also match the chosen service type.
- Existing activities start with no IB DP/HSP tags. An approved publisher or
  admin should edit each listing and select only school-confirmed tags.

## Image visibility and limits

An opportunity can have one optional cover image. Images in this bucket are
public and may be viewed by anyone who can access the image URL, just like the
public opportunity itself. Only approved publishers can upload, and uploads
must use their own account folder. Admins can remove any opportunity image.

The website accepts JPEG, PNG, and WebP up to 5 MB. Do not upload identifiable
student photos unless the school has approved the image and its publication.

After applying the migration, verify the feature in the app as an approved
publisher: edit a test listing, assign a programme, upload an image, save, then
check its card, detail page, and browse filters. Student/unauthorized accounts
should not be able to upload.
