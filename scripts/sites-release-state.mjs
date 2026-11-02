import {createHash} from 'node:crypto'
export function libraryDigest(snapshot){return createHash('sha256').update(JSON.stringify(snapshot.library)).digest('hex')}
export function releaseKey(commit,libraryHash){return commit+':'+libraryHash}
export function needsRelease(state,current){return state.failedKey!==current.key&&(state.commit!==current.commit||state.libraryHash!==current.libraryHash)}
