const fs=require('fs');const defs={};
global.window=global;global.document={createElement:()=>({getContext:()=>({})})};
global.SC={sprite:{define:(n,f,c,o)=>{defs[n]={f,c}},get:()=>({}),has:()=>true},ctx:{},PAL:{}};
eval(fs.readFileSync(process.argv[2],'utf8'));
const d=defs['cat_ginger'];const fr=SC.art.CAT.frames;
fs.writeFileSync(process.argv[3],JSON.stringify({rows:d.f[fr.idle[0]],fly:d.f[fr.fly[0]],colors:d.c,pal:SC.PAL}));
console.log('frames',d.f.length,'size',d.f[0][0].length,'x',d.f[0].length);
