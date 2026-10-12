import fs from 'node:fs';
fs.mkdirSync('dist/vendor',{recursive:true});
for(const name of ['three.module.js','three.core.js'])fs.copyFileSync(`node_modules/three/build/${name}`,`dist/vendor/${name}`);
const controls=fs.readFileSync('node_modules/three/examples/jsm/controls/OrbitControls.js','utf8').replace(/from 'three'/g,"from './three.module.js'");
fs.writeFileSync('dist/vendor/OrbitControls.js',controls);
const additions=[['loaders/GLTFLoader.js','GLTFLoader.js'],['utils/BufferGeometryUtils.js','BufferGeometryUtils.js'],['utils/SkeletonUtils.js','SkeletonUtils.js'],['environments/RoomEnvironment.js','RoomEnvironment.js']];
for(const [source,target] of additions){const code=fs.readFileSync(`node_modules/three/examples/jsm/${source}`,'utf8').replace(/from 'three'/g,"from './three.module.js'").replace(/from '\.\.\/utils\/([^']+)'/g,"from './$1'");fs.writeFileSync(`dist/vendor/${target}`,code);}
