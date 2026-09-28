import assert from 'node:assert/strict';
import {timedCache,plainReviewText} from '../src/lib/rift/review-cache.ts';
let now=0;const cache=timedCache(120000,2,()=>now);
cache.set('a',{id:1});assert.equal(cache.get('a').id,1);assert.equal(cache.get('different'),undefined);
now=119999;assert.equal(cache.get('a').id,1);now=120000;assert.equal(cache.get('a'),undefined);
cache.set('a',1);cache.set('b',2);cache.set('c',3);assert.equal(cache.get('a'),undefined);assert.equal(cache.get('b'),2);
assert.equal(plainReviewText('C1: exitPremiumPct 0%, referenceMovePct 2%.'),'the scenario calculation: exit premium 0%, reference move 2%.');
assert.equal(plainReviewText('ABC1 20 USDT'),'ABC1 20 USDT');
console.log('PASS Cache expiration, input separation, capacity and plain wording');
