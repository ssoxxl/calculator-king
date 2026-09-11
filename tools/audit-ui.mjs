// 전체 페이지 화면 점검: 밝은·어두운 테마 × 데스크톱·모바일에서 계산 결과까지 띄운 뒤
// 글자와 배경의 명암 대비, 가로 넘침을 측정한다. 로컬 서버(127.0.0.1:4175)가 켜져 있어야 한다.
// 사용: node tools/audit-ui.mjs [결과 저장 폴더]
// 선택 환경변수: AUDIT_BASE=다른 서버 주소, AUDIT_PAGES=salary,payday (일부 페이지만), AUDIT_SHOTS=all (문제 없는 화면도 캡처)
import {chromium} from 'file:///C:/Users/ddjjk/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import scenarios from './audit-ui-scenarios.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const outDir=process.argv[2]||path.join(root,'.audit-ui');
const base=process.env.AUDIT_BASE||'http://127.0.0.1:4175';
const onlyPages=process.env.AUDIT_PAGES?new Set(process.env.AUDIT_PAGES.split(',').map(s=>s.trim()==='home'?'':s.trim())):null;
const shotAll=process.env.AUDIT_SHOTS==='all';
const skip=new Set(['.git','tools','assets','node_modules','.audit-ui']);

async function walk(dir,rel=''){
  const list=[];
  for(const e of await readdir(dir,{withFileTypes:true})){
    if(!e.isDirectory()||skip.has(e.name))continue;
    const r=rel?`${rel}/${e.name}`:e.name;
    const entries=await readdir(path.join(dir,e.name));
    if(entries.includes('index.html'))list.push(r);
    list.push(...await walk(path.join(dir,e.name),r));
  }
  return list;
}
const pages=['',...await walk(root)].filter(p=>!onlyPages||onlyPages.has(p));
const contexts=[
  {name:'light-desktop',theme:'light',viewport:{width:1280,height:900}},
  {name:'dark-desktop',theme:'dark',viewport:{width:1280,height:900}},
  {name:'light-mobile',theme:'light',viewport:{width:390,height:844}},
  {name:'dark-mobile',theme:'dark',viewport:{width:390,height:844}}
];

await mkdir(outDir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report=[];

async function inspect(pagePath,ctxDef){
  const ctx=await browser.newContext({viewport:ctxDef.viewport,colorScheme:ctxDef.theme,deviceScaleFactor:1});
  const page=await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.dismiss().catch(()=>{}));
  await page.route('**/*',route=>{const u=route.request().url();return /googlesyndication|googletagmanager|doubleclick|google-analytics/.test(u)?route.abort():route.continue();});
  await page.addInitScript(t=>{try{localStorage.setItem('gyesanwang_theme',t);localStorage.setItem('gyesanwang_recent','["salary","dday","taxi-fare"]');}catch(e){}},ctxDef.theme);
  try{
    await page.goto(`${base}/${pagePath?pagePath+'/':''}`,{waitUntil:'domcontentloaded'});
    await page.waitForLoadState('networkidle').catch(()=>{});
    // 빈 입력칸을 채우고 계산 버튼을 눌러 결과 영역까지 띄운다
    await page.evaluate(()=>{
      document.querySelectorAll('input').forEach(input=>{
        if(input.value||input.disabled||input.type==='checkbox'||input.type==='radio')return;
        const label=input.closest('.field')?.querySelector('label')?.textContent||'';
        if(input.type==='date')input.value='2024-03-04';
        else if(input.type==='time')input.value='09:00';
        else input.value=/금리|비율|세율|%/.test(label)?'5':/개월|기간|연수|나이|수량|일수|년|시간|kWh|cm|kg|km|분/.test(label)?'12':'3000000';
      });
    });
    const clickCalc=async()=>{
      const buttons=await page.$$('button.btn, button.btn-calc, form#quickForm button, button[onclick*="calc" i]');
      for(const b of buttons.slice(0,4)){try{if(await b.isVisible())await b.click({timeout:2000});}catch(e){}}
      await page.waitForTimeout(250);
    };
    await clickCalc();
    const measure=()=>page.evaluate(()=>{
      const parse=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(/[ ,/]+/).filter(Boolean).map(Number);return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1};};
      const lum=({r,g,b})=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);};return .2126*f(r)+.7152*f(g)+.0722*f(b);};
      const mix=(top,bottom)=>({r:top.r*top.a+bottom.r*(1-top.a),g:top.g*top.a+bottom.g*(1-top.a),b:top.b*top.a+bottom.b*(1-top.a),a:1});
      // 글자 뒤 배경색 후보들. 그라데이션 배경을 만나면 그 색 정지점 각각을 바닥으로 보고 모두 돌려준다 (가장 나쁜 대비로 판정)
      const bgOf=el=>{
        const layers=[];let node=el,image=false,base=null;
        while(node&&node.nodeType===1){
          const cs=getComputedStyle(node);
          const c=parse(cs.backgroundColor);
          if(cs.backgroundImage&&/gradient\(/.test(cs.backgroundImage)){
            const stops=(cs.backgroundImage.match(/rgba?\([^)]+\)/g)||[]).map(parse).filter(Boolean);
            if(stops.length){image=true;base=stops.map(s=>c&&c.a>0?mix(s,{...c,a:1}):{...s,a:1});break;}
          }
          if(c&&c.a>0){layers.push(c);if(c.a>=1)break;}
          node=node.parentElement;
        }
        if(!base){
          let color={r:255,g:255,b:255,a:1};
          const rootBg=parse(getComputedStyle(document.body).backgroundColor);
          if(!layers.length||layers[layers.length-1].a<1)color=rootBg&&rootBg.a>0?{...rootBg,a:1}:color;
          base=[color];
        }
        return {colors:base.map(b=>{let color=b;for(let i=layers.length-1;i>=0;i--)color=mix(layers[i],color);return color;}),image};
      };
      const issues=[];
      const describe=el=>{let s=el.tagName.toLowerCase();if(el.id)s+='#'+el.id;else if(el.classList.length)s+='.'+[...el.classList].slice(0,2).join('.');const p=el.parentElement;return (p?(p.id?'#'+p.id:p.classList[0]?'.'+p.classList[0]:p.tagName.toLowerCase())+' > ':'')+s;};
      const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      const seen=new Set();
      while(walker.nextNode()){
        const text=walker.currentNode.textContent.trim();
        const el=walker.currentNode.parentElement;
        if(!text||!el||seen.has(el)||/^(SCRIPT|STYLE|NOSCRIPT|OPTION)$/.test(el.tagName))continue;
        // 이모지·기호만 있는 글자는 글꼴 자체 색으로 그려져 CSS 색 대비와 무관하다
        if(/^[\p{Extended_Pictographic}☀-➿️‍\s←→↑↓·•]+$/u.test(text))continue;
        seen.add(el);
        const rect=el.getBoundingClientRect();
        if(rect.width<1||rect.height<1)continue;
        const cs=getComputedStyle(el);
        if(cs.visibility==='hidden'||cs.display==='none')continue;
        let hidden=false,opacity=1;
        for(let n=el;n&&n.nodeType===1;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'){hidden=true;break;}opacity*=Number(s.opacity);}
        if(hidden||opacity<.05)continue;
        if(el.closest('ins.adsbygoogle,svg'))continue;
        const fg=parse(cs.color);if(!fg)continue;
        const {colors,image}=bgOf(el);
        let ratio=Infinity,bg=colors[0];
        for(const c of colors){
          const fgMixed=mix({...fg,a:fg.a*opacity},c);
          const l1=lum(fgMixed),l2=lum(c);
          const r=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
          if(r<ratio){ratio=r;bg=c;}
        }
        const size=parseFloat(cs.fontSize),bold=Number(cs.fontWeight)>=600;
        const large=size>=24||(size>=18.5&&bold);
        const need=large?3:4.5;
        if(ratio<need){
          issues.push({severity:ratio<3?'severe':'low',ratio:Math.round(ratio*100)/100,need,text:text.slice(0,40),el:describe(el),fg:cs.color,bg:`rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,size,gradient:image});
        }
      }
      const overflow=document.documentElement.scrollWidth-innerWidth;
      const wide=[];
      if(overflow>1){document.querySelectorAll('body *').forEach(el=>{const r=el.getBoundingClientRect();if(r.right>innerWidth+1&&r.width>0&&!el.closest('ins.adsbygoogle'))wide.push(describe(el)+` (right ${Math.round(r.right)})`);});}
      return {issues,overflow:Math.max(0,overflow),wide:wide.slice(0,8)};
    });
    // 결과 상태 하나를 측정해 기록한다
    const snap=async state=>{
      await page.waitForTimeout(150);
      const result=await measure();
      const context=state?`${ctxDef.name}/${state}`:ctxDef.name;
      if(shotAll||result.issues.some(i=>i.severity==='severe')||result.overflow>1){
        const file=`${(pagePath||'home').replace(/\//g,'_')}-${context.replace(/[^\w가-힣-]+/g,'_')}.png`;
        await page.screenshot({path:path.join(outDir,file),fullPage:false}).catch(()=>{});
      }
      report.push({page:pagePath||'(home)',context,errors:errors.splice(0),...result});
    };
    await snap('');
    // 결과에 따라 색·화면이 바뀌는 페이지: 시나리오별 분기와, 데스크톱에서 선택지(select)마다 계산한 화면도 측정
    const pageScenarios=scenarios[pagePath];
    if(pageScenarios){
      const fillAndCalc=async()=>{
        await page.evaluate(()=>document.querySelectorAll('input').forEach(i=>{if(!i.value&&!i.disabled&&!['checkbox','radio','date','time'].includes(i.type))i.value='3000000';}));
        await clickCalc();
      };
      const ctl={page,fillAndCalc,
        fill:async values=>{for(const [id,v] of Object.entries(values)){const el=page.locator('#'+id);if(await el.evaluate(e=>e.tagName)==='SELECT')await el.selectOption(String(v));else await el.fill(String(v));await el.dispatchEvent('change');}},
        click:async sel=>page.locator(`${sel} >> visible=true`).first().click({timeout:3000})
      };
      for(const [name,runScenario] of Object.entries(pageScenarios)){
        try{await runScenario(ctl);await snap(name);}
        catch(e){report.push({page:pagePath,context:`${ctxDef.name}/${name}`,errors:[...errors.splice(0),`시나리오 실패: ${e.message.split('\n')[0]}`],issues:[],overflow:0,wide:[]});}
      }
      if(ctxDef.viewport.width>=1000){
        await page.reload({waitUntil:'domcontentloaded'});
        for(const [si,sel] of (await page.$$('select')).entries()){
          if(!await sel.isVisible())continue;
          const original=await sel.inputValue();
          for(const v of await sel.evaluate(s=>[...s.options].map(o=>o.value))){
            if(v===original)continue;
            await sel.selectOption(v);await sel.dispatchEvent('change');
            await fillAndCalc();
            await snap(`선택${si}=${v}`);
          }
          await sel.selectOption(original);await sel.dispatchEvent('change');
        }
      }
    }
  }catch(e){
    report.push({page:pagePath||'(home)',context:ctxDef.name,errors:[...errors,'LOAD: '+e.message],issues:[],overflow:0,wide:[]});
  }
  await ctx.close();
}

const queue=[];
for(const p of pages)for(const c of contexts)queue.push([p,c]);
const workers=Array.from({length:6},async()=>{while(queue.length){const [p,c]=queue.shift();await inspect(p,c);}});
await Promise.all(workers);
await browser.close();

report.sort((a,b)=>(a.page+a.context).localeCompare(b.page+b.context));
await writeFile(path.join(outDir,'report.json'),JSON.stringify(report,null,1),'utf8');
const severe=report.flatMap(r=>r.issues.filter(i=>i.severity==='severe').map(i=>({...i,page:r.page,context:r.context})));
const low=report.flatMap(r=>r.issues.filter(i=>i.severity==='low').map(i=>({...i,page:r.page,context:r.context})));
const overflow=report.filter(r=>r.overflow>1);
const errs=report.filter(r=>r.errors.length);
console.log(`checked ${report.length} screens (${pages.length} pages x ${contexts.length})`);
console.log(`severe contrast (<3:1): ${severe.length} / low contrast (<4.5:1 small text): ${low.length} / horizontal overflow: ${overflow.length} / page errors: ${errs.length}`);
const group=list=>{const m=new Map();for(const i of list){const k=`${i.el} | ${i.fg} on ${i.bg}`;if(!m.has(k))m.set(k,{...i,count:0,pages:new Set()});const g=m.get(k);g.count++;g.pages.add(`${i.page}@${i.context}`);}return [...m.values()].sort((a,b)=>b.count-a.count);};
console.log('\n== SEVERE (grouped) ==');
for(const g of group(severe).slice(0,40))console.log(`${g.count}x ratio ${g.ratio} ${g.el} "${g.text}" ${g.fg} on ${g.bg}${g.gradient?' [gradient]':''} :: ${[...g.pages].slice(0,4).join(', ')}`);
console.log('\n== LOW (grouped, top 25) ==');
for(const g of group(low).slice(0,25))console.log(`${g.count}x ratio ${g.ratio} ${g.el} "${g.text}" ${g.fg} on ${g.bg} :: ${[...g.pages].slice(0,3).join(', ')}`);
console.log('\n== OVERFLOW ==');
for(const r of overflow)console.log(`${r.page}@${r.context} +${r.overflow}px :: ${r.wide.join(' ; ')}`);
console.log('\n== PAGE ERRORS ==');
for(const r of errs)console.log(`${r.page}@${r.context}: ${r.errors.slice(0,2).join(' / ')}`);
