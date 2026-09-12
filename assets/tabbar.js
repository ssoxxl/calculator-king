// 모바일 하단 탭바. 홈·전체 계산기·검색·최근 본 계산·가이드로 바로 이동한다.
// 페이지마다 CSS가 달라서 색은 각 페이지의 변수를 먼저 쓰고, 없으면 기본값으로 되돌린다.
(function(){
  if(window.__gyesanwangTabbar)return;
  window.__gyesanwangTabbar=true;

  const icons={
    home:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    list:'<path d="M4 6h16M4 12h16M4 18h10"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    book:'<path d="M12 6v14M3 4c3.5 0 5.5 0 9 2 3.5-2 5.5-2 9-2v14c-3.5 0-5.5 0-9 2-3.5-2-5.5-2-9-2Z"/>'
  };
  const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

  const path=location.pathname.replace(/index\.html$/,'');
  const isHome=path==='/'||path==='';
  const items=[
    {id:'home',label:'홈',icon:'home',href:'/'},
    {id:'all',label:'계산기',icon:'list',href:'/#calculators'},
    {id:'search',label:'검색',icon:'search',href:isHome?'#search':'/?focus=search'},
    {id:'recent',label:'최근',icon:'clock',href:'/#recent'},
    {id:'guides',label:'가이드',icon:'book',href:'/guides/'}
  ];
  const active=isHome?'home':path.startsWith('/guides/')?'guides':'';

  const style=document.createElement('style');
  style.textContent=`
.gw-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:60;display:none;
  background:color-mix(in srgb, var(--surface, #fff) 92%, transparent);
  border-top:1px solid var(--border, var(--line, #e4e7ec));
  backdrop-filter:saturate(1.4) blur(10px);
  padding:6px 4px max(6px, env(safe-area-inset-bottom))}
.gw-tabbar a{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
  min-height:46px;padding:4px 2px;border-radius:10px;text-decoration:none;font-size:11.5px;font-weight:600;
  color:var(--muted, var(--sub, #5c6370));-webkit-tap-highlight-color:transparent}
.gw-tabbar a svg{width:21px;height:21px}
.gw-tabbar a.on{color:var(--accent, var(--brand, #1f4fd1))}
.gw-recent-empty{font-size:13px;color:var(--muted, var(--sub, #5c6370))}
.gw-tabbar a:active{background:color-mix(in srgb, var(--accent, var(--brand, #1f4fd1)) 10%, transparent)}
@media(max-width:760px){
  .gw-tabbar{display:flex}
  body{padding-bottom:calc(62px + env(safe-area-inset-bottom))}
}`;
  document.head.appendChild(style);

  const nav=document.createElement('nav');
  nav.className='gw-tabbar';
  nav.setAttribute('aria-label','모바일 빠른 메뉴');
  nav.innerHTML=items.map(i=>`<a href="${i.href}" data-tab="${i.id}" class="${i.id===active?'on':''}" ${i.id===active?'aria-current="page"':''}>${svg(i.icon)}<span>${i.label}</span></a>`).join('');
  document.body.appendChild(nav);

  // 홈에서는 검색창으로 바로 커서를 옮긴다
  const focusSearch=()=>{
    const input=document.getElementById('searchInput');
    if(!input)return false;
    input.scrollIntoView({block:'center',behavior:'smooth'});
    setTimeout(()=>input.focus({preventScroll:true}),250);
    return true;
  };
  nav.querySelector('[data-tab="search"]').addEventListener('click',e=>{
    if(focusSearch())e.preventDefault();
  });
  if(new URLSearchParams(location.search).get('focus')==='search')focusSearch();

  // 최근 본 계산이 없으면 영역이 숨겨져 있어 눌러도 아무 일이 없어 보인다. 빈 상태 안내를 띄운다
  const showRecent=()=>{
    const box=document.getElementById('recent');
    if(!box)return false;
    const links=box.querySelector('.recent-links');
    if(links&&!links.children.length)links.innerHTML='<span class="gw-recent-empty">아직 최근 본 계산기가 없어요. 계산기를 열어보면 여기에 모여요.</span>';
    box.hidden=false;
    box.scrollIntoView({block:'center',behavior:'smooth'});
    return true;
  };
  nav.querySelector('[data-tab="recent"]').addEventListener('click',e=>{
    if(showRecent())e.preventDefault();
  });
  if(location.hash==='#recent')showRecent();
})();
