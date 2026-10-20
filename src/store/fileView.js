import {create} from 'zustand'
export const useFileView=create(set=>({
 tab:'local',file:null,
 setTab:tab=>set({tab}),
 openOnline:file=>set({tab:'online',file})
}))
