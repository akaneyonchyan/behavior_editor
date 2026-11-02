import {DatabaseSync} from 'node:sqlite'
if(!process.env.AUTH_DB_PATH)throw Error('AUTH_DB_PATH required')
const db=new DatabaseSync(process.env.AUTH_DB_PATH,{readOnly:true})
console.log(JSON.stringify({companyConfirmation:db.prepare('SELECT tenant,member,created FROM identity_requests ORDER BY created DESC').all(),memberConfirmation:db.prepare('SELECT member,created FROM pending ORDER BY created DESC').all()},null,2))
db.close()
