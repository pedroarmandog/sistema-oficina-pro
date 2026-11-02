import test from 'node:test';
import assert from 'node:assert/strict';
import { tenantScope } from '../src/middleware/tenant.js';
test('escopo de tenant sobrescreve CompanyId enviado pelo cliente',()=>{const where=tenantScope(17,{id:9,CompanyId:999});assert.deepEqual(where,{id:9,CompanyId:17});});
test('escopo exige empresa autenticada',()=>{assert.throws(()=>tenantScope(null),/CompanyId autenticado/);});
