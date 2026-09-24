# FlorenceHSB school-wide launch review pack

**Status:** Working draft for school review  
**Intended context:** Private school in the Canton of Zug, Switzerland  
**Product:** Involv, a service-learning opportunity and application website  
**Not legal advice or a compliance certification.** The school must confirm its legal
status, actual vendor contracts and configurations, student age groups, and policies.
Have the school’s responsible privacy contact or Swiss counsel review before real
student data is used.

## 1. Executive summary

Involv can support a school-wide pilot, but school approval and the data-protection
review are not complete merely because technical safeguards exist. The project
should have a named school or organization operator, documented purposes and
retention periods, reviewed provider terms, an approved student/parent notice, and
a tested staging environment.

The Canton of Zug’s Data Protection Authority says the Federal Act on Data
Protection (FADP) applies to companies and private individuals. Zug’s cantonal law
generally covers cantonal and municipal bodies and certain contractors performing
public services. Confirm whether FlorenceHSB is operating solely as a private
school or under a public-service mandate; that can affect the applicable authority
and rules.

### Decisions required before a pilot with real student information

- [ ] School leadership names the legal operator/controller and an adult service owner.
- [ ] The school privacy lead confirms applicable law and whether a full data-protection
      impact assessment (DPIA) is needed.
- [ ] School IT/privacy staff review Replit, Supabase, Google sign-in, provider terms,
      subprocessors, data locations, international transfers, backups, and deletion.
- [ ] The school approves the privacy notice, data minimization, retention schedule,
      student/parent communications, and account deletion process.
- [ ] The school confirms safeguarding procedures for external organizations and
      opportunities.
- [ ] The launch migrations and role tests are run successfully in a verified staging
      Supabase project; no production migration is applied without approval.
- [ ] The saved-opportunity privacy behavior is tested for cross-user access.
- [ ] A small pilot passes support, access, and incident-response checks.

## 2. What the application currently does

This summary is based on the application code reviewed for this draft. Confirm that
the production deployment and provider settings match it.

- The web app uses Google OAuth through Supabase Auth.
- After sign-in, the browser uses the Supabase client directly for user data. The
  Express API currently provides health/readiness endpoints rather than serving the
  application's profile, opportunity, or application records.
- The browser is configured with the Supabase project URL and public anonymous key.
  A Supabase service-role key must never be placed in the frontend.
- Profiles include name, email, role, optional photo URL, grade, biography, interests,
  career goals, skills, availability, preferred categories, onboarding status, and
  creation date.
- Applications include the opportunity and applicant identifiers, opportunity title,
  applicant name/email/grade, motivation, relevant experience, availability, status,
  and submission date. Application free text may contain information the school did
  not intend to collect.
- Opportunities include descriptions, organizer name/role/email, location, dates,
  time commitment, age/grade requirements, and related listing details. Active
  opportunities are intended to be publicly readable.
- Saved opportunities associate a user with opportunity identifiers.
- Administrators have broad access to profiles, opportunities, and applications.
  Organizers need access to applications for their opportunities; students need
  access to their own application records.
- The application logs some authentication state and currently logs signed-in email
  addresses to the browser console. Remove or appropriately restrict those debug
  logs before a school-wide launch.

The exact Supabase region, Google OAuth scopes, provider retention, Replit deployment
region, and contractual data-processing terms have not been confirmed here.

## 3. Data inventory and purpose map

| Data set | Examples observed in the app | Purpose | Intended access | School decision |
| --- | --- | --- | --- | --- |
| Authentication account | Supabase user ID; Google sign-in identity and email; session state | Sign-in and account continuity | The signed-in user and authentication service; application services receive the user ID and selected profile details | Confirm Google scopes, account eligibility, and what happens when a student leaves |
| Profile | Name, email, role, grade, optional photo URL, bio, interests, career goals, skills, availability, preferred categories | Create and manage a student or organizer profile | User’s own profile; designated school admins; other authenticated access only as approved and enforced | Confirm which fields are necessary; make sensitive or optional fields optional |
| Application | Applicant and opportunity IDs, applicant name/email/grade, motivation, experience, availability, status, submitted date | Submit and manage an application | Applicant; organizer for that opportunity; designated admins, subject to database authorization | Explain sharing before submission; decide retention and withdrawal handling |
| Opportunity listing | Title, descriptions, organizer name/role/email, location, dates, age/grade requirements, skills and impact details | Publish and administer service opportunities | Active listings are intended to be public; owners and admins manage records | Confirm which organizer contact details are public and who verifies listings |
| Saved opportunity | User ID and opportunity ID | Let a user keep a private list | That user only | Test that another user cannot read or change the saved list |
| Operational telemetry | API request ID, method, path, status, response time; transient IP-based rate-limit bucket; browser errors and debug output | Service reliability, abuse prevention, troubleshooting | Service operators and providers under their support/logging arrangements | Confirm retention and access; remove signed-in emails from console output; do not log application text or tokens |

### Data-minimization recommendations

- Keep the profile fields that support the service purpose; do not require a biography,
  photo, career goals, or other optional narrative without a clear school-approved need.
- Tell applicants not to enter sensitive personal information in free-text answers
  unless the school has approved a specific need and handling process.
- Review whether `organizer_email` needs to be visible on public listings or whether
  a school-managed contact route is safer.
- Avoid collecting full birth dates, home addresses, phone numbers, or health data
  unless the school documents a specific necessity and safeguards.

## 4. Draft student and parent privacy notice

**Draft only. Replace every bracketed item and have the school approve this before
publishing.** The controller, purpose, recipients, retention, data locations, and
contact details must reflect actual arrangements.

### Involv privacy information for FlorenceHSB students and families

**Who operates Involv?**  
Involv is operated by **[full legal name of school/operator]**, of **[postal address]**.
The school/operator is responsible for deciding how information in Involv is used.
For privacy questions, contact **[school privacy contact and email]**.

**What does Involv do?**  
Involv helps students find and apply for service-learning opportunities and helps
approved organizers manage listings and applications.

**What information may be used?**

- Account details received during Google sign-in, such as your account identifier,
  name, and email address.
- Profile information you provide, such as role, grade, biography, interests, goals,
  skills, availability, preferred categories, and an optional profile image.
- Opportunity information, including organizer contact details and listing content.
- Application information you submit, including your name, email, grade, motivation,
  relevant experience, availability, the opportunity applied for, and application
  status.
- Technical information needed to operate and protect the service, such as request
  records and error information, as described in **[approved logging/retention detail]**.

**Why is it used?**  
The school uses this information to **[school-approved purposes, for example:
operate accounts, display opportunities, receive and manage applications, communicate
about applications, and administer the service]**. The school will not collect
additional information for a new purpose without reviewing whether students must be
informed and what approval is needed.

**Who can see application information?**  
Your application is available to you, the organizer responsible for the opportunity
you applied to, and authorized school administrators, according to the school’s
access rules. Active opportunity listings may be visible to people who are not signed
in. **[Confirm whether organizer names, roles, or email addresses appear publicly.]**

**Which service providers are involved?**  
The current application is configured to use **Replit** for web hosting,
**Supabase** for sign-in and database services, and **Google** for sign-in. The school
must confirm the contracted provider entities, subprocessors, data locations,
international transfers, and applicable terms before this notice is finalized.

**How long is information kept?**  
The school will keep information only for **[approved retention periods by data
category]**. The school should explain how long profiles, applications, opportunity
records, and technical logs are retained and what happens when a student leaves or
requests account closure.

**Your choices and requests**  
For questions or requests about your information, contact **[privacy contact]**.
Requests will be handled under the rules that apply to the school and the information
concerned. Students should not include sensitive information in profile or application
text unless specifically asked by the school.

**Students under 18**  
The school will explain **[school-approved student and parent/guardian notice or
consent process]** before the service is used. This notice does not replace any
separate permission required for a particular opportunity or placement.

**Effective date:** [date]  
**Last reviewed:** [date]

### Publication blockers for this notice

- Legal operator name, address, and privacy contact.
- Approved purposes and any school-specific policy/legal explanation.
- Provider entities, subprocessors, regions, and transfer arrangements.
- Retention periods for each data category, including authentication accounts and logs.
- Student/parent communication and consent approach for the actual ages served.
- Public visibility of organizer details and other opportunity fields.
- Final method for account closure and data deletion.

## 5. Initial privacy-impact screening

This is a screening aid, not a completed DPIA. The school privacy lead must decide
whether processing is likely to create a high risk and whether a formal DPIA or
consultation is required.

| Risk to consider | Why it matters here | Draft mitigation / decision |
| --- | --- | --- |
| Student profile or application exposed to the wrong person | Profiles and application narratives can reveal personal information; organizers need only application data for their own opportunities | Verify RLS and role behavior in staging. The role-access test work has been merged; keep the separate saved-opportunity privacy check open until proved |
| Student writes or changes a privileged role | Role changes could give access to many records | Keep role authorization in database policies and triggers; test denied and permitted role changes with separate test accounts |
| Organizer changes an applicant’s narrative or identity | Organizers should process applications without rewriting student-submitted content | Test organizer status updates and forbidden edits to application fields |
| Public listing discloses contact details | Active opportunities are publicly readable and contain organizer contact fields | Review public UI/API responses; use a school contact address where appropriate |
| Excessive information is collected | Free-text motivation and experience fields may invite unnecessary personal details | Minimize fields, add student guidance, and define a process for inappropriate disclosures |
| Provider or international-transfer risk | Replit, Supabase, and Google are involved; deployment region and contractual details are unconfirmed | Obtain current provider documents and school approval before real student data is processed |
| Account closure is incomplete | The current admin profile deletion function deletes the profile row but does not delete the Supabase Auth account | Define a complete closure process, including Auth and related records, before promising full deletion |
| Debug information includes identifiers | Current authentication debug logs output a signed-in email in the browser console | Remove or restrict these logs and confirm production logging does not capture tokens, application text, or profile details |
| Unsafe or unsuitable opportunity | Listings involve organizations and possible contact with adults outside school | Name a staff reviewer, verification process, reporting contact, supervision rules, and any additional parental permission |

### Initial conclusion

There is enough student data and free text to warrant a documented privacy review.
The school privacy lead should record the risk decision. Do not label this screening
as “DPIA completed” unless the school has completed and approved the required
assessment.

## 6. Vendor due-diligence checklist

Use one copy per provider and retain the provider’s answers, contract, and date of
review. Verify facts from current contractual documents rather than assuming a
provider’s default configuration applies.

| Question | Replit hosting | Supabase Auth/database | Google sign-in |
| --- | --- | --- | --- |
| Contracting legal entity and service | [confirm] | [confirm] | [confirm] |
| Data categories processed for FlorenceHSB | [confirm] | [confirm] | [confirm] |
| Data-center/backup locations and transfer countries | [confirm] | [confirm] | [confirm] |
| Data-processing terms and school instructions supported | [confirm] | [confirm] | [confirm] |
| Subprocessors and change-notification process | [confirm] | [confirm] | [confirm] |
| Encryption, access controls, audit logs, and support access | [confirm] | [confirm] | [confirm] |
| Breach notification timing and contact route | [confirm] | [confirm] | [confirm] |
| Retention, export, deletion, and account closure | [confirm] | [confirm] | [confirm] |
| Backup schedule, recovery, and restoration support | [confirm] | [confirm] | [confirm] |
| Sign-in scopes, account restrictions, and OAuth redirect configuration | N/A | [confirm] | [confirm] |
| Service availability and exit/migration options | [confirm] | [confirm] | [confirm] |

**Architecture note:** The browser talks directly to Supabase for application data;
the Express API is not currently the application’s data-processing backend. Confirm
that provider configurations and contracts support this design, and do not expose
privileged database credentials in browser code.

## 7. Draft retention and deletion schedule

The intervals below are intentionally left for the school to decide. Do not publish
or promise a period until the school has checked its own records, education, and
contractual requirements.

| Data category | Proposed retention trigger | Approved interval / action |
| --- | --- | --- |
| Google/Supabase authentication account | Student leaves, account is inactive, or closure is requested | [school to define; include the Supabase Auth identity] |
| Profile | Account closure or no longer required for the service | [school to define; delete or minimize profile fields] |
| Application | Opportunity process ends or application is withdrawn | [school to define; retain only as long as needed] |
| Opportunity listing | Listing closes or expires | [school to define archive/delete rule and organizer contact removal] |
| Saved opportunity | User unsaves or account closes | [school to define; verify dependent-row deletion] |
| Operational logs | Log entry is created | [provider-specific retention and school-approved period] |
| Backups | Backup is created | [provider retention and expiry; document restore process] |

### Account-closure implementation check

The current profile-deletion path does not remove the corresponding Supabase Auth
account. Before promising complete deletion, the school and developers need a
controlled server-side process that handles the authentication identity and related
records without exposing service-role credentials to the browser. Confirm whether
applications must be deleted, anonymized, or retained under an approved schedule.

## 8. Pilot and launch checklist

### Governance

- [ ] School leadership approves the purpose, audience, operator, and pilot size.
- [ ] A named adult owner handles access requests, support, listing approval, and incidents.
- [ ] School privacy contact confirms applicable rules and approves the final notice.
- [ ] The school decides whether student/parent notice or consent is needed and records it.
- [ ] The school approves acceptable-use, safeguarding, and opportunity-review procedures.

### Technical and vendor review

- [ ] Confirm which Supabase project is staging and which is production.
- [ ] Review backups and migration history before any remote schema change.
- [ ] Apply launch migrations to staging and run the database security behavior suite.
- [ ] Test student, organizer, and admin accounts, including denied actions.
- [ ] Test that saved opportunities cannot be read or changed by another user.
- [ ] Confirm organizer emails and active opportunity fields are appropriate for public view.
- [ ] Remove browser logs that disclose signed-in email addresses.
- [ ] Confirm OAuth redirect allowlists and that no service-role key is in frontend bundles.
- [ ] Complete provider due diligence and confirm data location/transfer details.
- [ ] Run the documented read-only load tests against staging, not production.
- [ ] Confirm backup restoration, log retention, and incident contacts.

### Pilot operation

- [ ] Start with a limited group and a short review window.
- [ ] Use test or specifically approved data first.
- [ ] Have staff review opportunity publishers and listings before publication.
- [ ] Give students a clear way to report a problem and ask privacy questions.
- [ ] Review access logs, errors, support requests, and safeguarding concerns.
- [ ] Decide pilot success criteria and a stop/rollback owner before opening access.

## 9. Draft budget and funding plan

### Costs to estimate

| Cost line | One-time or recurring | Estimate / owner |
| --- | --- | --- |
| Hosting and domain | [recurring] | [quote and budget owner] |
| Database, authentication, and backups | [recurring] | [provider plan and budget owner] |
| Development and maintenance | [one-time + recurring] | [staff/contractor estimate] |
| Privacy/security review and staging tests | [one-time + recurring] | [school/consultant estimate] |
| Staff time for opportunity review and support | [recurring] | [hours and responsible department] |
| Student/parent onboarding and training | [one-time + recurring] | [estimate] |
| Accessibility and content review | [one-time + recurring] | [estimate] |
| Contingency and incident response | [recurring reserve] | [school to set] |

### Potential routes to investigate

1. **School-funded pilot:** best first option for clearly assigning ownership and
   ongoing support.
2. **Canton Zug social lottery fund:** the Canton says the fund supports charitable,
   nonprofit, and cultural purposes with a Zug or national connection. Ask whether
   a private school or its legal entity is eligible and whether this project qualifies
   before writing an application. [Official information](https://zg.ch/de/soziales/lotteriefondsgesuche-soziales)
3. **Federal youth-work support:** the Federal Social Insurance Office supports
   eligible organizations and some extracurricular youth projects. This may fit a
   broader youth participation/community-service program better than a software-only
   request. Confirm current eligibility directly. [Official information](https://www.bsv.admin.ch/en/promotion-of-youth-activities)
4. **Movetia:** supports education exchange, mobility, and cooperation projects.
   Consider it only if Involv is part of a wider eligible educational cooperation
   project; do not assume that routine platform costs qualify.
   [Funding opportunities](https://movetia.ch/en/funding-opportunities)
5. **Local foundations, community partners, or sponsors:** approach only after the
   school approves the project and can explain governance, student safeguards, and
   the annual cost.

### One-page funding case to prepare

- Need: what current student/organizer problem the service-learning platform addresses.
- Beneficiaries: which year groups and how many students/organizers are expected.
- Outcomes: opportunities listed, applications completed, participation/access measures.
- Safeguards: school owner, privacy review, opportunity screening, support process.
- Sustainability: ongoing budget owner after grant funding ends.
- Request: itemized one-time and recurring costs; identify any school contribution.
- Evaluation: pilot period, success measures, and what happens if the pilot stops.

## 10. Decisions FlorenceHSB must supply

| Decision | School contact |
| --- | --- |
| Full legal operator name and whether there is any public-service mandate | Leadership / legal |
| Student age ranges and school account eligibility | Leadership / safeguarding |
| Approved purpose and necessary profile/application fields | Service owner / teaching team |
| Student/parent notice and consent approach | Privacy lead / leadership |
| Retention intervals and deletion/withdrawal policy | Privacy lead / records owner |
| Public listing fields and organizer verification process | Safeguarding / service owner |
| Provider contract, region, subprocessor, and transfer review | IT / privacy lead |
| Incident contact, response owner, and notification procedure | IT / leadership |
| Pilot budget and ongoing funding owner | Finance / leadership |

## 11. Official references

- [Canton Zug Data Protection Authority](https://zg.ch/en/datenschutzstelle) — describes
  the distinction between Zug public bodies and private organizations and identifies
  the applicable authority.
- [Swiss Federal Act on Data Protection (FADP)](https://www.fedlex.admin.ch/eli/cc/2022/491/en)
- [FDPIC: Outsourcing of data processing](https://www.edoeb.admin.ch/en/outsourcing-of-data-processing)
- [FDPIC: Data-protection impact assessment](https://www.edoeb.admin.ch/en/data-protection-impact-assessment)
- [Zug social lottery-fund applications](https://zg.ch/de/soziales/lotteriefondsgesuche-soziales)
- [FSIO: Promotion of youth activities](https://www.bsv.admin.ch/en/promotion-of-youth-activities)
- [Movetia funding opportunities](https://movetia.ch/en/funding-opportunities)
