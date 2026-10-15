import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {transformSync}=require('esbuild');
const pino=require('pino'), pinoHttp=require('pino-http'), express=require('express');
let output='';
const destination={write(chunk){output+=chunk;}};
const root=new URL('../',import.meta.url);
function load(path,imports={}) {
  const source=readFileSync(new URL(path,root),'utf8');
  const transformed=transformSync(source,{loader:'ts',format:'cjs',target:'node22'}).code;
  const module={exports:{}};
  new Function('require','module','exports',transformed)(name=>imports[name]??require(name),module,module.exports);
  return module.exports;
}
const helpers=load('src/lib/requestLogging.ts');
const {logger}=load('src/lib/logger.ts',{
  './requestLogging':helpers,
  pino:options=>pino({...options,transport:undefined,level:'info'},destination),
});
const handlers=load('src/middleware/errors.ts',{'../lib/logger':{logger},'../lib/requestLogging':helpers});
const privateValues=['private-path-marker','private-query-marker','private-cookie-marker','private-token-marker','private-body-marker','private-error-marker','student-private@invalid.example'];
const malicious=Object.assign(new Error('private-error-marker student-private@invalid.example'),{
  name:'private-error-marker',stack:'private-error-marker private-body-marker',type:'private-error-marker',status:500,
});
assert.equal(helpers.requestFailureMetadata(null).status,500);
assert.equal(helpers.requestFailureMetadata('private-body-marker').status,500);
assert.equal(helpers.requestFailureMetadata({get status(){throw Error('Getter must not run');}}).status,500);
let forwarded;
handlers.errorHandler(malicious,{method:'POST',id:123},{headersSent:true},error=>{forwarded=error;});
assert.notEqual(forwarded,malicious);
assert.ok(!JSON.stringify({message:forwarded.message,stack:forwarded.stack}).includes('private-error-marker'));
const app=express();
app.use(pinoHttp({logger,serializers:helpers.requestLogSerializers}));
app.use(express.json({limit:'100b'}));
app.post('/fixture/:id',(req,res)=>{res.err=malicious; throw malicious;});
app.use(handlers.notFoundHandler);app.use(handlers.errorHandler);
const server=app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
try {
  const base=`http://127.0.0.1:${server.address().port}`;
  const headers={'content-type':'application/json',authorization:'Bearer private-token-marker',cookie:'session=private-cookie-marker'};
  for (const [body,status] of [
    ['{"note":"private-body-marker"}',500],
    ['{"note":"private-body-marker",',400],
    [JSON.stringify({note:'private-body-marker'.repeat(20)}),413],
  ]) {
    const response=await fetch(base+'/fixture/private-path-marker?token=private-query-marker',{method:'POST',headers,body});
    assert.equal(response.status,status);
    const result=await response.json();
    for (const value of privateValues) assert.ok(!JSON.stringify(result).includes(value));
    assert.ok(result.requestId!==undefined);
  }
  const missing=await fetch(base+'/private-path-marker?token=private-query-marker');
  assert.equal(missing.status,404);
  assert.ok(!(await missing.text()).includes('private-path-marker'));
} finally {await new Promise(resolve=>server.close(resolve));}
for (const value of privateValues) assert.ok(!output.includes(value),`Sensitive value leaked: ${value}`);
const entries=output.trim().split('\n').map(line=>JSON.parse(line));
assert.ok(entries.some(row=>row.status===500&&row.category==='request_failure'));
assert.ok(entries.some(row=>row.status===400&&row.category==='invalid_request'));
assert.ok(entries.some(row=>row.status===413&&row.category==='body_too_large'));
assert.ok(entries.some(row=>row.req?.id&&row.res?.statusCode===500),'automatic completion/error logging exercised');
console.log('PASS: real Express/Pino HTTP 400/413/500/404 logs and responses omit private paths, queries, headers, bodies and raw errors; partial-response forwarding is sanitised. No hosted writes.');
