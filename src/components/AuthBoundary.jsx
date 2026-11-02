import React,{createContext,useEffect,useState} from 'react'
import {authMode,expireAuth} from '../utils/authSession'
import {useContentLibrary} from '../store/contentLibrary'
import {useFileView} from '../store/fileView'
export const AccountContext=createContext(null)
export default function AuthBoundary({children}){
 const [session,setSession]=useState(null),[message,setMessage]=useState('正在检查登录…')
 useEffect(()=>{
  if(!authMode)return
  let stopped=false,serial=0
  const expired=()=>{serial++;setSession(null);setMessage('登录已过期或权限已撤销。本地草稿保留，请重新登录。');useFileView.setState({tab:'local',file:null,selected:null});useContentLibrary.setState({library:{version:1,objects:[],attributes:[],buffs:[]},publishedReady:false,syncedAt:null});localStorage.removeItem('pps-published-library-v1')}
  const check=async()=>{const current=++serial;try{const response=await fetch('/api/auth/session',{cache:'no-store'});if(stopped||current!==serial)return;if(!response.ok){expireAuth();return}const value=await response.json();if(!stopped&&current===serial)setSession(value)}catch{if(!stopped&&current===serial){expireAuth();setMessage('暂时无法验证登录，请检查网络后重试。')}}}
  const visible=()=>{if(document.visibilityState==='visible')check()}
  const storage=e=>{if(e.key==='pps-auth-logout')expireAuth()}
  window.addEventListener('storage',storage)
  window.addEventListener('pps-auth-expired',expired);document.addEventListener('visibilitychange',visible);window.addEventListener('focus',check)
  check();const timer=setInterval(check,30000)
  return()=>{stopped=true;clearInterval(timer);window.removeEventListener('storage',storage);window.removeEventListener('pps-auth-expired',expired);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',check)}
 },[])
 if(!authMode)return children
 if(!session)return <div style={{padding:40}}><h2>行为编辑器 · 飞书登录</h2><p>{message}</p><a href="/auth/feishu/start" target="_blank" rel="noreferrer">在新窗口登录，完成后返回此页</a></div>
 const logout=async()=>{try{const response=await fetch('/api/auth/logout',{method:'POST',headers:{'X-CSRF-Token':session.csrfToken}});if(!response.ok)throw Error();expireAuth();localStorage.setItem('pps-auth-logout',String(Date.now()))}catch{setMessage('退出未完成，请重试');alert('退出未完成，请检查网络后重试')}}
 return <AccountContext.Provider value={{session,logout}}>{children}</AccountContext.Provider>
}
