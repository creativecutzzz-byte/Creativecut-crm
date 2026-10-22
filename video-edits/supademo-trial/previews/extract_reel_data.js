const s=require('fs').readFileSync(process.argv[2],'utf8');
const grab=n=>{const i=s.indexOf('var '+n+' = ');let d=0,j=s.indexOf('=',i)+1,st=j;for(;j<s.length;j++){const c=s[j];if(c=='['||c=='{')d++;if(c==']'||c=='}'){d--;if(d==0){j++;break;}}}return s.slice(st,j);};
const CFG=eval('('+grab('CFG')+')');
const out={CFG,SEGMENTS:eval(grab('SEGMENTS')),FACE:eval(grab('FACE')),HOOK:eval('('+grab('HOOK')+')'),CHUNKS:eval(grab('CHUNKS')),CARDS:eval(grab('CARDS'))};
console.log(JSON.stringify(out));
