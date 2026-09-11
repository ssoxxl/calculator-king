// 홈 화면(index.html)과 sitemap.xml을 site-catalog.mjs 기준으로 다시 만든다.
// 사용: node tools/build-home.mjs
// 주의: head의 광고·GA·Google Ads 스니펫은 원래 모양 그대로 유지한다.
import {readFile,writeFile,readdir,access} from 'node:fs/promises';
import {execSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SITE,categories,calculators,popular,seasons} from './site-catalog.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const bySlug=Object.fromEntries(calculators.map(c=>[c.slug,c]));
const catById=Object.fromEntries(categories.map(c=>[c.id,c]));
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
const buildMonth=Number(today.slice(5,7));
const VISIBLE=6; // 카테고리마다 처음 보이는 계산기 수 (나머지는 '더 보기')

for(const c of calculators){
  await access(path.join(root,c.slug,'index.html')).catch(()=>{throw new Error(`계산기 페이지 없음: ${c.slug}`)});
  if(!catById[c.cat])throw new Error(`알 수 없는 카테고리: ${c.slug}`);
}
for(let m=1;m<=12;m++){
  if(!seasons[m]?.length)throw new Error(`${m}월 추천 목록이 비어 있음`);
}
for(const slug of [...popular,...Object.values(seasons).flat().map(([s])=>s)]){
  if(!bySlug[slug])throw new Error(`카탈로그에 없는 추천 항목: ${slug}`);
}

const guideDirs=(await readdir(path.join(root,'guides'),{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name).sort();
const guides=[];
for(const slug of guideDirs){
  const html=await readFile(path.join(root,'guides',slug,'index.html'),'utf8');
  const h1=(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)||[])[1]||slug;
  guides.push({slug,title:h1.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim()});
}

const icon=(d,size=20)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const logoMark='<svg class="mark" viewBox="0 0 40 40" width="30" height="30" aria-hidden="true"><rect width="40" height="40" rx="11" fill="currentColor"/><path d="M9 29V14l6.5 5L20 10l4.5 9L31 14v15z" fill="#fff"/><path d="M15 21.5h10M15 25.5h10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
const count=id=>calculators.filter(c=>c.cat===id).length;

const catTiles=categories.map(c=>`<a class="cat" href="#cat-${c.id}" data-cat="${c.id}"><span class="cat-icon">${icon(c.icon)}</span><span class="cat-text"><strong>${c.name}</strong><span>${c.blurb}</span></span><span class="cat-count">${count(c.id)}</span></a>`).join('');

// 빌드한 달의 목록을 정적으로 넣고, 방문 시점의 달이 다르면 home.js가 교체한다.
const seasonItem=([slug,note])=>{
  const c=bySlug[slug];
  return `<li><a href="/${slug}/" data-cat="${c.cat}"><strong>${esc(c.name)}</strong><span>${esc(note)}</span></a></li>`;
};
const seasonList=seasons[buildMonth].map(seasonItem).join('');
const seasonData=JSON.stringify(Object.fromEntries(Object.entries(seasons).map(([m,items])=>[m,items.map(([s,note])=>({s,n:bySlug[s].name,c:bySlug[s].cat,note}))]))).replace(/</g,'\\u003c');

const popularChips=popular.map(slug=>`<a href="/${slug}/">${esc(bySlug[slug].name.replace(/ 계산기$/,''))}</a>`).join('');

const directory=categories.map(c=>{
  const list=calculators.filter(x=>x.cat===c.id);
  const items=list.map(x=>`<li><a href="/${x.slug}/"><strong>${esc(x.name)}</strong><span>${esc(x.desc)}</span></a></li>`).join('');
  const hidden=list.length-VISIBLE;
  const more=hidden>0?`<button class="dir-more" type="button" aria-expanded="false" data-label="${hidden}개 더 보기">${hidden}개 더 보기</button>`:'';
  return `<section class="dir" id="cat-${c.id}" data-cat="${c.id}"><div class="dir-head"><span class="cat-icon">${icon(c.icon)}</span><h2>${c.name}</h2><span class="dir-count">${list.length}개</span></div><ul class="dir-list">${items}</ul>${more}</section>`;
}).join('');

const guideList=guides.map(g=>`<li><a href="/guides/${g.slug}/">${esc(g.title)}</a></li>`).join('');

const searchIndex=JSON.stringify(calculators.map(c=>({s:c.slug,n:c.name,d:c.desc,k:c.keywords,c:catById[c.cat].name}))).replace(/</g,'\\u003c');

const itemList=JSON.stringify({'@context':'https://schema.org','@type':'CollectionPage',name:'계산왕 생활 계산기 모음',url:`${SITE}/`,description:'급여·세금·금융·부동산·생활 계산기를 최신 기준으로 제공하는 무료 온라인 계산기 모음',mainEntity:{'@type':'ItemList',numberOfItems:calculators.length,itemListElement:calculators.map((c,i)=>({'@type':'ListItem',position:i+1,url:`${SITE}/${c.slug}/`,name:c.name}))}});

const adUnit=`<div class="ad"><span class="ad-label">광고</span><ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8390635644947402" data-ad-slot="8039990741" data-ad-format="auto" data-full-width-responsive="true"></ins><script>(adsbygoogle=window.adsbygoogle||[]).push({});</script></div>`;

const title='계산왕 - 생활 계산기 모음 | 연봉·세금·대출·부동산·날짜';
const description=`연봉 실수령액, 퇴직금, 근로장려금, 재산세, 날짜 계산, 단위 변환까지 생활에 필요한 ${calculators.length}개 계산기를 계산식과 기준 출처와 함께 무료로 이용하세요.`;

const html=`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18414856958"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'AW-18414856958');
</script>
  <!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-5E3YW37RYV"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-5E3YW37RYV');
</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8390635644947402" crossorigin="anonymous"></script>
<title>${title}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="계산왕">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}/">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/og-image.png">
<meta name="naver-site-verification" content="b8bcb92536a0eaad009c04f27e2c16e5e3169812">
<meta name="daumoa-verification" content="52638bd43577858cdf80a388c3bf173be6b9be4914b8bde1a3b347cf6786f5b4:Xj5dg0WfAX454QfLeg8nBA==">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<script>(function(){var t;try{t=localStorage.getItem('gyesanwang_theme')}catch(e){}t=t||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t)})();</script>
<link rel="stylesheet" href="/assets/home.css">
<script type="application/ld+json">${itemList}</script>
</head>
<body>
<header class="top">
  <div class="bar">
    <a class="brand" href="/" aria-label="계산왕 홈">${logoMark}<span class="brand-name">계산왕</span></a>
    <nav class="nav" aria-label="카테고리">${categories.map(c=>`<a href="#cat-${c.id}">${c.name}</a>`).join('')}</nav>
    <button class="icon-btn" id="themeBtn" type="button" aria-label="화면 테마 전환"><span class="theme-sun">${icon('M12 4V2M12 22v-2M4 12H2M22 12h-2M5 5 3.6 3.6M20.4 20.4 19 19M5 19l-1.4 1.4M20.4 3.6 19 5M12 16a4 4 0 100-8 4 4 0 000 8z',18)}</span><span class="theme-moon">${icon('M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',18)}</span></button>
  </div>
</header>

<main>
  <section class="hero">
    <div class="hero-main">
      <p class="eyebrow">생활 계산기 ${calculators.length}개 · 계산식과 출처 공개</p>
      <h1>생활에 필요한 계산을<br>한곳에서 바로</h1>
      <p class="lead">월급과 세금부터 대출, 집, 날짜와 건강까지. 필요한 계산을 검색 한 번으로 찾고, 계산식과 기준 출처를 함께 확인하세요.</p>
      <form class="search" id="searchForm" role="search" autocomplete="off">
        <span class="search-icon">${icon('M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',20)}</span>
        <input id="searchInput" type="search" placeholder="어떤 계산이 필요하세요? 예: 퇴직금, 재산세, 만나이" aria-label="계산기 검색" aria-controls="suggest" aria-expanded="false" role="combobox" aria-autocomplete="list">
        <button type="submit">검색</button>
        <ul class="suggest" id="suggest" role="listbox" hidden></ul>
      </form>
      <div class="chips"><span>자주 찾는 계산</span>${popularChips}</div>
      <div class="chips recent" id="recent" hidden><span>최근 본 계산</span><div class="recent-links"></div></div>
    </div>

    <aside class="quick" aria-labelledby="quickTitle">
      <p class="quick-eyebrow">바로 계산</p>
      <h2 id="quickTitle">내 연봉, 한 달에 얼마 받을까?</h2>
      <form class="quick-form" id="quickForm" autocomplete="off">
        <label for="quickSalary">연봉 (세전)</label>
        <div class="quick-input"><input id="quickSalary" inputmode="numeric" placeholder="예: 45,000,000"><span>원</span></div>
        <label for="quickFamily">공제대상가족 (본인 포함)</label>
        <select id="quickFamily"><option value="1">1명</option><option value="2">2명</option><option value="3">3명</option><option value="4">4명</option><option value="5">5명</option></select>
        <button type="submit">월 실수령액 보기</button>
      </form>
      <div class="quick-out" id="quickOut" aria-live="polite" hidden></div>
      <a class="quick-more" href="/salary/">4대보험·세금 내역 자세히 보기 →</a>
      <p class="quick-note">비과세 식대 월 20만원, 2026년 4대보험 요율, 국세청 간이세액표 기준</p>
    </aside>
  </section>

  <section class="cats" aria-label="카테고리별 계산기">${catTiles}</section>

  <section class="season">
    <div class="section-head"><h2 id="seasonTitle">${buildMonth}월에 많이 찾는 계산</h2></div>
    <ul class="season-list" id="seasonList">${seasonList}</ul>
  </section>

  ${adUnit}

  <section class="directory" aria-label="전체 계산기">
    <div class="section-head"><h2>전체 계산기</h2><p>카테고리별로 모든 계산기를 모았어요.</p></div>
    ${directory}
  </section>

  <section class="guides">
    <div class="section-head"><h2>계산 전에 읽어보면 좋은 가이드</h2><a class="more" href="/guides/">가이드 전체 보기</a></div>
    <ul class="guide-list">${guideList}</ul>
  </section>

  <section class="trust">
    <h2>계산 기준을 공개합니다</h2>
    <p>계산왕의 모든 계산기는 법령과 관계기관 고시를 기준으로 만들고, 페이지마다 계산식·예외·출처를 함께 적습니다. 요율이 바뀌면 업데이트 기록에 남깁니다.</p>
    <div class="trust-links"><a href="/editorial-policy/">편집 원칙</a><a href="/sources/">참고 출처</a><a href="/updates/">업데이트 기록</a></div>
  </section>

  ${adUnit}
</main>

<footer class="foot">
  <div class="foot-inner">
    <p><strong>계산왕</strong> · 생활에 필요한 모든 계산</p>
    <p>계산 결과는 참고용이며 실제 금액과 다를 수 있어요. 중요한 결정 전에는 관계기관이나 전문가에게 확인하세요.</p>
    <nav class="foot-links"><a href="/about/">소개</a><a href="/contact/">문의</a><a href="/privacy/">개인정보처리방침</a><a href="/editorial-policy/">편집 원칙</a><a href="/sources/">출처</a><a href="/updates/">업데이트</a><button type="button" id="shareBtn">공유하기</button></nav>
  </div>
</footer>

<script type="application/json" id="searchData">${searchIndex}</script>
<script type="application/json" id="seasonData">${seasonData}</script>
<script src="/assets/rates.js"></script>
<script src="/assets/home.js"></script>
</body>
</html>
`;
await writeFile(path.join(root,'index.html'),html,'utf8');

// sitemap: 변경된 파일은 오늘 날짜, 나머지는 마지막 커밋 날짜
const dirty=new Set(execSync('git status --porcelain -uall',{cwd:root,encoding:'utf8'}).split('\n').filter(Boolean).map(l=>l.slice(3).trim()));
const lastmod=file=>{
  if(dirty.has(file))return today;
  const d=execSync(`git log -1 --format=%cs -- "${file}"`,{cwd:root,encoding:'utf8'}).trim();
  return d||today;
};
const urls=[
  ['','index.html','weekly','1.0'],
  ...calculators.map(c=>[`${c.slug}/`,`${c.slug}/index.html`,'monthly',popular.includes(c.slug)?'0.9':'0.8']),
  ['guides/','guides/index.html','weekly','0.8'],
  ...guides.map(g=>[`guides/${g.slug}/`,`guides/${g.slug}/index.html`,'monthly','0.7']),
  ['about/','about/index.html','yearly','0.4'],
  ['contact/','contact/index.html','yearly','0.4'],
  ['editorial-policy/','editorial-policy/index.html','yearly','0.5'],
  ['sources/','sources/index.html','monthly','0.5'],
  ['updates/','updates/index.html','weekly','0.5'],
  ['privacy/','privacy/index.html','yearly','0.3']
];
const sitemap=`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([loc,file,freq,pri])=>`  <url><loc>${SITE}/${loc}</loc><lastmod>${lastmod(file)}</lastmod><changefreq>${freq}</changefreq><priority>${pri}</priority></url>`).join('\n')}
</urlset>
`;
await writeFile(path.join(root,'sitemap.xml'),sitemap,'utf8');
console.log(`home: ${calculators.length} calculators, ${guides.length} guides, build month ${buildMonth} / sitemap: ${urls.length} urls`);
