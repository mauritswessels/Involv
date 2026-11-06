# Handling privacy requests and message reports (for school admins)

Both queues are in **Admin panel → Reports** and **Admin panel → Privacy requests**.
Admins get a bell notification for each new item. Students are notified when
an item is handled.

## Message reports

Any current member of an activity group (students and the organiser) can report
someone else's message. The report keeps a copy of the message text, so the
record survives even if the sender edits or removes it.

- **Remove message**: clears the text for everyone; a "Message removed" marker stays.
- **Handled, keep message**: you dealt with it another way (for example, talked to the student).
- **Dismiss**: no action needed.

One decision closes every open report about the same message. The reporter is
told their report was reviewed. The sender is never told who reported them.
Serious concerns follow the school's safeguarding procedure, not just this queue.

## Privacy requests

| Request | What to do |
| --- | --- |
| Copy of my information | Students can already use *Profile → Your data → Download my data*. Reply pointing them there, or export on their behalf if they cannot. |
| Correction | Students can edit their own profile. For other records (e.g. hours), the activity organiser can correct hours; reply explaining what changed. |
| Question | Answer it in the reply box. |
| Deletion | See below. |

A reply is required to complete or decline a request, and the student sees it.

### Deleting an account

Check the school's retention rule first: it may require keeping approved service
hours for a period. Then, in Supabase → **Authentication → Users**, delete the user.
Deleting the Auth user **permanently** removes, through database cascades:

- their profile, applications and saved listings;
- attendance, service-hour claims and review history;
- reflections, group messages they sent and their notifications.

These are kept, without the deleted person linked: announcements/sessions they
created (author set empty), hours they reviewed for others (reviewer set empty),
reports they made or were named in (names kept as text for the safeguarding record),
and privacy requests (name and email kept as the request record).

If the school decides approved hours must be kept after deletion, **do not delete
yet**: export the student's data first (or keep the request "Being handled") until
an anonymisation process is agreed. Nothing in Involv deletes accounts automatically.
