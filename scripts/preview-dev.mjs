import {execFileSync,spawn} from 'node:child_process'
try{
 execFileSync(process.execPath,['scripts/reuse-public-library.mjs'],{stdio:'inherit'})
 execFileSync(process.execPath,['scripts/export-behaviors.mjs'],{stdio:'inherit'})
 if(!process.argv.includes('--prepare-only')){const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5193','--strictPort','--open','/?view=preview'],{stdio:'inherit',env:{...process.env,VITE_LIBRARY_MODE:'published'}});child.on('exit',code=>process.exit(code||0))}
}catch(e){console.error('准备失败：'+e.message+'。请设置 LIBRARY_SNAPSHOT_FILE 为私有公共库快照，再运行 npm run dev:preview。');process.exitCode=1}
