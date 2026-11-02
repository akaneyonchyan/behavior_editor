import assert from 'node:assert/strict'
import {libraryDigest,releaseKey,needsRelease} from '../scripts/sites-release-state.mjs'
const one={library:{version:1,objects:[]},syncedAt:'2026-10-26T00:00:00Z'}
const hash=libraryDigest(one),current={commit:'a',libraryHash:hash,key:releaseKey('a',hash)}
assert.equal(hash,libraryDigest({...one,syncedAt:'2026-10-26T01:00:00Z'}))
assert.equal(needsRelease(current,current),false)
assert.equal(needsRelease({},current),true)
assert.equal(needsRelease({...current,commit:'b'},current),true)
assert.equal(needsRelease({...current,libraryHash:'changed'},current),true)
assert.equal(needsRelease({failedKey:current.key},current),false)
assert.equal(needsRelease({failedKey:'old'},current),true)
assert.notEqual(hash,libraryDigest({library:{version:1,objects:[{id:'new'}]}}))
console.log('PASS: independent code/library changes, unchanged content skips, failed version suppression')
