import {build} from 'esbuild'
await build({stdin:{contents:"export {parseBehavior,validateFileName} from './src/utils/onlineBehaviors.js'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:'server/generated/behavior-validation.cjs',define:{'import.meta.env':'{}'},logLevel:'warning'})
