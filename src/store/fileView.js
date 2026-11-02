import {create} from 'zustand'
export const useFileView=create((set,get)=>({
 tab:'local',file:null,selected:null,onlineAccess:{canEdit:false,message:'请先验证个人 GitLab Token'},editRequest:0,
 setOnlineAccess:onlineAccess=>set({onlineAccess}),
 collaborating:false,onlineControls:null,
 setOnlineControls:onlineControls=>set({onlineControls}),
 setCollaborating:collaborating=>{if(!collaborating&&get().onlineControls?.canLeave?.()===false)return false;set({collaborating,...(!collaborating?{onlineControls:null}:{})});return true},
 requestOnlineEdit:()=>set(state=>({editRequest:state.editRequest+1})),
 selectOnline:selected=>set({selected}),
 setTab:tab=>{if(tab!==get().tab&&get().collaborating){if(get().onlineControls?.canLeave?.()===false)return false;set({collaborating:false,onlineControls:null})}set({tab});return true},
 openOnline:file=>{if(get().collaborating&&get().onlineControls?.canLeave?.()===false)return false;set({tab:'online',file,selected:null,collaborating:false,onlineControls:null});return true}
}))
