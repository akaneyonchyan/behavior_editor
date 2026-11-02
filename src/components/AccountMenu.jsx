import React,{useContext} from 'react'
import {AccountContext} from './AuthBoundary'
import './AccountMenu.css'
export default function AccountMenu(){
 const account=useContext(AccountContext)
 if(!account)return null
 return <div className="account-menu" aria-label="账号"><span className="account-name" title={account.session.user.displayName}>{account.session.user.displayName}</span><button className="toolbar-btn" onClick={account.logout}>退出飞书登录</button></div>
}
