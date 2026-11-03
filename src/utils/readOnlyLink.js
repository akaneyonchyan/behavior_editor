import {validateFileName} from './onlineBehaviors'

export function readOnlyLink(name,href=location.href){
 validateFileName(name)
 const url=new URL(href)
 url.search='';url.hash=''
 url.searchParams.set('view','readonly')
 url.searchParams.set('file',name)
 return url.href
}
