import { spawn } from 'node:child_process';

export async function checkApplicationConcurrency(sql, socket) {
  const owner='00000000-0000-0000-0000-000000000761';
  const students=[762,763,764].map(n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`);
  const listing='00000000-0000-0000-0000-000000000771';
  sql(`BEGIN;
    INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
      ${[owner,...students].map((id,i)=>`('${id}','race-${i}@iszl.ch',now())`).join(',')};
    DO $$ DECLARE u record; BEGIN
      FOR u IN SELECT * FROM auth.users WHERE id IN (${[owner,...students].map(x=>`'${x}'`).join(',')})
      LOOP
        PERFORM set_config('request.jwt.claim.sub',u.id::text,true);
        INSERT INTO public.profiles(id,name,email) VALUES(u.id,'Race fixture',u.email);
      END LOOP;
    END; $$;
    SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
    UPDATE public.profiles SET role='teacher' WHERE id='${owner}';
    INSERT INTO public.opportunities(id,organizer_id,title,category,positions_available,application_deadline)
      VALUES('${listing}','${owner}','Race fixture','School-Based Service',1,'2035-01-01');
    COMMIT;`);
  const client=(identity,statement)=>new Promise((resolve,reject)=>{
    const child=spawn('psql',['-X','-q','-h',socket,'-p','55439','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']);
    let output='';
    child.stdout.on('data',c=>{output+=c;}); child.stderr.on('data',c=>{output+=c;});
    child.once('error',reject); child.once('close',code=>resolve({code,output}));
    child.stdin.end(`BEGIN; SET LOCAL statement_timeout='8s'; SET LOCAL ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub','${identity}',true);
      ${statement} SELECT pg_sleep(0.2); COMMIT;`);
  });
  const submit=`INSERT INTO public.applications(opportunity_id,applicant_id,organizer_id,motivation,availability)
    VALUES('${listing}',auth.uid(),'${owner}','I would like to contribute to this activity and help others.','After school');`;
  const submissions=await Promise.all(students.slice(0,2).map(id=>client(id,submit)));
  if(submissions.some(r=>r.code!==0)) throw new Error(`Concurrent applications failed: ${JSON.stringify(submissions)}`);
  const duplicate=await Promise.all([client(students[2],submit),client(students[2],submit)]);
  if(duplicate.filter(r=>r.code===0).length!==1 || !duplicate.some(r=>r.output.includes('23505')))
    throw new Error(`Duplicate prevention failed: ${JSON.stringify(duplicate)}`);
  const decisions=await Promise.all(students.slice(0,2).map(id=>client(owner,
    `UPDATE public.applications SET status='Accepted' WHERE opportunity_id='${listing}' AND applicant_id='${id}';`)));
  if(decisions.filter(r=>r.code===0).length!==1 || !decisions.some(r=>r.output.includes('IV004')))
    throw new Error(`Last place overbooked: ${JSON.stringify(decisions)}`);
  sql(`DO $$ BEGIN
    IF (SELECT applicants_count FROM public.opportunities WHERE id='${listing}')<>3
      OR (SELECT count(*) FROM public.applications WHERE opportunity_id='${listing}' AND status='Accepted')<>1 THEN
      RAISE EXCEPTION 'Application totals or accepted capacity are incorrect';
    END IF;
  END; $$;`);
  // Pending withdrawals race on the same parent but each changes the count once.
  const pending=sql(`COPY (SELECT applicant_id FROM public.applications
    WHERE opportunity_id='${listing}' AND status='Pending') TO STDOUT;`).trim().split('\n');
  const withdrawals=await Promise.all(pending.map(id=>client(id,`DELETE FROM public.applications WHERE opportunity_id='${listing}' AND applicant_id=auth.uid();`)));
  if(withdrawals.some(r=>r.code!==0)) throw new Error(`Concurrent withdrawals failed: ${JSON.stringify(withdrawals)}`);
  sql(`DO $$ BEGIN
    IF (SELECT applicants_count FROM public.opportunities WHERE id='${listing}')<>1 THEN
      RAISE EXCEPTION 'Concurrent withdrawals lost a counter update';
    END IF;
  END; $$;`);
  sql(`UPDATE public.opportunities SET positions_available=2 WHERE id='${listing}';`);
  const candidate=pending[0];
  const fresh=await client(candidate,submit);
  if(fresh.code!==0) throw new Error(`Reapplication failed: ${fresh.output}`);
  const capacityRace=await Promise.all([
    client(owner,`UPDATE public.applications SET status='Accepted' WHERE opportunity_id='${listing}' AND applicant_id='${candidate}';`),
    client(owner,`UPDATE public.opportunities SET positions_available=1 WHERE id='${listing}';`),
  ]);
  if(capacityRace.filter(r=>r.code===0).length!==1
    || !capacityRace.some(r=>/IV004|IV005/.test(r.output)))
    throw new Error(`Capacity reduction raced an acceptance: ${JSON.stringify(capacityRace)}`);
  sql(`DO $$ BEGIN
    IF (SELECT count(*) FROM public.applications WHERE opportunity_id='${listing}' AND status='Accepted')
      > (SELECT positions_available FROM public.opportunities WHERE id='${listing}') THEN
      RAISE EXCEPTION 'Capacity reduction overbooked the activity';
    END IF;
  END; $$;`);
  console.log('PASS: simultaneous submissions, duplicate retries, last-place decisions and withdrawals preserve counts and capacity.');
  console.log('PASS: an acceptance racing a capacity reduction cannot overbook the activity.');
}
