// 기존 계산기 페이지 공통 동작: 다크모드 전환 버튼과 공유
(function(){
  const key='gyesanwang_theme';
  const read=()=>{try{return localStorage.getItem(key)}catch(e){return null}};
  const save=v=>{try{localStorage.setItem(key,v)}catch(e){}};
  const current=()=>document.documentElement.getAttribute('data-theme')==='dark'?'dark':'light';
  const syncButton=()=>{
    const btn=document.getElementById('darkToggle')||document.getElementById('theme-toggle');
    if(btn)btn.textContent=current()==='dark'?'☀️':'🌙';
  };
  const saved=read()||(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  document.documentElement.setAttribute('data-theme',saved);

  if(typeof window.toggleDark!=='function'){
    window.toggleDark=function(){
      const next=current()==='dark'?'light':'dark';
      document.documentElement.setAttribute('data-theme',next);
      save(next);
      syncButton();
    };
  }
  if(typeof window.shareResult!=='function'){
    window.shareResult=function(text){
      const data={title:document.title,text:typeof text==='string'?text:document.title,url:location.href};
      if(navigator.share){navigator.share(data).catch(()=>{});return;}
      navigator.clipboard?.writeText(location.href).then(()=>alert('링크를 복사했어요.'));
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncButton);
  else syncButton();

  // 최근 본 계산기 (홈 화면에 표시)
  const slug=location.pathname.split('/').filter(Boolean)[0];
  if(slug&&document.querySelector('.calc-card')){
    try{
      const list=JSON.parse(localStorage.getItem('gyesanwang_recent')||'[]').filter(s=>s!==slug);
      localStorage.setItem('gyesanwang_recent',JSON.stringify([slug,...list].slice(0,8)));
    }catch(e){}
  }
})();
