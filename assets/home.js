(function(){
  const $=s=>document.querySelector(s);
  const input=$('#searchInput'),list=$('#suggest'),form=$('#searchForm');
  const data=JSON.parse($('#searchData').textContent);
  const norm=s=>String(s).toLowerCase().replace(/\s+/g,'');
  const esc=s=>String(s).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  const index=data.map(d=>({...d,nn:norm(d.n),nk:norm(d.k),nd:norm(d.d),nc:norm(d.c)}));
  let results=[],active=-1;

  // 모든 검색어가 이름·동의어·설명·카테고리 중 어딘가에 있어야 하고, 이름에 걸릴수록 위로 올린다.
  function score(item,tokens){
    let total=0;
    for(const t of tokens){
      const s=item.nn.startsWith(t)?6:item.nn.includes(t)?5:item.nk.includes(t)?3:item.nd.includes(t)?2:item.nc.includes(t)?1:0;
      if(!s)return 0;
      total+=s;
    }
    return total;
  }
  function search(q){
    const tokens=String(q).toLowerCase().split(/\s+/).map(norm).filter(Boolean);
    if(!tokens.length)return [];
    return index.map(item=>[score(item,tokens),item]).filter(([s])=>s>0)
      .sort((a,b)=>b[0]-a[0]||a[1].n.length-b[1].n.length).slice(0,8).map(([,item])=>item);
  }
  function close(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
  function highlight(){
    list.querySelectorAll('[role=option]').forEach((el,i)=>{el.classList.toggle('active',i===active);el.setAttribute('aria-selected',String(i===active));});
    if(active>=0){input.setAttribute('aria-activedescendant','opt-'+active);list.querySelector('#opt-'+active)?.scrollIntoView({block:'nearest'});}
  }
  function open(q){
    if(!q.trim()){results=[];close();return;}
    results=search(q);active=results.length?0:-1;
    list.innerHTML=results.length
      ?results.map((r,i)=>`<li role="option" id="opt-${i}"><a href="/${r.s}/"><strong>${esc(r.n)}</strong><span>${esc(r.d)}</span><small>${esc(r.c)}</small></a></li>`).join('')
      :`<li class="empty">‘${esc(q.trim())}’에 맞는 계산기를 찾지 못했어요. 다른 단어로 검색해 보세요.</li>`;
    list.hidden=false;input.setAttribute('aria-expanded','true');highlight();
  }
  function go(item,q){
    try{gtag('event','search',{search_term:q});}catch(e){}
    location.href='/'+item.s+'/';
  }

  input.addEventListener('input',()=>open(input.value));
  input.addEventListener('focus',()=>{if(input.value.trim())open(input.value);});
  input.addEventListener('keydown',e=>{
    if(list.hidden||!results.length){if(e.key==='Escape')close();return;}
    if(e.key==='ArrowDown'){e.preventDefault();active=(active+1)%results.length;highlight();}
    else if(e.key==='ArrowUp'){e.preventDefault();active=(active-1+results.length)%results.length;highlight();}
    else if(e.key==='Escape'){close();}
  });
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const q=input.value;
    if(!q.trim()){input.focus();return;}
    if(!results.length||list.hidden)results=search(q);
    const target=results[active>=0&&active<results.length?active:0];
    if(target)go(target,q);else open(q);
  });
  document.addEventListener('click',e=>{if(!form.contains(e.target))close();});
  document.addEventListener('keydown',e=>{
    if(e.key==='/'&&!/input|textarea|select/i.test(document.activeElement.tagName)){e.preventDefault();input.focus();}
  });

  // 월별 추천: 방문 시점의 한국 시간 기준 달로 교체 (빌드한 달과 같으면 그대로 둔다)
  (function(){
    const holder=$('#seasonData'),list=$('#seasonList'),titleEl=$('#seasonTitle');
    if(!holder||!list||!titleEl)return;
    const month=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',month:'numeric'}).format(new Date()));
    const items=JSON.parse(holder.textContent)[month];
    if(!items||titleEl.textContent.startsWith(month+'월'))return;
    titleEl.textContent=`${month}월에 많이 찾는 계산`;
    list.innerHTML=items.map(i=>`<li><a href="/${i.s}/" data-cat="${i.c}"><strong>${esc(i.n)}</strong><span>${esc(i.note)}</span></a></li>`).join('');
  })();

  // 최근 본 계산기
  (function(){
    const box=$('#recent');
    if(!box)return;
    let slugs=[];
    try{slugs=JSON.parse(localStorage.getItem('gyesanwang_recent')||'[]');}catch(e){}
    const bySlug=Object.fromEntries(data.map(d=>[d.s,d]));
    const items=slugs.map(s=>bySlug[s]).filter(Boolean).slice(0,6);
    if(!items.length)return;
    box.querySelector('.recent-links').innerHTML=items.map(i=>`<a href="/${i.s}/">${esc(i.n.replace(/ 계산기$/,''))}</a>`).join('');
    box.hidden=false;
  })();

  // 카테고리 목록 더 보기
  document.querySelectorAll('.dir-more').forEach(btn=>btn.addEventListener('click',()=>{
    const open=btn.closest('.dir').classList.toggle('open');
    btn.textContent=open?'접기':btn.dataset.label;
    btn.setAttribute('aria-expanded',String(open));
  }));

  // 연봉 실수령액 빠른 계산 (연봉 실수령액 계산기와 같은 방식: 비과세 20만원, 간이세액표)
  (function(){
    const form=$('#quickForm');
    if(!form)return;
    const salaryInput=$('#quickSalary'),family=$('#quickFamily'),out=$('#quickOut');
    const won=n=>Math.round(n).toLocaleString('ko-KR');
    let tablePromise=null;
    const loadTable=()=>tablePromise||(tablePromise=new Promise((resolve,reject)=>{
      if(window.WITHHOLDING_TABLE){resolve();return;}
      const script=document.createElement('script');
      script.src='/assets/withholding-table.js';script.onload=resolve;script.onerror=reject;
      document.head.appendChild(script);
    }));
    salaryInput.addEventListener('input',()=>{const d=salaryInput.value.replace(/[^0-9]/g,'');salaryInput.value=d?Number(d).toLocaleString('ko-KR'):'';});
    salaryInput.addEventListener('focus',()=>{loadTable().catch(()=>{});},{once:true});
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const annual=Number(salaryInput.value.replace(/,/g,''));
      if(!annual){salaryInput.focus();return;}
      try{await loadTable();}catch(err){out.textContent='세액표를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';out.hidden=false;return;}
      const R=window.KR_RATES,monthly=Math.floor(annual/12),taxable=Math.max(0,monthly-R.nontaxMeal);
      const insurance=R.insurance(taxable).total;
      const tax=R.withholding(taxable,Number(family.value)).income,local=R.floor10(tax*R.localIncomeTaxRatio);
      const net=monthly-insurance-tax-local;
      out.innerHTML=`<strong>${won(net)}원</strong><span>월 예상 실수령액 · 4대보험 ${won(insurance)}원 · 세금 ${won(tax+local)}원</span>`;
      out.hidden=false;
      try{gtag('event','quick_salary_calc');}catch(err){}
    });
  })();

  $('#themeBtn').addEventListener('click',()=>{
    const next=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
    document.documentElement.setAttribute('data-theme',next);
    try{localStorage.setItem('gyesanwang_theme',next);}catch(e){}
  });
  $('#shareBtn').addEventListener('click',()=>{
    const share={title:document.title,url:location.href};
    if(navigator.share){navigator.share(share).catch(()=>{});return;}
    navigator.clipboard?.writeText(location.href).then(()=>alert('링크를 복사했어요.'));
  });
})();
