// 페이지 스크립트와 assets JS에 해마다 바뀌는 요율 숫자가 직접 박혀 있지 않은지 검사한다.
// 요율은 assets/rates.js 한 곳에만 있어야 한다. 사용: node tools/check-rates.mjs
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const allowed=new Set(['assets/rates.js','assets/withholding-table.js']);
const skipDirs=new Set(['.git','node_modules','tools','.audit-ui']);

// 계산 코드에서만 나타나는 형태로 적는다 (설명 문구의 "4.75%" 같은 표기는 검사하지 않는다)
const patterns=[
  [/(?<![\d.])0?\.0475(?!\d)/,'국민연금 요율'],
  [/(?<![\d.])0?\.03595(?!\d)/,'건강보험 요율'],
  [/(?<![\d.])0?\.1314(?!\d)/,'장기요양 비율'],
  [/(?<![\d.])0?\.0719(?!\d)/,'지역 건강보험 요율'],
  [/(?<!\d)6590000(?!\d)|6\.59e6/,'국민연금 상한'],
  [/(?<![\d,])410000(?!\d)/,'국민연금 하한'],
  [/(?<![\d,])68100(?!\d)/,'실업급여 상한'],
  [/(?<![\d,])10320(?!\d)|(?<![\d,])10700(?!\d)/,'최저임금'],
  [/(?<![\d.])0?\.154(?!\d)/,'이자소득세'],
  [/(?<!\d)(?:94060000|15360000|6240000|1260000|5760000|15440000|19940000)(?!\d)/,'소득세 누진공제액'],
  [/214\.6|307\.3/,'전기요금 단가'],
  [/\*\s*0?\.027(?!\d)/,'전력기금'],
  [/(?<!\d)(?:2200000|1684210|3952000|2470000)(?!\d)|2\.2e6/,'고용·복지 급여 기준액'],
  [/(?<![\d.])0?\.0035(?!\d)|(?<![\d.])0?\.0014(?!\d)/,'재산세 세율'],
  [/deduction\s*[:=?]\s*(?:9|12)e8|\[94e8,/,'종부세 공제·세율']
];

async function walk(dir,rel=''){
  const out=[];
  for(const e of await readdir(dir,{withFileTypes:true})){
    const r=rel?`${rel}/${e.name}`:e.name;
    if(e.isDirectory()){if(!skipDirs.has(e.name))out.push(...await walk(path.join(dir,e.name),r));}
    else if(/\.(html|js)$/.test(e.name))out.push(r);
  }
  return out;
}

const problems=[];
for(const rel of await walk(root)){
  if(allowed.has(rel))continue;
  const text=await readFile(path.join(root,rel),'utf8');
  // HTML은 <script> 안의 코드만, JS는 전체를 본다. 광고·분석 스니펫과 JSON 데이터는 제외한다.
  const chunks=rel.endsWith('.html')
    ?[...text.matchAll(/<script(?![^>]*(?:application\/(?:ld\+)?json|src=))[^>]*>([\s\S]*?)<\/script>/g)].map(m=>({code:m[1],offset:m.index}))
    :[{code:text,offset:0}];
  for(const {code,offset} of chunks){
    const lines=code.split('\n');
    lines.forEach((line,i)=>{
      if(/adsbygoogle|gtag\(|dataLayer/.test(line))return;
      for(const [re,label] of patterns){
        if(re.test(line)){
          const lineNo=text.slice(0,offset).split('\n').length+i;
          problems.push(`${rel}:${lineNo} ${label}: ${line.trim().slice(0,110)}`);
        }
      }
    });
  }
}

if(problems.length){
  console.log(`요율 숫자가 rates.js 밖에 있음 (${problems.length}건):`);
  console.log(problems.join('\n'));
  process.exitCode=1;
}else{
  console.log('OK: 요율 숫자는 assets/rates.js에만 있습니다.');
}
