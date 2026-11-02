const {defineConfig}=require('@playwright/test')
module.exports=defineConfig({testDir:'./tests',testMatch:'sites-live.spec.cjs',timeout:60000,workers:1,use:{baseURL:'http://127.0.0.1:5199',channel:'msedge'},webServer:{command:'npm run preview -- --host 127.0.0.1 --port 5199 --strictPort',url:'http://127.0.0.1:5199',reuseExistingServer:false}})
