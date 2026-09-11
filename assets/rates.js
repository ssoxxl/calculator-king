// 계산왕 공통 요율·세율·지원금 기준. 해마다 바뀌는 값은 이 파일에서만 고친다.
// 공통 템플릿 계산기, 기존 계산기 페이지, 홈 빠른 계산이 모두 window.KR_RATES를 읽는다.
// node tools/check-rates.mjs 가 페이지 스크립트에 요율 숫자가 다시 박히지 않았는지 검사한다.
(function(){
  const floor10=n=>Math.floor(Math.round(n*1000)/1000/10)*10; // 10원 미만 절사 (부동소수점 오차 보정)

  const R={
    year:2026,

    // ── 급여·4대보험 ──────────────────────────────
    // 국민연금 근로자 부담률과 기준소득월액 하한·상한 (2026.7~2027.6)
    pension:{rate:.0475,min:410000,max:6590000},
    // 건강보험 근로자 부담률, 장기요양(건강보험료 대비), 지역가입자 요율·재산점수 단가·최저보험료
    health:{rate:.03595,ltcRatio:.1314,localRate:.0719,propertyPointWon:211.5,localMinimum:20160},
    // 고용보험 근로자 요율, 사업주 고용안정·직업능력개발사업 요율
    employment:{worker:.009,employerStability:{under150:.0025,priority:.0045,under1000:.0065,over1000:.0085}},
    // 최저임금 시급 (연도별)
    minimumWage:{2026:10320,2027:10700},
    // 비과세 식대 월 한도
    nontaxMeal:200000,

    // ── 세금 ─────────────────────────────────────
    // 종합소득세·근로소득세 기본세율 [과세표준 구간 상한, 세율]
    incomeTaxBands:[[14e6,.06],[50e6,.15],[88e6,.24],[150e6,.35],[300e6,.38],[500e6,.40],[1e9,.42],[Infinity,.45]],
    localIncomeTaxRatio:.1,
    // 이자·배당소득 원천징수 (소득세 14% + 지방소득세 1.4%)
    interestTax:.154,
    // 사업소득(프리랜서) 원천징수 3.3%
    businessIncomeWithholding:.033,
    credits:{
      // 월세 세액공제: 총급여 5,500만원 이하 17%, 8,000만원 이하 15%, 연 1,000만원 한도
      rent:{lowRate:.17,highRate:.15,lowSalary:55e6,maxSalary:80e6,cap:1e7},
      // 연금계좌 세액공제: 총급여 5,500만원(종합소득 4,500만원) 이하 15%, 초과 12%, 연금저축 600만원·합산 900만원 한도
      pensionAccount:{lowRate:.15,highRate:.12,lowSalary:55e6,lowIncome:45e6,savingCap:6e6,totalCap:9e6},
      // 자녀세액공제 (8세 이상): 1명 25만원, 2명 55만원, 3명부터 1명당 40만원 추가
      child:n=>n<=0?0:n===1?25e4:n===2?55e4:55e4+(n-2)*40e4
    },
    // 자동차세 연납 공제율 (남은 기간 세액 기준)
    carTaxPrepayRate:.05,

    // ── 고용보험 급여·복지 ────────────────────────
    // 실업급여 1일 상한액, 하한 = 최저시급 × 8시간 × 80%
    unemployment:{dailyMax:68100,minRatio:.8},
    // 육아휴직 급여 월 상한·하한, 6+6 부모 육아휴직 월별 상한
    parentalLeave:{firstCap:2.5e6,secondCap:2e6,laterCap:1.6e6,laterRatio:.8,minimum:7e5,sixPlusSixCaps:[2.5e6,2.5e6,3e6,3.5e6,4e6,4.5e6]},
    // 출산전후휴가 급여 30일 상한, 배우자 출산휴가 20일분 상한
    maternity:{monthlyCap:2.2e6,spouseCap:1684210},
    // 첫만남이용권(첫째·둘째 이상), 부모급여(0세·1세 월액), 아동수당 지급 개월 수(만 9세 미만)
    childcare:{voucher:[2e6,3e6],parentBenefit:[1e6,5e5],allowanceMonths:108},
    // 기초연금 선정기준액 (월)
    basicPension:{single:2470000,couple:3952000},
    // 근로장려금 [점증 끝, 평탄 끝, 소득 상한, 최대액], 자녀장려금, 재산 요건
    eitc:{
      single:[4e6,9e6,22e6,1.65e6],one:[7e6,14e6,32e6,2.85e6],dual:[8e6,17e6,44e6,3.3e6],
      child:{max:1e6,min:5e5,incomeCap:7e7,start:{one:21e6,dual:25e6},span:{one:49e6,dual:45e6}},
      assetHalf:1.7e8,assetCap:2.4e8
    },

    // ── 생활 요금 ────────────────────────────────
    // 주택용 저압 전기요금 [구간 상한 kWh, 기본요금, kWh당 전력량요금]
    electricity:{
      normal:[[200,910,120],[400,1600,214.6],[Infinity,7300,307.3]],
      summer:[[300,910,120],[450,1600,214.6],[Infinity,7300,307.3]],
      climatePerKwh:9,fuelPerKwh:5,fundRate:.027,vat:.1
    }
  };

  // ── 부동산 보유세 ────────────────────────────
  // 주택 재산세: 공정시장가액비율(일반 60%, 1세대 1주택 43~45%), 표준세율·1주택 특례세율(공시가격 9억원 이하),
  // 도시지역분 0.14%, 지방교육세 20%, 20만원 초과 시 7월·9월 분할
  R.propertyTax={
    ratio:.6,
    oneHouseRatio:price=>price<=3e8?.43:price<=6e8?.44:.45,
    specialPriceCap:9e8,urbanRate:.0014,eduRatio:.2,splitThreshold:200000,
    tax:(base,special)=>special
      ?(base<=6e7?base*.0005:base<=1.5e8?30000+(base-6e7)*.001:base<=3e8?120000+(base-1.5e8)*.002:420000+(base-3e8)*.0035)
      :(base<=6e7?base*.001:base<=1.5e8?60000+(base-6e7)*.0015:base<=3e8?195000+(base-1.5e8)*.0025:570000+(base-3e8)*.004)
  };
  // 주택분 종합부동산세 (2026년 현행): 공제 9억원·1세대 1주택 12억원, 공정시장가액비율 60%,
  // 세율표(2주택 이하·3주택 이상), 1주택 고령자·장기보유 세액공제(합계 80% 한도), 세부담상한 150%, 농어촌특별세 20%
  R.jongbu={
    deduction:9e8,oneHouseDeduction:12e8,ratio:.6,burdenCap:1.5,ruralRate:.2,
    general:[[3e8,.005],[6e8,.007],[12e8,.01],[25e8,.013],[50e8,.015],[94e8,.02],[Infinity,.027]],
    heavy:[[3e8,.005],[6e8,.007],[12e8,.01],[25e8,.02],[50e8,.03],[94e8,.04],[Infinity,.05]],
    credit:(age,years)=>Math.min(.8,(age>=70?.4:age>=65?.3:age>=60?.2:0)+(years>=15?.5:years>=10?.4:years>=5?.2:0))
  };

  R.floor10=floor10;
  R.incomeTax=base=>{
    let tax=0,prev=0;
    for(const [limit,rate] of R.incomeTaxBands){if(base<=prev)break;tax+=(Math.min(base,limit)-prev)*rate;prev=limit;}
    return Math.max(0,tax);
  };
  // 근로소득공제 (1억원 초과분 2%, 한도 2천만원)
  R.earnedIncomeDeduction=gross=>gross<=5e6?gross*.7:gross<=15e6?3.5e6+(gross-5e6)*.4:gross<=45e6?7.5e6+(gross-15e6)*.15:gross<=1e8?12e6+(gross-45e6)*.05:Math.min(2e7,14.75e6+(gross-1e8)*.02);
  // 근로소득세액공제와 총급여별 한도
  R.earnedIncomeCredit=(tax,gross)=>{
    const credit=tax<=1.3e6?tax*.55:715000+(tax-1.3e6)*.3;
    const limit=gross<=33e6?740000:gross<=70e6?Math.max(660000,740000-(gross-33e6)*.008):gross<=120e6?Math.max(500000,660000-(gross-70e6)*.5):Math.max(200000,500000-(gross-120e6)*.5);
    return Math.min(credit,limit);
  };
  // 근로자 부담 4대보험 (월 보수, 비과세 제외)
  R.insurance=monthly=>{
    if(monthly<=0)return {pension:0,health:0,ltc:0,employ:0,total:0,base:0};
    const base=Math.min(Math.max(Math.floor(monthly/1000)*1000,R.pension.min),R.pension.max);
    const pension=floor10(base*R.pension.rate),health=floor10(monthly*R.health.rate);
    const ltc=floor10(health*R.health.ltcRatio),employ=floor10(monthly*R.employment.worker);
    return {pension,health,ltc,employ,total:pension+health+ltc+employ,base};
  };
  // 국세청 근로소득 간이세액표 조회 (assets/withholding-table.js 필요). monthly = 비과세 제외 월급여
  R.withholding=(monthly,family=1,children=0,ratio=100)=>{
    const table=window.WITHHOLDING_TABLE;
    if(!table)throw new Error('간이세액표 데이터(assets/withholding-table.js)가 필요합니다.');
    const fam=Math.min(Math.max(Math.round(family),1),11),k=monthly/1000;
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
    return {income,local:floor10(income*R.localIncomeTaxRatio),tableTax:tax,childCut};
  };
  // 실업급여 1일 하한액 (하한이 상한을 넘으면 상한과 같게 본다)
  R.unemploymentDailyMin=(year=R.year)=>Math.min(R.unemployment.dailyMax,(R.minimumWage[year]||R.minimumWage[R.year])*8*R.unemployment.minRatio);

  window.KR_RATES=R;
})();
