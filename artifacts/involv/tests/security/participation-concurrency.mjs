import { spawn } from 'node:child_process';

// Real simultaneous database sessions; no mocks, credentials or hosted writes.
export async function checkParticipationConcurrency(sql, socket) {
  sql(`
    BEGIN;
    INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
      ('00000000-0000-0000-0000-000000000801','concurrency-student@iszl.ch',now()),
      ('00000000-0000-0000-0000-000000000802','concurrency-owner@iszl.ch',now());
    SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000801',true);
    INSERT INTO public.profiles(id,email,name) VALUES(auth.uid(),'concurrency-student@iszl.ch','Concurrent student');
    SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000802',true);
    INSERT INTO public.profiles(id,email,name) VALUES(auth.uid(),'concurrency-owner@iszl.ch','Concurrent owner');
    SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
    UPDATE public.profiles SET role='teacher' WHERE id='00000000-0000-0000-0000-000000000802';
    INSERT INTO public.opportunities(id,organizer_id,title,category,application_deadline)
      VALUES('00000000-0000-0000-0000-000000000803','00000000-0000-0000-0000-000000000802','Concurrency fixture','School-Based Service','2030-01-01');
    INSERT INTO public.applications(opportunity_id,applicant_id,organizer_id,status)
      VALUES('00000000-0000-0000-0000-000000000803','00000000-0000-0000-0000-000000000801','00000000-0000-0000-0000-000000000802','Accepted');
    COMMIT;
  `);
  const client = text => new Promise((resolve, reject) => {
    const child = spawn('psql', ['-X','-q','-h',socket,'-p','55439','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']);
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', reject);
    child.once('close', code => resolve({ code, output }));
    child.stdin.end(text);
  });
  const submit = description => client(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000801',true);
    SELECT public.save_activity_hours('00000000-0000-0000-0000-000000000803',
      (now() AT TIME ZONE 'Europe/Zurich')::date,16,'${description}');
    SELECT pg_sleep(0.25);
    COMMIT;
  `);
  const submissions = await Promise.all([submit('Parallel claim A'),submit('Parallel claim B')]);
  if (submissions.filter(r => r.code === 0).length !== 1
    || !submissions.some(r => r.output.includes('cannot exceed 24 hours'))) {
    throw new Error(`Concurrent daily limit failed: ${JSON.stringify(submissions)}`);
  }
  sql(`DO $$ BEGIN
    IF NOT (SELECT count(*)=1 AND sum(hours)=16 FROM public.activity_hours
      WHERE student_id='00000000-0000-0000-0000-000000000801') THEN
      RAISE EXCEPTION 'Concurrent claims were duplicated or exceeded daily cap';
    END IF;
  END; $$;`);
  const id = sql(`COPY (SELECT id FROM public.activity_hours WHERE student_id='00000000-0000-0000-0000-000000000801') TO STDOUT;`).trim();
  const version = sql(`COPY (SELECT updated_at FROM public.activity_hours WHERE id='${id}') TO STDOUT;`).trim();
  const review = decision => client(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000802',true);
    SELECT public.review_activity_hours('${id}','${decision}','Concurrent review','${version}');
    SELECT pg_sleep(0.25);
    COMMIT;
  `);
  const reviews = await Promise.all([review('approved'),review('rejected')]);
  if (reviews.filter(r => r.code === 0).length !== 1
    || !reviews.some(r => r.output.includes('changed or was already reviewed'))) {
    throw new Error(`Concurrent reviews were not protected: ${JSON.stringify(reviews)}`);
  }
  console.log('PASS: simultaneous submissions respect the shared daily cap; simultaneous reviewers cannot overwrite the first decision.');
}
