// 2026년 9월 추가·이전된 계산기. utility-calculators.js의 $, value, positive, won, number, render를 함께 사용한다.
const PAY2026={
  pensionRate:.0475,pensionMin:410000,pensionMax:6590000, // 2026.7~2027.6 기준소득월액 하한·상한
  healthRate:.03595,ltcRatio:.1314,employRate:.009,
  unemployMax:68100,unemployMin:10320*8*.8,
  minWage:{2026:10320,2027:10700}
};
// 부동소수점 오차(예: 3,000,000 × 0.009 = 26999.999…)로 10원이 깎이지 않도록 먼저 소수 셋째 자리에서 반올림한다.
const floor10=n=>Math.floor(Math.round(n*1000)/1000/10)*10;
const selected=id=>$(id)?.value;

function insuranceOf(monthly){
  if(monthly<=0)return {pension:0,health:0,ltc:0,employ:0,total:0,base:0};
  const base=Math.min(Math.max(Math.floor(monthly/1000)*1000,PAY2026.pensionMin),PAY2026.pensionMax);
  const pension=floor10(base*PAY2026.pensionRate);
  const health=floor10(monthly*PAY2026.healthRate);
  const ltc=floor10(health*PAY2026.ltcRatio);
  const employ=floor10(monthly*PAY2026.employRate);
  return {pension,health,ltc,employ,total:pension+health+ltc+employ,base};
}

// 국세청 근로소득 간이세액표(withholding-table.js) 조회. monthly는 비과세 제외 월급여.
function withholdingOf(monthly,family=1,children=0,ratio=100){
  const table=window.WITHHOLDING_TABLE;
  if(!table)throw new Error('간이세액표 데이터가 없습니다.');
  const fam=Math.min(Math.max(Math.round(family),1),11);
  const k=monthly/1000;
  let tax=0;
  if(k>=770&&k<10000){
    const row=table.rows.find(r=>k>=r[0]&&k<r[1]);
    tax=row?row[1+fam]:0;
  }else if(k>=10000){
    const base=table.top[fam-1];
    if(monthly<=10000000)tax=base;
    else if(monthly<=14000000)tax=base+(monthly-10000000)*.98*.35+25000;
    else if(monthly<=28000000)tax=base+1397000+(monthly-14000000)*.98*.38;
    else if(monthly<=30000000)tax=base+6610600+(monthly-28000000)*.98*.40;
    else if(monthly<=45000000)tax=base+7394600+(monthly-30000000)*.40;
    else if(monthly<=87000000)tax=base+13394600+(monthly-45000000)*.42;
    else tax=base+31034600+(monthly-87000000)*.45;
  }
  const kids=Math.max(0,Math.round(children));
  const childCut=kids===0?0:kids===1?12500:kids===2?29160:29160+(kids-2)*25000;
  const income=floor10(Math.max(0,tax-childCut)*ratio/100);
  return {income,local:floor10(income*.1),tableTax:tax,childCut};
}

function netMonthly(gross,nontax,family,children){
  const taxable=Math.max(0,gross-nontax);
  const ins=insuranceOf(taxable),tax=withholdingOf(taxable,family,children);
  return {taxable,ins,tax,net:gross-ins.total-tax.income-tax.local};
}

function progressiveTax(b){
  if(b<=14e6)return b*.06;
  if(b<=50e6)return b*.15-1.26e6;
  if(b<=88e6)return b*.24-5.76e6;
  if(b<=150e6)return b*.35-15.44e6;
  if(b<=300e6)return b*.38-19.94e6;
  if(b<=500e6)return b*.40-25.94e6;
  if(b<=1e9)return b*.42-35.94e6;
  return b*.45-65.94e6;
}

function retirementTax(gross,serviceYears){
  const years=Math.max(1,Math.ceil(serviceYears));
  const service=years<=5?years*1e6:years<=10?5e6+(years-5)*2e6:years<=20?15e6+(years-10)*2.5e6:40e6+(years-20)*3e6;
  const converted=Math.max(0,gross-service)*12/years;
  const convertedDeduction=converted<=8e6?converted:converted<=70e6?8e6+(converted-8e6)*.6:converted<=100e6?45.2e6+(converted-70e6)*.55:converted<=300e6?61.7e6+(converted-100e6)*.45:151.7e6+(converted-300e6)*.35;
  const base=Math.max(0,converted-convertedDeduction);
  const tax=floor10(Math.max(0,progressiveTax(base))*years/12);
  return {years,service,converted,base,tax,local:floor10(tax*.1)};
}

function annuity(principal,ratePct,years){
  const r=ratePct/1200,n=years*12;
  return r?principal*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1):principal/n;
}

const dayMs=86400000;
const parseDate=id=>{const v=$(id)?.value;if(!v)return null;const [y,m,d]=v.split('-').map(Number);return new Date(y,m-1,d);};

window.EXTRA_CALCULATORS={
  'withholding-tax':()=>{
    if(!requirePositive(['monthly']))return;
    const gross=positive('monthly'),nontax=Math.min(positive('nontax'),gross),family=+selected('family'),children=+selected('children'),ratio=+selected('ratio');
    if(children>family-1){alert('자녀 수는 본인을 뺀 공제대상가족 수보다 많을 수 없어요.');return;}
    const taxable=gross-nontax,tax=withholdingOf(taxable,family,children,ratio);
    render(won(tax.income+tax.local)+' / 월',[
      ['과세 대상 월급여 (비과세 제외)',won(taxable)],
      ['간이세액표 세액',won(tax.tableTax)],
      ['8~20세 자녀 차감',tax.childCut?'-'+won(tax.childCut):'없음'],
      [`근로소득세 (${ratio}%)`,won(tax.income)],
      ['지방소득세 (10%)',won(tax.local)],
      ['연간 원천징수 예상',won((tax.income+tax.local)*12)]
    ]);
  },
  'four-insurance':()=>{
    if(!requirePositive(['wage']))return;
    const wage=positive('wage'),stability=+selected('size'),accident=positive('accident')/100;
    const w=insuranceOf(wage);
    const employerEmploy=floor10(wage*(PAY2026.employRate+stability)),employerAccident=floor10(wage*accident);
    const employerTotal=w.pension+w.health+w.ltc+employerEmploy+employerAccident;
    render(won(w.total)+' / 월',[
      ['국민연금 (각 4.75%)',`근로자 ${won(w.pension)} · 사업주 ${won(w.pension)}`],
      ['건강보험 (각 3.595%)',`근로자 ${won(w.health)} · 사업주 ${won(w.health)}`],
      ['장기요양 (건강보험료의 13.14%)',`근로자 ${won(w.ltc)} · 사업주 ${won(w.ltc)}`],
      ['고용보험',`근로자 ${won(w.employ)} · 사업주 ${won(employerEmploy)}`],
      ['산재보험 (사업주만)',won(employerAccident)],
      ['사업주 부담 합계',won(employerTotal)],
      ['회사 기준 월 인건비',won(wage+employerTotal)],
      ['국민연금 기준소득월액',won(w.base)]
    ]);
  },
  'minimum-wage':()=>{
    if(!requirePositive(['weekly']))return;
    const year=selected('year'),hourly=PAY2026.minWage[year],weekly=Math.min(positive('weekly'),52);
    const holiday=weekly>=15?Math.min(8,weekly/40*8):0,monthlyHours=Math.round((weekly+holiday)*365/7/12);
    const monthly=hourly*monthlyHours,mine=positive('mine');
    const net=netMonthly(monthly,0,1,0);
    const rows=[
      [`${year}년 최저시급`,won(hourly)],
      ['주휴시간 포함 월 환산시간',monthlyHours+'시간'],
      ['주휴수당 포함 월급',won(monthly)],
      ['연봉 환산',won(monthly*12)],
      ['1인 가구 기준 예상 실수령액',won(net.net)],
      ['수습 3개월 감액 시 (90%)',won(monthly*.9)]
    ];
    if(mine>0)rows.push(['입력한 시급과의 차이',mine>=hourly?`기준보다 ${won(mine-hourly)} 높아요`:`기준보다 ${won(hourly-mine)} 낮아요`]);
    render(won(monthly)+' / 월',rows);
  },
  'job-offer':()=>{
    if(!requirePositive(['current','offer']))return;
    const nontax=positive('nontax'),family=+selected('family');
    const now=netMonthly((positive('current')+positive('currentBonus'))/12,nontax,family,0);
    const next=netMonthly((positive('offer')+positive('offerBonus'))/12,nontax,family,0);
    const grossNow=positive('current')+positive('currentBonus'),grossNext=positive('offer')+positive('offerBonus');
    const diff=next.net-now.net;
    render((diff>=0?'월 +':'월 ')+won(diff),[
      ['현재 연 총보상',won(grossNow)],
      ['제안 연 총보상',won(grossNext)],
      ['세전 인상률',number((grossNext/grossNow-1)*100,1)+'%'],
      ['현재 월 실수령액',won(now.net)],
      ['제안 월 실수령액',won(next.net)],
      ['실수령 인상률',number((next.net/now.net-1)*100,1)+'%'],
      ['연간 실수령 차이',won(diff*12)]
    ]);
  },
  'eitc':()=>{
    const type=selected('household'),income=positive('income'),kids=+selected('kids'),assets=positive('assets');
    const plans={single:[4e6,9e6,22e6,1.65e6],one:[7e6,14e6,32e6,2.85e6],dual:[8e6,17e6,44e6,3.3e6]};
    const effective=type==='single'&&kids>0?'one':type;
    const [rise,flat,cap,max]=plans[effective];
    let work=income<rise?income*max/rise:income<=flat?max:income<cap?max-(income-flat)*max/(cap-flat):0;
    let child=0;
    if(effective!=='single'&&kids>0&&income<7e7){
      const start=effective==='one'?21e6:25e6,span=effective==='one'?49e6:45e6;
      const per=income<start?1e6:Math.max(5e5,1e6-(income-start)*5e5/span);
      child=per*kids;
    }
    const assetRate=assets>=2.4e8?0:assets>=1.7e8?.5:1;
    work*=assetRate;child*=assetRate;
    const label={single:'단독가구',one:'홑벌이가구',dual:'맞벌이가구'}[effective];
    render(won(work+child),[
      ['적용 가구 유형',label+(effective!==type?' (자녀가 있어 홑벌이로 계산)':'')],
      ['근로장려금',won(work)],
      ['자녀장려금',won(child)+(kids?` (${kids}명)`:'')],
      ['재산 요건',assetRate===1?'1억 7천만원 미만 · 전액':assetRate===.5?'1억 7천만원 이상 · 50% 감액':'2억 4천만원 이상 · 지급 제외'],
      ['근로장려금 소득 상한',won(cap)+' 미만']
    ]);
  },
  'maternity-leave':()=>{
    if(!requirePositive(['wage']))return;
    const kind=selected('kind'),wage=positive('wage'),priority=selected('company')==='priority';
    if(kind==='spouse'){
      const daily=wage/209*8,total=daily*20,gov=priority?Math.min(total,1684210):0;
      render(won(total),[['휴가 일수','20일 (근로일 기준)'],['1일 통상임금',won(daily)],['고용보험 지급',won(gov)],['회사 지급',won(total-gov)],['정부 지원 대상',priority?'우선지원대상기업':'대규모기업은 회사가 전액 지급']]);
      return;
    }
    const multiple=kind==='multiple',totalDays=multiple?120:90,paidDays=multiple?75:60,capMonth=2200000;
    const govMonths=priority?totalDays/30:(totalDays-paidDays)/30,capped=Math.min(wage,capMonth);
    const gov=capped*govMonths,total=wage*paidDays/30+capped*(totalDays-paidDays)/30,company=total-gov;
    render(won(total),[
      ['휴가 기간',`${totalDays}일 (최초 ${paidDays}일은 통상임금 100%)`],
      ['고용보험 월 상한',won(capMonth)+' (30일 기준)'],
      ['고용보험 지급 합계',won(gov)],
      ['회사 지급 합계',won(company)],
      ['마지막 '+(totalDays-paidDays)+'일 수령액',won(capped*(totalDays-paidDays)/30)],
      ['통상임금 대비 감소액',won(wage*totalDays/30-total)]
    ]);
  },
  'resignation-settlement':()=>{
    const start=parseDate('start'),end=parseDate('end');
    if(!start||!end||end<=start){alert('입사일과 퇴직일을 올바르게 입력해 주세요.');return;}
    if(!requirePositive(['wage']))return;
    const wage=positive('wage'),bonus=positive('bonus'),unused=positive('unused'),age=positive('age'),involuntary=selected('reason')==='involuntary';
    const days=Math.round((end-start)/dayMs),threeMonthsAgo=new Date(end.getFullYear(),end.getMonth()-3,end.getDate());
    const periodDays=Math.round((end-threeMonthsAgo)/dayMs);
    const avgDaily=(wage*3+bonus*3/12)/periodDays,ordinaryDaily=wage/209*8,daily=Math.max(avgDaily,ordinaryDaily);
    const severance=days>=365?daily*30*days/365:0;
    const tax=severance?retirementTax(severance,days/365):{tax:0,local:0};
    const leavePay=unused*ordinaryDaily;
    const insuredYears=days/365,senior=age>=50;
    const benefitDays=insuredYears<1?120:insuredYears<3?(senior?180:150):insuredYears<5?(senior?210:180):insuredYears<10?(senior?240:210):(senior?270:240);
    const benefitDaily=Math.min(Math.max(avgDaily*.6,PAY2026.unemployMin),PAY2026.unemployMax);
    const eligible=involuntary&&days>=180;
    const benefit=eligible?benefitDaily*benefitDays:0;
    const netSeverance=severance-tax.tax-tax.local;
    render(won(netSeverance+leavePay+benefit),[
      ['재직기간',`${Math.floor(days/365)}년 ${Math.floor(days%365/30)}개월 (${number(days)}일)`],
      ['퇴직금 산정 1일 임금',won(daily)+(daily===ordinaryDaily?' (통상임금 적용)':' (평균임금)')],
      ['퇴직금 (세전)',severance?won(severance):'1년 미만이라 없음'],
      ['퇴직소득세·지방소득세','-'+won(tax.tax+tax.local)],
      ['미사용 연차수당 (세전)',won(leavePay)],
      ['실업급여 1일액',eligible?won(benefitDaily):'-'],
      ['소정급여일수',eligible?benefitDays+'일':'-'],
      ['실업급여 총액',eligible?won(benefit):(involuntary?'고용보험 180일 미만':'자발적 퇴사는 원칙적으로 제외')]
    ]);
  },
  'home-acquisition-tax':()=>{
    if(!requirePositive(['price']))return;
    const price=positive('price'),houses=+selected('houses'),regulated=selected('regulated')==='yes',large=selected('large')==='yes',first=selected('first')==='yes';
    let rate,heavy=false;
    if(houses>=4||(houses===3&&regulated)){rate=.12;heavy=true;}
    else if(houses===3||(houses===2&&regulated)){rate=.08;heavy=true;}
    else rate=price<=6e8?.01:price<=9e8?(price*2/3e8-3)/100:.03;
    let acquisition=price*rate;
    const eduTax=heavy?price*.004:acquisition*.1;
    const ruralTax=large?price*(heavy?rate-.02:.02)*.1:0;
    const firstRelief=first&&houses===1&&price<=12e8?Math.min(acquisition,2e6):0;
    acquisition-=firstRelief;
    render(won(acquisition+eduTax+ruralTax),[
      ['적용 취득세율',number(rate*100,2)+'%'+(heavy?' (중과)':'')],
      ['취득세',won(acquisition)],
      ['생애최초 감면',firstRelief?'-'+won(firstRelief):'해당 없음'],
      ['지방교육세',won(eduTax)],
      ['농어촌특별세',large?won(ruralTax):'전용 85㎡ 이하 비과세'],
      ['취득가 대비 세금 비율',number((acquisition+eduTax+ruralTax)/price*100,2)+'%']
    ]);
  },
  'property-tax':()=>{
    if(!requirePositive(['price']))return;
    const price=positive('price'),oneHouse=selected('oneHouse')==='yes',urban=selected('urban')==='yes';
    const ratio=oneHouse?(price<=3e8?.43:price<=6e8?.44:.45):.6;
    const base=Math.floor(price*ratio/1000)*1000;
    const special=oneHouse&&price<=9e8;
    const tax=special
      ?(base<=6e7?base*.0005:base<=1.5e8?30000+(base-6e7)*.001:base<=3e8?120000+(base-1.5e8)*.002:420000+(base-3e8)*.0035)
      :(base<=6e7?base*.001:base<=1.5e8?60000+(base-6e7)*.0015:base<=3e8?195000+(base-1.5e8)*.0025:570000+(base-3e8)*.004);
    const urbanTax=urban?base*.0014:0,edu=tax*.2,total=tax+urbanTax+edu;
    const split=tax>200000;
    render(won(total)+' / 년',[
      ['공정시장가액비율',(ratio*100)+'%'],
      ['과세표준',won(base)],
      ['재산세'+(special?' (1주택 특례세율)':''),won(tax)],
      ['도시지역분 (0.14%)',urban?won(urbanTax):'제외'],
      ['지방교육세 (재산세의 20%)',won(edu)],
      ['7월 납부',won(split?total/2:total)],
      ['9월 납부',won(split?total/2:0)]
    ]);
  },
  'pyeong':()=>{
    if(!requirePositive(['area']))return;
    const area=positive('area'),dir=selected('unit'),perPyeong=400/121;
    const pyeong=dir==='m2'?area/perPyeong:area,m2=dir==='m2'?area:area*perPyeong;
    render(dir==='m2'?number(pyeong,2)+'평':number(m2,2)+'㎡',[
      ['제곱미터',number(m2,2)+'㎡'],
      ['평',number(pyeong,2)+'평'],
      ['1평',number(perPyeong,4)+'㎡'],
      ['참고: 전용 59㎡',number(59/perPyeong,1)+'평'],
      ['참고: 전용 84㎡',number(84/perPyeong,1)+'평']
    ]);
  },

  'irp-tax-credit':()=>{
    const income=positive('income'),saving=positive('saving'),irp=positive('irp'),kind=selected('kind');
    const rate=(kind==='salary'?income<=55e6:income<=45e6)?.15:.12;
    const eligible=Math.min(Math.min(saving,6e6)+irp,9e6),national=eligible*rate,local=national*.1;
    render(won(national+local),[['세액공제 대상 납입액',won(eligible)],['적용 공제율',number(rate*100)+'% (지방소득세 별도)'],['소득세 공제 예상액',won(national)],['지방소득세 포함 절세액',won(national+local)],['900만원 한도까지 남은 금액',won(Math.max(0,9e6-eligible))]]);
  },
  'national-pension-early':()=>{
    if(!requirePositive(['normal']))return;
    const normal=positive('normal'),age=positive('normalAge')||65,months=Math.min(60,Math.max(1,Math.round(positive('months'))));
    const early=normal*(1-months*.005),bep=early*months/(normal-early);
    render(number(age+bep/12,1)+'세 무렵',[['정상수령 월 연금',won(normal)],['조기수령 월 연금',won(early)],['평생 감액률',number(months*.5,1)+'%'],['조기수령 시작 나이',number(age-months/12,1)+'세'],['정상수령 전 먼저 받는 금액',won(early*months)],['정상수령 개시 후 역전까지',Math.ceil(bep)+'개월']]);
  },
  'retirement-takehome':()=>{
    if(!requirePositive(['gross','years']))return;
    const gross=positive('gross'),t=retirementTax(gross,positive('years'));
    render(won(gross-t.tax-t.local),[['퇴직급여',won(gross)],['근속연수 (1년 미만 절상)',t.years+'년'],['근속연수공제',won(t.service)],['환산급여',won(t.converted)],['퇴직소득세',won(t.tax)],['지방소득세',won(t.local)]]);
  },
  'basic-pension':()=>{
    const couple=selected('household')==='couple',income=positive('income'),assets=positive('assets'),debt=positive('debt'),deduct=positive('deduct');
    const converted=Math.max(0,assets-debt-deduct)*.04/12,recognized=income+converted,limit=couple?3952000:2470000;
    render(recognized<=limit?'선정기준 이내':'선정기준 초과',[['월 소득평가액',won(income)],['재산의 월 소득환산액',won(converted)],['예상 소득인정액',won(recognized)],['2026년 선정기준액',won(limit)],['기준과의 차이',won(Math.abs(limit-recognized))]]);
  },
  'car-tax-prepay':()=>{
    if(!requirePositive(['annual']))return;
    const annual=positive('annual'),month=+selected('month'),remain=Math.max(0,12-month),discount=annual*remain/12*.05;
    render(won(annual-discount),[['자동차세 연세액',won(annual)],['공제 대상 기간',remain+'개월'],['실질 할인율',number(remain/12*5,2)+'%'],['예상 공제액',won(discount)]]);
  },
  'health-refund':()=>{
    const paid=positive('paid'),cap=positive('cap'),excluded=positive('excluded'),eligible=Math.max(0,paid-excluded);
    if(!cap){alert('공단에서 확인한 개인별 상한액을 입력해 주세요.');return;}
    render(won(Math.max(0,eligible-cap)),[['연간 본인부담금',won(paid)],['제외 금액',won(excluded)],['상한제 대상 금액',won(eligible)],['개인별 상한액',won(cap)]]);
  },
  'rent-tax-credit':()=>{
    const salary=positive('salary'),rent=positive('rent'),ok=selected('eligible')==='yes';
    const rate=salary<=55e6?.17:.15,base=ok&&salary<=8e7?Math.min(rent,1e7):0;
    render(won(base*rate),[['연간 월세액',won(rent)],['공제 대상 월세액',won(base)],['적용 공제율',base?number(rate*100)+'%':'대상 아님'],['월 평균 절세 효과',won(base*rate/12)]]);
  },
  'mortgage-dsr':()=>{
    if(!requirePositive(['income','loan','years']))return;
    const income=positive('income'),existing=positive('existing'),loan=positive('loan'),rate=positive('rate')+positive('stress'),years=positive('years'),limit=positive('limit')||40;
    const yearly=annuity(loan,rate,years)*12,dsr=(existing+yearly)/income*100,room=income*limit/100-existing;
    render(number(dsr,1)+'%',[['적용금리 (스트레스 포함)',number(rate,2)+'%'],['신규대출 연 원리금',won(yearly)],['전체 연 원리금',won(existing+yearly)],['비교 한도',limit+'%'],['한도 내 연 상환 여력',won(Math.max(0,room))],['판정',dsr<=limit?'한도 이내':'한도 초과']]);
  },

  'date-calc':()=>{
    const base=parseDate('base');
    if(!base){alert('기준일을 입력해 주세요.');return;}
    const include=selected('includeStart')==='yes';
    const weekday=d=>['일','월','화','수','목','금','토'][d.getDay()];
    const fmt=d=>`${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${weekday(d)})`;
    if(selected('mode')==='add'){
      const days=Math.round(value('days'));
      const shift=include?(days>0?days-1:days<0?days+1:0):days;
      const result=new Date(base.getFullYear(),base.getMonth(),base.getDate()+shift);
      render(fmt(result),[['기준일',fmt(base)],['더한 일수',`${number(days)}일${include?' (기준일 포함)':''}`],['주 단위',`${Math.trunc(days/7)}주 ${Math.abs(days%7)}일`],['대략 개월 수',number(days/30.4375,1)+'개월']]);
      return;
    }
    const target=parseDate('target');
    if(!target){alert('비교할 날짜를 입력해 주세요.');return;}
    const [from,to]=base<=target?[base,target]:[target,base];
    const raw=Math.round((to-from)/dayMs),total=raw+(include?1:0);
    let weekdays=0;
    for(let i=include?0:1;i<=raw&&i<=36600;i++){const d=new Date(from.getFullYear(),from.getMonth(),from.getDate()+i).getDay();if(d!==0&&d!==6)weekdays++;}
    render(number(total)+'일',[['시작',fmt(from)],['끝',fmt(to)],['주 단위',`${Math.floor(total/7)}주 ${total%7}일`],['대략 개월 수',number(total/30.4375,1)+'개월'],['평일 수 (주말 제외)',number(weekdays)+'일']]);
  },
  'discharge-date':()=>{
    const enlist=parseDate('enlist');
    if(!enlist){alert('입대일을 입력해 주세요.');return;}
    const months=parseInt(selected('branch'),10);
    const discharge=new Date(enlist.getFullYear(),enlist.getMonth()+months,enlist.getDate()-1);
    const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const total=Math.round((discharge-enlist)/dayMs)+1;
    const served=Math.min(total,Math.max(0,Math.round((today-enlist)/dayMs)+1));
    const left=Math.max(0,Math.round((discharge-today)/dayMs));
    const weekday=['일','월','화','수','목','금','토'][discharge.getDay()];
    render(`${discharge.getFullYear()}년 ${discharge.getMonth()+1}월 ${discharge.getDate()}일 (${weekday})`,[['복무기간',months+'개월'],['전체 복무일수',number(total)+'일'],['오늘까지 복무',today<enlist?'입대 전':number(served)+'일'],['남은 날',today>discharge?'전역 완료':number(left)+'일'],['진행률',number(Math.min(100,served/total*100),1)+'%']]);
  },
  'unit-converter':()=>{
    const type=selected('type'),amount=value('amount'),from=selected('from'),to=selected('to');
    const unit=UNITS[type];
    const label=code=>unit.units.find(u=>u[0]===code)?.[1]||code;
    if(type==='temperature'){
      const c=from==='C'?amount:from==='F'?(amount-32)*5/9:amount-273.15;
      const out=code=>code==='C'?c:code==='F'?c*9/5+32:c+273.15;
      render(`${number(out(to),2)} ${label(to)}`,unit.units.map(([code,name])=>[name,number(out(code),2)]));
      return;
    }
    const baseValue=amount*unit.factor[from];
    render(`${number(baseValue/unit.factor[to],6)} ${label(to)}`,unit.units.map(([code,name])=>[name,number(baseValue/unit.factor[code],6)]));
  },
  'pet-age':()=>{
    const pet=selected('pet'),years=Math.max(0,value('years'));
    const perYear={small:4,medium:5,large:6,cat:4}[pet];
    const human=years<=1?years*15:years<=2?15+(years-1)*9:24+(years-2)*perYear;
    const seniorFrom=pet==='large'?6:pet==='medium'?7:pet==='cat'?11:8;
    const stage=years<1?'성장기':years<3?'청년기':years<seniorFrom?'성년기':'노령기';
    render(`약 ${number(human)}세`,[['반려동물 나이',number(years,1)+'살'],['2살 이후 1년당',`사람 나이 +${perYear}세`],['생애 단계',stage],['노령기 시작 무렵',`${seniorFrom}살`]]);
  },
  'gpa-converter':()=>{
    const gpa=value('gpa'),from=Number(selected('from')),to=Number(selected('to'));
    if(gpa<0||gpa>from){alert(`학점은 0부터 ${from} 사이로 입력해 주세요.`);return;}
    const ratio=gpa/from;
    render(`${number(ratio*to,2)} / ${to}`,[['백분율',number(ratio*100,1)+'%'],['4.5 만점',number(ratio*4.5,2)],['4.3 만점',number(ratio*4.3,2)],['4.0 만점',number(ratio*4,2)],['100점 만점',number(ratio*100,1)]]);
  },
  'taxi-fare':()=>{
    const distance=Math.max(0,value('distance')),slow=Math.max(0,value('slow')),rate=Number(selected('time'));
    const distanceFare=Math.ceil(Math.max(0,distance-1.6)*1000/131)*100;
    const timeFare=Math.floor(slow*60/30)*100;
    const base=Math.round(4800*rate/100)*100;
    const total=Math.round((4800+distanceFare+timeFare)*rate/100)*100;
    render(won(total),[['기본요금 (1.6km)',won(base)],['거리요금',won(distanceFare*rate)],['시간요금 (저속·정차)',won(timeFare*rate)],['심야할증',rate>1?number((rate-1)*100)+'%':'없음']]);
  }
};

const UNITS={
  length:{factor:{mm:.001,cm:.01,m:1,km:1000,in:.0254,ft:.3048,yd:.9144,mi:1609.344,ja:10/33},units:[['mm','밀리미터 (mm)'],['cm','센티미터 (cm)'],['m','미터 (m)'],['km','킬로미터 (km)'],['in','인치 (in)'],['ft','피트 (ft)'],['yd','야드 (yd)'],['mi','마일 (mi)'],['ja','자 (尺)']]},
  weight:{factor:{mg:1e-6,g:.001,kg:1,t:1000,oz:.028349523125,lb:.45359237,geun:.6,don:.00375},units:[['mg','밀리그램 (mg)'],['g','그램 (g)'],['kg','킬로그램 (kg)'],['t','톤 (t)'],['oz','온스 (oz)'],['lb','파운드 (lb)'],['geun','근 (600g)'],['don','돈 (3.75g)']]},
  area:{factor:{cm2:1e-4,m2:1,pyeong:400/121,ha:10000,km2:1e6,ft2:.09290304,acre:4046.8564224},units:[['cm2','제곱센티미터 (㎠)'],['m2','제곱미터 (㎡)'],['pyeong','평'],['ha','헥타르 (ha)'],['km2','제곱킬로미터 (㎢)'],['ft2','제곱피트 (ft²)'],['acre','에이커']]},
  volume:{factor:{ml:.001,l:1,m3:1000,cup:.2365882365,gal:3.785411784,doe:1.8039},units:[['ml','밀리리터 (mL)'],['l','리터 (L)'],['m3','세제곱미터 (㎥)'],['cup','컵 (US)'],['gal','갤런 (US)'],['doe','되 (약 1.8L)']]},
  temperature:{units:[['C','섭씨 (℃)'],['F','화씨 (℉)'],['K','켈빈 (K)']]}
};

// 날짜 칸이 비어 있으면 오늘 날짜로 채우고, 단위 변환기는 종류에 맞게 단위 목록을 바꾼다.
document.addEventListener('DOMContentLoaded',()=>{
  const now=new Date(),iso=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  document.querySelectorAll('input[type=date]').forEach(input=>{if(!input.value)input.value=iso;});
  if(document.body.dataset.calc==='unit-converter'){
    const defaults={length:['m','ft'],weight:['kg','lb'],area:['m2','pyeong'],volume:['l','gal'],temperature:['C','F']};
    const fill=()=>{
      const type=selected('type'),[a,b]=defaults[type];
      const options=UNITS[type].units.map(([code,name])=>`<option value="${code}">${name}</option>`).join('');
      $('from').innerHTML=options;$('to').innerHTML=options;$('from').value=a;$('to').value=b;
    };
    $('type').addEventListener('change',fill);
    fill();
  }
});
