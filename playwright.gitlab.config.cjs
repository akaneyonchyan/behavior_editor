const {defineConfig}=require('@playwright/test')
module.exports=defineConfig({
 metadata:{gitlab:true},
 testDir:'./tests',testMatch:process.env.SNAPSHOT_BROWSER_TEST?'snapshot-files.spec.cjs':'gitlab-files.spec.cjs',timeout:60000,workers:1,
 use:{baseURL:'http://127.0.0.1:5196',viewport:{width:1440,height:1000},channel:process.env.PW_CHANNEL||undefined},
 webServer:{command:'npm run dev -- --host 127.0.0.1 --port 5196 --strictPort',url:'http://127.0.0.1:5196',reuseExistingServer:false,env:{VITE_LIBRARY_MODE:'published',VITE_ONLINE_PROVIDER:process.env.SNAPSHOT_BROWSER_TEST?'gitlab-snapshot':'gitlab'},timeout:30000}
})
