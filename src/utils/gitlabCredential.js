// Non-extractable device key + AES-GCM ciphertext in IndexedDB. No plaintext
// token in localStorage, sessionStorage, URLs, behavior JSON or exports.
const DATABASE='pps-gitlab-credentials-v1'
async function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DATABASE,1);request.onupgradeneeded=()=>request.result.createObjectStore('credentials');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('浏览器无法打开本地凭据库'))})}
async function transaction(mode,action){
 const db=await database()
 try{return await new Promise((resolve,reject)=>{const tx=db.transaction('credentials',mode);let result;const request=action(tx.objectStore('credentials'));request.onsuccess=()=>{result=request.result};tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(new Error('本地凭据操作失败，请检查浏览器存储权限'))})}finally{db.close()}
}
export async function saveGitLabCredential(owner,token){
 const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']),iv=crypto.getRandomValues(new Uint8Array(12))
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(owner)},key,new TextEncoder().encode(token))
 await transaction('readwrite',store=>store.put({key,iv,cipher},owner))
}
export async function readGitLabCredential(owner){
 const value=await transaction('readonly',store=>store.get(owner));if(!value)return null
 try{return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:value.iv,additionalData:new TextEncoder().encode(owner)},value.key,value.cipher))}catch{throw new Error('本地凭据无法解密，请清除后重新输入 Token')}
}
export async function forgetGitLabCredential(owner){await transaction('readwrite',store=>store.delete(owner))}
