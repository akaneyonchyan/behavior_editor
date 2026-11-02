export const authMode=import.meta.env?.VITE_AUTH_MODE==='feishu'
let generation=0
export function expireAuth(){generation++;window.dispatchEvent(new Event('pps-auth-expired'))}
export async function protectedFetch(url,options){
 const started=generation,response=await fetch(url,options)
 if(authMode&&(response.status===401||response.status===403)){expireAuth();throw Error('登录已过期或权限已撤销，请重新登录')}
 if(authMode&&started!==generation)throw Error('会话已变化，已取消旧请求')
 return response
}
export function authGeneration(){return generation}
