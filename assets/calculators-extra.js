// 2026년 9월 추가·이전된 계산기. utility-calculators.js의 $, value, positive, won, number, render를 함께 사용한다.
// 요율·세율은 assets/rates.js(window.KR_RATES)에서 읽는다.
const RATES=window.KR_RATES;
const PAY2026={employRate:RATES.employment.worker,unemployMax:RATES.unemployment.dailyMax,unemployMin:RATES.unemploymentDailyMin(),minWage:RATES.minimumWage};
const floor10=RATES.floor10;
const selected=id=>$(id)?.value;
const insuranceOf=monthly=>RATES.insurance(monthly);
const withholdingOf=(monthly,family=1,children=0,ratio=100)=>RATES.withholding(monthly,family,children,ratio);

function netMonthly(gross,nontax,family,children){
  const taxable=Math.max(0,gross-nontax);
  const ins=insuranceOf(taxable),tax=withholdingOf(taxable,family,children);
  return {taxable,ins,tax,net:gross-ins.total-tax.income-tax.local};
}

const progressiveTax=b=>RATES.incomeTax(b);

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
    const plans=RATES.eitc;
    const effective=type==='single'&&kids>0?'one':type;
    const [rise,flat,cap,max]=plans[effective];
    let work=income<rise?income*max/rise:income<=flat?max:income<cap?max-(income-flat)*max/(cap-flat):0;
    let child=0;
    const C=RATES.eitc.child;
    if(effective!=='single'&&kids>0&&income<C.incomeCap){
      const start=C.start[effective],span=C.span[effective];
      const per=income<start?C.max:Math.max(C.min,C.max-(income-start)*(C.max-C.min)/span);
      child=per*kids;
    }
    const assetRate=assets>=RATES.eitc.assetCap?0:assets>=RATES.eitc.assetHalf?.5:1;
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
      const daily=wage/209*8,total=daily*20,gov=priority?Math.min(total,RATES.maternity.spouseCap):0;
      render(won(total),[['휴가 일수','20일 (근로일 기준)'],['1일 통상임금',won(daily)],['고용보험 지급',won(gov)],['회사 지급',won(total-gov)],['정부 지원 대상',priority?'우선지원대상기업':'대규모기업은 회사가 전액 지급']]);
      return;
    }
    const multiple=kind==='multiple',totalDays=multiple?120:90,paidDays=multiple?75:60,capMonth=RATES.maternity.monthlyCap;
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
    const P=RATES.propertyTax;
    const ratio=oneHouse?P.oneHouseRatio(price):P.ratio;
    const base=Math.floor(price*ratio/1000)*1000;
    const special=oneHouse&&price<=P.specialPriceCap;
    const tax=P.tax(base,special);
    const urbanTax=urban?base*P.urbanRate:0,edu=tax*P.eduRatio,total=tax+urbanTax+edu;
    const split=tax>P.splitThreshold;
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
    const P=RATES.credits.pensionAccount;
    const rate=(kind==='salary'?income<=P.lowSalary:income<=P.lowIncome)?P.lowRate:P.highRate;
    const eligible=Math.min(Math.min(saving,P.savingCap)+irp,P.totalCap),national=eligible*rate,local=national*RATES.localIncomeTaxRatio;
    render(won(national+local),[['세액공제 대상 납입액',won(eligible)],['적용 공제율',number(rate*100)+'% (지방소득세 별도)'],['소득세 공제 예상액',won(national)],['지방소득세 포함 절세액',won(national+local)],['합산 한도까지 남은 금액',won(Math.max(0,P.totalCap-eligible))]]);
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
    const converted=Math.max(0,assets-debt-deduct)*.04/12,recognized=income+converted,limit=RATES.basicPension[couple?'couple':'single'];
    render(recognized<=limit?'선정기준 이내':'선정기준 초과',[['월 소득평가액',won(income)],['재산의 월 소득환산액',won(converted)],['예상 소득인정액',won(recognized)],['2026년 선정기준액',won(limit)],['기준과의 차이',won(Math.abs(limit-recognized))]]);
  },
  'car-tax-prepay':()=>{
    if(!requirePositive(['annual']))return;
    const annual=positive('annual'),month=+selected('month'),remain=Math.max(0,12-month),discount=annual*remain/12*RATES.carTaxPrepayRate;
    render(won(annual-discount),[['자동차세 연세액',won(annual)],['공제 대상 기간',remain+'개월'],['실질 할인율',number(remain/12*RATES.carTaxPrepayRate*100,2)+'%'],['예상 공제액',won(discount)]]);
  },
  'health-refund':()=>{
    const paid=positive('paid'),cap=positive('cap'),excluded=positive('excluded'),eligible=Math.max(0,paid-excluded);
    if(!cap){alert('공단에서 확인한 개인별 상한액을 입력해 주세요.');return;}
    render(won(Math.max(0,eligible-cap)),[['연간 본인부담금',won(paid)],['제외 금액',won(excluded)],['상한제 대상 금액',won(eligible)],['개인별 상한액',won(cap)]]);
  },
  'rent-tax-credit':()=>{
    const salary=positive('salary'),rent=positive('rent'),ok=selected('eligible')==='yes';
    const M=RATES.credits.rent;
    const rate=salary<=M.lowSalary?M.lowRate:M.highRate,base=ok&&salary<=M.maxSalary?Math.min(rent,M.cap):0;
    render(won(base*rate),[['연간 월세액',won(rent)],['공제 대상 월세액',won(base)],['적용 공제율',base?number(rate*100)+'%':'대상 아님'],['월 평균 절세 효과',won(base*rate/12)]]);
  },
  'mortgage-dsr':()=>{
    if(!requirePositive(['income','loan','years']))return;
    const income=positive('income'),existing=positive('existing'),loan=positive('loan'),rate=positive('rate')+positive('stress'),years=positive('years'),limit=positive('limit')||40;
    const yearly=annuity(loan,rate,years)*12,dsr=(existing+yearly)/income*100,room=income*limit/100-existing;
    render(number(dsr,1)+'%',[['적용금리 (스트레스 포함)',number(rate,2)+'%'],['신규대출 연 원리금',won(yearly)],['전체 연 원리금',won(existing+yearly)],['비교 한도',limit+'%'],['한도 내 연 상환 여력',won(Math.max(0,room))],['판정',dsr<=limit?'한도 이내':'한도 초과']]);
  },

  'childcare-benefits':()=>{
    const birth=parseDate('birth');
    if(!birth){alert('아이 생년월일을 입력해 주세요.');return;}
    const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    let months=(today.getFullYear()-birth.getFullYear())*12+(today.getMonth()-birth.getMonth());
    if(today.getDate()<birth.getDate())months--;
    const born=birth<=today,age=born?Math.max(0,months):0;
    const region=Number(selected('region')),voucher=RATES.childcare.voucher[selected('order')==='1'?0:1],daycare=selected('daycare')==='yes';
    const [benefit0,benefit1]=RATES.childcare.parentBenefit,months108=RATES.childcare.allowanceMonths;
    const parental=m=>m<12?benefit0:m<24?benefit1:0;
    const thisParental=born?parental(age):0,thisChild=born&&age<months108?region:0;
    let parentalLeft=0;
    for(let m=age;m<24;m++)parentalLeft+=parental(m);
    const childLeft=Math.max(0,months108-age)*region;
    render(won(thisParental+thisChild)+' / 이번 달',[
      ['아이 개월 수',born?`${age}개월`:'출생 전'],
      ['첫만남이용권 (1회, 바우처)',won(voucher)],
      ['이번 달 부모급여',won(thisParental)+(daycare&&thisParental?' (어린이집 이용 시 보육료 차감)':'')],
      ['이번 달 아동수당',won(thisChild)],
      ['앞으로 받을 부모급여',won(parentalLeft)],
      ['앞으로 받을 아동수당 (만 9세 전까지)',won(childLeft)],
      ['출생부터 만 9세 전까지 총액',won(voucher+(benefit0+benefit1)*12+region*months108)]
    ]);
  },
  'work-hours':()=>{
    const toMin=v=>{const [h,m]=String(v||'').split(':').map(Number);return Number.isFinite(h)?h*60+(m||0):NaN;};
    const start=toMin($('start').value);
    let end=toMin($('end').value);
    if(!Number.isFinite(start)||!Number.isFinite(end)){alert('출근 시각과 퇴근 시각을 입력해 주세요.');return;}
    if(end<=start)end+=1440;
    const span=end-start,breakChoice=selected('breakMin');
    const rest=breakChoice==='auto'?(span>=510?60:span>=270?30:0):Number(breakChoice);
    const work=Math.max(0,span-rest),days=Math.min(7,Math.max(1,Math.round(value('days'))));
    let night=0;
    for(let t=start;t<end;t++){const m=t%1440;if(m>=1320||m<360)night++;}
    night=Math.min(night,work);
    const weekly=work*days,overtime=Math.max(Math.max(0,work-480)*days,weekly-2400,0);
    const hm=m=>`${Math.floor(m/60)}시간${m%60?` ${m%60}분`:''}`;
    const rows=[['휴게시간',rest+'분'],['주 근로시간',hm(weekly)],['월 환산 근로시간',number(weekly/60*365/7/12,1)+'시간'],['연장근로 (주)',hm(overtime)],['야간근로 (주, 22~06시)',hm(night*days)],['주 52시간 기준',weekly>3120?`${hm(weekly-3120)} 초과`:'이내']];
    const hourly=positive('hourly');
    if(hourly>0){
      const regular=Math.min(weekly,2400)/60,holidayHours=weekly>=900?Math.min(8,regular/40*8):0;
      const pay=hourly*weekly/60+hourly*.5*overtime/60+hourly*.5*night*days/60+hourly*holidayHours;
      rows.push(['주급 예상 (가산·주휴 포함)',won(pay)],['월급 환산',won(pay*365/7/12)]);
    }
    render(hm(work)+' / 일',rows);
  },
  'car-installment':()=>{
    if(!requirePositive(['price']))return;
    const price=positive('price'),down=Math.min(positive('down'),price),n=Number(selected('months')),r=positive('rate')/1200;
    const principal=price-down;
    if(principal<=0){render('할부가 필요 없어요',[['차량 가격',won(price)],['선수금',won(down)],['할부원금','0원']]);return;}
    const balloon=Math.min(principal,price*Math.min(80,positive('residual'))/100);
    const payment=r?(principal-balloon/Math.pow(1+r,n))*r/(1-Math.pow(1+r,-n)):(principal-balloon)/n;
    const total=payment*n+balloon;
    render(won(payment)+' / 월',[['할부원금',won(principal)],['할부 기간',n+'개월'],['마지막 달 유예금',balloon?won(balloon):'없음'],['총 이자',won(total-principal)],['할부 총 납부액',won(total)],['선수금 포함 총비용',won(total+down)]]);
  },
  'car-tax':()=>{
    const type=selected('type'),cc=positive('cc'),age=positive('age'),T=RATES.carTax;
    const isEv=type==='ev'||type==='ev-business',isPrivate=type==='private'||type==='ev';
    if(!isEv&&!cc){alert('배기량을 입력해 주세요.');return;}
    // 배기량 구간별 1cc당 세액. 전기·수소차는 배기량이 없어 정액이다
    const base=isEv?(isPrivate?T.evPrivate:T.evBusiness)
      :Math.floor(cc*(isPrivate?T.private:T.business).find(([limit])=>cc<=limit)[1]);
    // 차령 경감은 배기량 기준 비영업용 승용차만. 3년째 5%부터 매년 5%씩, 12년째 이상 50% 한도
    const discountable=type==='private';
    const discount=discountable&&age>=T.ageStartYear?Math.min(T.ageMax,(age-T.ageStartYear+1)*T.ageStep):0;
    const carTax=Math.floor(base*(1-discount)/10)*10;
    // 지방교육세는 비영업용 승용차에만 붙는다
    const edu=isPrivate?Math.floor(carTax*T.eduRatio/10)*10:0,total=carTax+edu;
    render(won(total)+' / 년',[
      ['차종',{private:'비영업용 승용차',business:'영업용 승용차',ev:'전기·수소차 (비영업용)','ev-business':'전기·수소차 (영업용)'}[type]],
      ...(isEv?[['연세액 기준','배기량이 없어 정액 과세']]:[['배기량',number(cc)+'cc'],['배기량 기준 세액',won(base)]]),
      ['차령 경감',discount?`${number(discount*100)}% (-${won(base-carTax)})`:(discountable?'해당 없음 (차령 2년 이하)':isEv?'해당 없음 (정액 과세 차량)':'해당 없음 (영업용)')],
      ['자동차세',won(carTax)],
      ['지방교육세 (30%)',isPrivate?won(edu):'해당 없음 (영업용)'],
      ['6월분 (1기분)',won(Math.floor(total/2))],
      ['12월분 (2기분)',won(total-Math.floor(total/2))],
      ['연납 할인','1월에 한 번에 내면 공제받아요 (자동차세 연납 할인 계산기에서 확인)']
    ]);
  },
  'jongbu-tax':()=>{
    if(!requirePositive(['price']))return;
    const price=positive('price'),type=selected('houses'),prevTotal=positive('prevTotal');
    // 만원 단위로 적는 실수를 막는다 (작년 보유세가 1만원 미만이면 세부담상한이 사실상 0원이 되어 결과가 크게 틀어진다)
    if(prevTotal>0&&prevTotal<10000){alert('작년 재산세+종부세 합계는 원 단위로 입력해 주세요. 예: 300만원 → 3,000,000');return;}
    const age=positive('age'),years=positive('years');
    const progressive=(base,bands)=>{let tax=0,prev=0;for(const [limit,rate] of bands){if(base<=prev)break;tax+=(Math.min(base,limit)-prev)*rate;prev=limit;}return tax;};
    const J=RATES.jongbu,general=J.general,heavy=J.heavy,PT=RATES.propertyTax;
    // 재산세 표준세율 (재산세 부과액 근사와 재산세 중복분 공제 계산용)
    const propertyStandard=b=>PT.tax(b,false);
    const seniorCredit=J.credit(age,years);
    const oneHouse=type==='one'||type==='couple';
    // 재산세 공정시장가액비율: 1세대 1주택은 공시가격에 따라 43~45%, 그 외 60%. 재산세 부과액과 중복분 공제 비율 모두 이 비율로 계산한다
    const propertyRatio=oneHouse?PT.oneHouseRatio(price):PT.ratio;
    // 한 사람(또는 단독명의) 기준 종부세. share = 보유 지분의 공시가격, propertyTax = 그 지분에 부과된 재산세
    const person=({share,deduction,bands,propertyTax,credit})=>{
      const base=Math.max(0,share-deduction)*J.ratio;
      if(base<=0)return {base:0,gross:0,overlap:0,creditAmount:0,tax:0};
      const gross=progressive(base,bands);
      const overlap=Math.min(gross,propertyTax*Math.min(1,propertyStandard(base*propertyRatio)/propertyStandard(share*propertyRatio)));
      const afterOverlap=gross-overlap,creditAmount=afterOverlap*credit;
      return {base,gross,overlap,creditAmount,tax:afterOverlap-creditAmount};
    };
    const propertyTaxTotal=propertyStandard(price*propertyRatio);
    const single=person({share:price,deduction:oneHouse?J.oneHouseDeduction:J.deduction,bands:type==='three'?heavy:general,propertyTax:propertyTaxTotal,credit:oneHouse?seniorCredit:0});
    let chosen=single,label=oneHouse?'1세대 1주택 (12억원 공제)':(type==='three'?'3주택 이상':'2주택 이하'),coupleRows=[];
    if(type==='couple'){
      const half=person({share:price/2,deduction:J.deduction,bands:general,propertyTax:propertyTaxTotal/2,credit:0});
      const coupleTax=half.tax*2;
      coupleRows=[['부부 각자 9억원 공제로 낼 때',won(coupleTax*(1+J.ruralRate))],['1주택 특례(12억원 공제·세액공제) 신청 시',won(single.tax*(1+J.ruralRate))]];
      if(coupleTax<single.tax){chosen={base:half.base*2,gross:half.gross*2,overlap:half.overlap*2,creditAmount:0,tax:coupleTax};label='부부 공동명의 (각자 9억원 공제)';}
      else label='부부 공동명의 → 1주택 특례 신청이 유리';
    }
    if(chosen.base<=0){render('종합부동산세 대상이 아니에요',[['공시가격 합계',won(price)],['적용 방식',label],...coupleRows]);return;}
    let tax=chosen.tax,capped=0;
    if(prevTotal>0){
      const limit=Math.max(0,prevTotal*J.burdenCap-propertyTaxTotal);
      if(tax>limit){capped=tax-limit;tax=limit;}
    }
    const rural=tax*J.ruralRate;
    render(won(tax+rural),[
      ['적용 방식',label],
      ['과세표준 (공제 후 × 60%)',won(chosen.base)],
      ['산출세액',won(chosen.gross)],
      ['재산세 중복분 공제','-'+won(chosen.overlap)],
      ['1세대 1주택 세액공제',chosen.creditAmount?`${number(seniorCredit*100)}% (-${won(chosen.creditAmount)})`:'해당 없음'],
      ['세부담상한 (전년도 보유세 150%)',prevTotal>0?(capped?'-'+won(capped):'상한 이내'):'전년도 세액 입력 시 반영'],
      ['종합부동산세',won(tax)],
      ['농어촌특별세 (20%)',won(rural)],
      ...coupleRows
    ]);
  },
  'dividend':()=>{
    if(!requirePositive(['shares','dps']))return;
    const shares=positive('shares'),dps=positive('dps'),freq=Number(selected('freq')),rate=Number(selected('tax'))/100,price=positive('price'),target=positive('target');
    const gross=shares*dps,net=gross*(1-rate);
    const rows=[['세전 연 배당금',won(gross)],['배당소득세',won(gross*rate)],['세후 연 배당금',won(net)],[`1회 지급액 (연 ${freq}회, 세후)`,won(net/freq)]];
    if(price>0)rows.push(['배당수익률 (세전)',number(dps/price*100,2)+'%'],['투자 원금',won(shares*price)]);
    if(target>0){
      const need=Math.ceil(target*12/(dps*(1-rate)));
      rows.push(['목표 월배당에 필요한 주식 수',number(need)+'주']);
      if(price>0)rows.push(['목표 달성에 필요한 투자금',won(need*price)]);
    }
    render(won(net/12)+' / 월',rows);
  },
  'lunar-converter':()=>{
    let fmt;
    try{
      // 한국 전통력(단기력, 한국 표준시 기준). 중국력은 합삭 기준 시각이 달라 몇 년에 한 번씩 하루가 어긋난다.
      // 양력 날짜 자체를 UTC 정오로 다뤄 방문자 기기의 시간대와 상관없이 같은 날짜를 변환한다
      fmt=new Intl.DateTimeFormat('ko-KR-u-ca-dangi',{year:'numeric',month:'numeric',day:'numeric',timeZone:'UTC'});
      if(fmt.resolvedOptions().calendar!=='dangi')throw new Error('unsupported');
    }catch(e){alert('이 브라우저는 음력 계산을 지원하지 않아요. 최신 크롬·사파리·엣지에서 이용해 주세요.');return;}
    const lunarOf=d=>{
      const p=Object.fromEntries(fmt.formatToParts(d).map(x=>[x.type,x.value]));
      return {y:Number(p.relatedYear||p.year),m:parseInt(String(p.month).replace(/\D/g,''),10),leap:/윤|bis/.test(p.month),d:Number(p.day)};
    };
    const noon=(y,m,d)=>new Date(Date.UTC(y,m,d,12));
    const idx=y=>((y-4)%12+12)%12;
    const ganji=y=>'갑을병정무기경신임계'[((y-4)%10+10)%10]+'자축인묘진사오미신유술해'[idx(y)];
    const animal=y=>['쥐','소','호랑이','토끼','용','뱀','말','양','원숭이','닭','개','돼지'][idx(y)];
    const solarText=d=>`${d.getUTCFullYear()}년 ${d.getUTCMonth()+1}월 ${d.getUTCDate()}일 (${'일월화수목금토'[d.getUTCDay()]})`;
    const findSolar=(y,m,d,leap)=>{
      for(let i=0;i<420;i++){const day=noon(y,0,1+i),l=lunarOf(day);if(l.y===y&&l.m===m&&l.d===d&&l.leap===leap)return day;}
      return null;
    };
    const nextYear=(y,m,d)=>findSolar(y+1,m,d,false)||findSolar(y+1,m,Math.min(d,29),false);
    if(selected('dir')==='toLunar'){
      const s=parseDate('solar');
      if(!s){alert('양력 날짜를 입력해 주세요.');return;}
      const day=noon(s.getFullYear(),s.getMonth(),s.getDate()),l=lunarOf(day),next=nextYear(l.y,l.m,l.d);
      render(`음력 ${l.y}년 ${l.leap?'윤':''}${l.m}월 ${l.d}일`,[['양력',solarText(day)],['윤달 여부',l.leap?'윤달':'평달'],['간지·띠',`${ganji(l.y)}년 · ${animal(l.y)}띠`],['다음 해 같은 음력 날짜',next?solarText(next):'해당 날짜 없음']]);
      return;
    }
    const y=Math.round(value('ly')),m=Math.round(value('lm')),d=Math.round(value('ld')),leap=selected('leap')==='yes';
    if(y<1901||y>2099||m<1||m>12||d<1||d>30){alert('음력 날짜를 올바르게 입력해 주세요. (1901~2099년)');return;}
    const solar=findSolar(y,m,d,leap);
    if(!solar){alert(leap?`${y}년에는 윤${m}월 ${d}일이 없어요.`:`${y}년 음력 ${m}월에는 ${d}일이 없어요.`);return;}
    const next=nextYear(y,m,d);
    render(solarText(solar),[['음력',`${y}년 ${leap?'윤':''}${m}월 ${d}일`],['간지·띠',`${ganji(y)}년 · ${animal(y)}띠`],['다음 해 같은 음력 날짜',next?solarText(next):'해당 날짜 없음']]);
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
  if(document.body.dataset.calc==='lunar-converter'){
    const toggle=()=>{
      const toSolar=selected('dir')==='toSolar';
      $('solar').closest('.field').hidden=toSolar;
      ['ly','lm','ld','leap'].forEach(id=>{$(id).closest('.field').hidden=!toSolar;});
    };
    $('dir').addEventListener('change',toggle);
    toggle();
  }
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
