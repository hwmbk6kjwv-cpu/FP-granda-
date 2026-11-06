import fs from 'node:fs';
let h=fs.readFileSync('/home/claude/ajustes/index.html','utf8');
const shim=fs.readFileSync('shim.js','utf8');
const mark='<script src="https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js"></script>';
if(!h.includes(mark))throw new Error('marca não encontrada');
h=h.replace(mark,mark+'\n<script>'+shim+'</script>');
h=h.replace('<title>','<meta name="robots" content="noindex"><title>');
fs.writeFileSync('public/index.html',h);console.log('ok',h.length);
