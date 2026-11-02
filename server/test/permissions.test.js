import test from 'node:test';
import assert from 'node:assert/strict';
import { allow } from '../src/middleware/permissions.js';
function invoke(role,method,area){let next=false,status=200,payload=null;const req={user:{role},method};const res={status(n){status=n;return this},json(body){payload=body;return this}};allow(area)(req,res,()=>{next=true});return {next,status,payload};}
test('funcionário pode consultar caixa, mas não lançar sangria',()=>{assert.equal(invoke('employee','GET','cash').next,true);const denied=invoke('employee','POST','cash');assert.equal(denied.status,403);});
test('gerente pode operar financeiro',()=>{assert.equal(invoke('manager','POST','financial').next,true);});
test('proprietário mantém acesso administrativo',()=>{assert.equal(invoke('owner','DELETE','employees').next,true);});
