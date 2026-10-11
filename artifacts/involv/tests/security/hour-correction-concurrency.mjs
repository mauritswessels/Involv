import { spawn } from 'node:child_process';

export async function checkCorrectionConcurrency(sql, socket) {
  // Uses the committed fixture created by participation-concurrency.mjs.
  const owner = '00000000-0000-0000-0000-000000000802';
  const student = '00000000-0000-0000-0000-000000000801';
  const id = sql(`COPY (SELECT id FROM public.activity_hours WHERE student_id='${student}') TO STDOUT;`).trim();
  const version = () => sql(`COPY (SELECT updated_at FROM public.activity_hours WHERE id='${id}') TO STDOUT;`).trim();
  const call = (hours, stamp) => `SELECT public.correct_activity_hours('${id}',${hours},'approved',
    'Concurrent correction','${stamp}',gen_random_uuid());`;
  const prepare = hours => sql(`BEGIN; SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub','${owner}',true);
    ${call(hours, version())} COMMIT;`);
  const client = (identity, statement) => new Promise((resolve, reject) => {
    const child = spawn('psql', ['-X','-q','-h',socket,'-p','55439','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']);
    let output = '';
    child.stdout.on('data', c => { output += c; });
    child.stderr.on('data', c => { output += c; });
    child.once('error', reject);
    child.once('close', code => resolve({ code, output }));
    child.stdin.end(`BEGIN; SET LOCAL ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub','${identity}',true);
      ${statement} SELECT pg_sleep(0.2); COMMIT;`);
  });
  prepare(8);
  const stamp = version();
  const simultaneous = await Promise.all([client(owner, call(9, stamp)), client(owner, call(10, stamp))]);
  if (simultaneous.filter(r => r.code === 0).length !== 1
    || !simultaneous.some(r => r.output.includes('reviewed entry changed'))) {
    throw new Error(`Corrections overwrote a newer version: ${JSON.stringify(simultaneous)}`);
  }
  prepare(8);
  const mixed = await Promise.all([
    client(owner, call(16, version())),
    client(student, `SELECT public.save_activity_hours('00000000-0000-0000-0000-000000000803',
      (now() AT TIME ZONE 'Europe/Zurich')::date,16,'Claim racing an increase');`),
  ]);
  if (mixed.filter(r => r.code === 0).length !== 1
    || !mixed.some(r => r.output.includes('cannot exceed 24 hours'))) {
    throw new Error(`Correction/submission shared daily cap failed: ${JSON.stringify(mixed)}`);
  }
  sql(`DO $$ BEGIN
    IF (SELECT sum(hours) FROM public.activity_hours WHERE student_id='${student}'
      AND status IN ('approved','pending')) > 24 THEN
      RAISE EXCEPTION 'Concurrent corrections exceeded daily cap';
    END IF;
    IF (SELECT count(*) FROM public.activity_hour_reviews WHERE entry_id='${id}' AND kind='review') <> 1 THEN
      RAISE EXCEPTION 'Original review was lost or duplicated';
    END IF;
  END; $$;`);
  console.log('PASS: simultaneous corrections protect the displayed version; a correction racing a submission respects the shared daily cap.');
}
