import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetAlert, capacityWarning, commission, money, overlaps, packagePrice } from '../src/domain';
test('commission conserves captured money, rounding down the platform share',()=>{assert.deepEqual(commission(10001,1000),{grossMinor:10001,commissionMinor:1000,netMinor:9001});assert.throws(()=>commission(500,10001));});
test('money rejects fractional, negative and unsafe values',()=>{for(const n of [-1,1.2,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>money(n));assert.equal(money(0),0);});
test('touching reservations are permitted while partial overlaps are not',()=>{const d=(h:number)=>new Date(2027,1,14,h);assert.equal(overlaps(d(10),d(12),d(12),d(14)),false);assert.equal(overlaps(d(10),d(12),d(11),d(14)),true);assert.equal(overlaps(d(10),d(12),d(9),d(13)),true);});
test('budget warns only above the planned threshold',()=>{assert.equal(budgetAlert(100,100),false);assert.equal(budgetAlert(100,101),true);assert.equal(budgetAlert(100,109,1.1),false);});
test('RSVP totals account for companions',()=>{assert.equal(capacityWarning([2,2,1],4),true);assert.equal(capacityWarning([2,2],4),false);});
test('package discounts snapshot integer totals',()=>{assert.equal(packagePrice([10000,20000],800),27600);assert.throws(()=>packagePrice([100],10001));});
