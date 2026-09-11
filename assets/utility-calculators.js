const $=id=>document.getElementById(id);
const value=id=>Number(String($(id)?.value||0).replaceAll(',',''));
const positive=id=>Math.max(0,value(id));
const won=n=>Math.round(n).toLocaleString('ko-KR')+'원';
const number=(n,d=0)=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:d});

function render(main,items){
  $('result-main').textContent=main;
  $('result-details').innerHTML=items.map(([label,result])=>`<div class="row"><span>${label}</span><strong>${result}</strong></div>`).join('');
  $('result').classList.add('show');
  $('result').scrollIntoView({behavior:'smooth',block:'nearest'});
}

function requirePositive(items){
  if(items.some(id=>positive(id)<=0)){
    alert('0보다 큰 값을 입력해 주세요.');
    return false;
  }
  return true;
}

const calculators={
  'hourly-wage':()=>{
    if(!requirePositive(['monthly','monthlyHours']))return;
    const monthly=positive('monthly'),hours=positive('monthlyHours'),hourly=monthly/hours;
    render(won(hourly),[['월 통상임금',won(monthly)],['월 기준시간',number(hours,1)+'시간'],['1일 8시간 환산',won(hourly*8)],['주 40시간 환산',won(hourly*40)]]);
  },
  'weekly-holiday-pay':()=>{
    if(!requirePositive(['hourly','dailyHours','days']))return;
    const hourly=positive('hourly'),weekly=positive('dailyHours')*positive('days');
    const eligible=weekly>=15,paidHours=eligible?Math.min(8,weekly/40*8):0,allowance=hourly*paidHours;
    render(eligible?won(allowance):'지급 요건 미충족',[['1주 소정근로시간',number(weekly,1)+'시간'],['예상 유급 주휴시간',number(paidHours,2)+'시간'],['주휴수당',won(allowance)],['4주 단순 환산',won(allowance*4)]]);
  },
  'overtime-pay':()=>{
    if(!requirePositive(['hourly']))return;
    const hourly=positive('hourly'),ot=positive('overtime'),night=positive('night'),holiday=positive('holiday'),holidayOver=positive('holidayOver');
    const otPay=hourly*ot*1.5,nightPremium=hourly*night*.5,holidayPay=hourly*holiday*1.5,holidayOverPay=hourly*holidayOver*2;
    render(won(otPay+nightPremium+holidayPay+holidayOverPay),[['연장근로 임금(1.5배)',won(otPay)],['야간근로 추가분(0.5배)',won(nightPremium)],['휴일 8시간 이내(1.5배)',won(holidayPay)],['휴일 8시간 초과(2배)',won(holidayOverPay)]]);
  },
  'annual-leave-pay':()=>{
    if(!requirePositive(['hourly','dailyHours','unusedDays']))return;
    const hourly=positive('hourly'),hours=positive('dailyHours'),days=positive('unusedDays'),daily=hourly*hours;
    render(won(daily*days),[['통상시급',won(hourly)],['1일 소정근로시간',number(hours,1)+'시간'],['1일 통상임금',won(daily)],['미사용 연차',number(days,1)+'일']]);
  },
  'compound-interest':()=>{
    if(!requirePositive(['years']))return;
    const principal=positive('principal'),monthly=positive('monthly'),rate=positive('rate')/1200,months=Math.round(positive('years')*12);
    const principalFuture=principal*Math.pow(1+rate,months),monthlyFuture=rate?monthly*(Math.pow(1+rate,months)-1)/rate:monthly*months,total=principalFuture+monthlyFuture,paid=principal+monthly*months;
    render(won(total),[['총 납입원금',won(paid)],['예상 이자',won(total-paid)],['적용 기간',months+'개월'],['월 복리 수익률',number(rate*100,4)+'%']]);
  },
  'simple-interest':()=>{
    if(!requirePositive(['principal','years']))return;
    const principal=positive('principal'),rate=positive('rate')/100,years=positive('years'),tax=Math.min(100,positive('tax'))/100,gross=principal*rate*years,net=gross*(1-tax);
    render(won(principal+net),[['세전 이자',won(gross)],['이자 과세 입력값',number(tax*100,2)+'%'],['예상 세금',won(gross-net)],['세후 이자',won(net)]]);
  },
  'roi':()=>{
    if(!requirePositive(['investment']))return;
    const investment=positive('investment'),final=positive('final'),income=positive('income'),cost=positive('cost'),profit=final+income-investment-cost,roi=profit/investment*100;
    render(number(roi,2)+'%',[['초기 투자금',won(investment)],['회수액·평가액',won(final)],['추가 수익',won(income)],['비용 차감 후 순손익',won(profit)]]);
  },
  'cagr':()=>{
    if(!requirePositive(['start','end','years']))return;
    const start=positive('start'),end=positive('end'),years=positive('years'),cagr=(Math.pow(end/start,1/years)-1)*100;
    render(number(cagr,2)+'%',[['초기값',number(start,2)],['최종값',number(end,2)],['기간',number(years,1)+'년'],['전체 증감률',number((end/start-1)*100,2)+'%']]);
  },
  'savings-goal':()=>{
    if(!requirePositive(['target']))return;
    const current=positive('current'),target=positive('target'),monthly=positive('monthly'),rate=positive('rate')/1200;
    if(current>=target){render('이미 목표를 달성했어요',[['현재 금액',won(current)],['목표 금액',won(target)],['초과 금액',won(current-target)]]);return;}
    if(monthly===0&&rate===0){alert('월 저축액이나 예상 수익률을 입력해 주세요.');return;}
    let balance=current,months=0;
    while(balance<target&&months<1200){balance=balance*(1+rate)+monthly;months++;}
    if(months===1200&&balance<target){render('100년 안에 도달하기 어려워요',[['100년 뒤 예상액',won(balance)],['목표 금액',won(target)]]);return;}
    render(`${Math.floor(months/12)}년 ${months%12}개월`,[['목표 금액',won(target)],['예상 도달 금액',won(balance)],['추가 납입원금',won(monthly*months)],['예상 운용수익',won(balance-current-monthly*months)]]);
  },
  'loan-prepayment-fee':()=>{
    if(!requirePositive(['repayment']))return;
    const repayment=positive('repayment'),rate=positive('feeRate')/100,elapsed=positive('elapsed'),exempt=Math.max(1,positive('exempt')),ratio=Math.max(0,(exempt-elapsed)/exempt),fee=repayment*rate*ratio;
    render(won(fee),[['중도상환 원금',won(repayment)],['약정 수수료율',number(rate*100,3)+'%'],['잔존기간 비율',number(ratio*100,2)+'%'],['수수료 포함 필요액',won(repayment+fee)]]);
  },
  'stock-profit':()=>{
    if(!requirePositive(['buy','sell','quantity']))return;
    const buy=positive('buy'),sell=positive('sell'),qty=positive('quantity'),buyFee=positive('buyFee')/100,sellFee=positive('sellFee')/100,tax=positive('tax')/100;
    const buyAmount=buy*qty,sellAmount=sell*qty,cost=buyAmount*buyFee+sellAmount*(sellFee+tax),profit=sellAmount-buyAmount-cost;
    render(won(profit),[['매수금액',won(buyAmount)],['매도금액',won(sellAmount)],['입력 수수료·세금',won(cost)],['투자수익률',number(profit/buyAmount*100,2)+'%']]);
  },
  'discount':()=>{
    if(!requirePositive(['price']))return;
    const price=positive('price'),first=Math.min(100,positive('first'))/100,second=Math.min(100,positive('second'))/100,final=price*(1-first)*(1-second);
    render(won(final),[['원래 가격',won(price)],['1차 할인',number(first*100,2)+'%'],['추가 할인',number(second*100,2)+'%'],['총 할인액',won(price-final)],['실제 할인율',number((1-final/price)*100,2)+'%']]);
  },
  'percentage':()=>{
    if(!requirePositive(['base']))return;
    const base=positive('base'),compare=value('compare'),rate=value('rate');
    render(number(compare/base*100,2)+'%',[['기준값의 입력 비율만큼',number(base*rate/100,2)],['비교값은 기준값의',number(compare/base*100,2)+'%'],['두 값의 차이',number(compare-base,2)],['기준값 대비 증감률',number((compare-base)/base*100,2)+'%']]);
  },
  'unit-price':()=>{
    if(!requirePositive(['price','quantity','comparePrice','compareQuantity']))return;
    const a=positive('price')/positive('quantity'),b=positive('comparePrice')/positive('compareQuantity'),saving=Math.abs(a-b),winner=a===b?'단가가 같아요':a<b?'A 상품이 더 저렴해요':'B 상품이 더 저렴해요';
    render(winner,[['A 상품 단가',number(a,2)+'원'],['B 상품 단가',number(b,2)+'원'],['단위당 차이',number(saving,2)+'원'],['A 대비 B 단가 차이',number((b/a-1)*100,2)+'%']]);
  },
  'fuel-cost':()=>{
    if(!requirePositive(['distance','efficiency','fuelPrice']))return;
    const distance=positive('distance'),efficiency=positive('efficiency'),fuelPrice=positive('fuelPrice'),trips=Math.max(1,positive('trips')),liters=distance*trips/efficiency,cost=liters*fuelPrice;
    render(won(cost),[['총 주행거리',number(distance*trips,1)+'km'],['예상 연료 사용량',number(liters,2)+'L'],['입력 연비',number(efficiency,1)+'km/L'],['1회 운행 비용',won(cost/trips)]]);
  },
  'margin':()=>{
    if(!requirePositive(['sale']))return;
    const sale=positive('sale'),cost=positive('cost'),fee=positive('fee')/100,shipping=positive('shipping'),profit=sale-cost-sale*fee-shipping;
    render(number(profit/sale*100,2)+'%',[['판매가',won(sale)],['상품 원가',won(cost)],['판매 수수료',won(sale*fee)],['배송·기타 비용',won(shipping)],['개당 순이익',won(profit)]]);
  },
  'break-even':()=>{
    if(!requirePositive(['sale']))return;
    const fixed=positive('fixed'),sale=positive('sale'),variable=positive('variable'),target=positive('target'),contribution=sale-variable;
    if(contribution<=0){render('판매할수록 손실이 커져요',[['개당 판매가',won(sale)],['개당 변동비',won(variable)],['개당 공헌이익',won(contribution)]]);return;}
    const units=Math.ceil((fixed+target)/contribution);
    render(number(units)+'개',[['고정비',won(fixed)],['개당 공헌이익',won(contribution)],['목표이익',won(target)],['필요 매출액',won(units*sale)]]);
  }
};

window.runCalc=()=>{
  const key=document.body.dataset.calc;
  (calculators[key]||window.EXTRA_CALCULATORS?.[key])?.();
};
window.toggleTheme=()=>{
  const next=document.documentElement.dataset.theme==='dark'?'light':'dark';
  document.documentElement.dataset.theme=next;
  localStorage.setItem('gyesanwang_theme',next);
  $('theme-toggle').textContent=next==='dark'?'☀️':'🌙';
};

(function(){
  const saved=localStorage.getItem('gyesanwang_theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
  document.documentElement.dataset.theme=saved;
  document.addEventListener('DOMContentLoaded',()=>{$('theme-toggle').textContent=saved==='dark'?'☀️':'🌙'});
})();

(function(){
  const moneyWords=/원|금액|급여|월급|가격|비용|원금|투자금|매출|매입|납입|고정비|변동비|목표|현재|평가액|회수액/;
  const excludedWords=/비율|금리|세율|수수료율|개월|기간|시간|일수|수량|거리|연비|횟수/;
  document.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('input').forEach(input=>{
    const label=input.closest('.field')?.querySelector('label')?.textContent||'';
    if(!moneyWords.test(label)||excludedWords.test(label))return;
    input.type='text';input.inputMode='numeric';
    const format=()=>{const digits=input.value.replace(/[^0-9.-]/g,'');input.value=digits&&Number.isFinite(Number(digits))?Number(digits).toLocaleString('ko-KR'):digits};
    format();input.addEventListener('input',format);input.addEventListener('focus',()=>input.select());
  }));
})();

// 최근 본 계산기 (홈 화면에 표시)
(function(){
  const slug=document.body.dataset.calc;
  if(!slug)return;
  try{
    const list=JSON.parse(localStorage.getItem('gyesanwang_recent')||'[]').filter(s=>s!==slug);
    localStorage.setItem('gyesanwang_recent',JSON.stringify([slug,...list].slice(0,8)));
  }catch(e){}
})();
