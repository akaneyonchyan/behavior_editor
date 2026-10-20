import {create} from 'zustand'
export const useFileView=create(set=>({
 tab:'local',file:null,selected:null,
 selectOnline:selected=>set({selected}),
 setTab:tab=>set({tab}),
 openOnline:file=>set({tab:'online',file,selected:null})
}))
