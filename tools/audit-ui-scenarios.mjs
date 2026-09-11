// 결과 값에 따라 글자색·배경·결과 화면이 바뀌는 페이지를 모든 분기로 띄우는 시나리오. tools/audit-ui.mjs가 사용한다.
// 각 시나리오는 입력을 넣고 계산 버튼을 누르기까지만 하고, 측정은 audit-ui가 한다.
// 선택지(select)로 바뀌는 분기는 audit-ui가 데스크톱 화면에서 모든 선택지를 자동으로 돌린다.
const calc=sel=>async({click})=>click(sel);
const run=(values,button='button[onclick^="calc"]',tab)=>async({fill,click})=>{
  if(tab)await click(`.tab-btn[onclick*="'${tab}'"]`);
  await fill(values);
  if(button)await click(button); // 입력하면 바로 계산되는 페이지는 button=null
};
const bmi=kg=>run({height:170,weight:kg});

export default {
  // BMI 등급마다 결과 박스 배경·글자색이 다르다
  'bmi':{'저체중':bmi(50),'정상':bmi(60),'비만 전단계':bmi(70),'비만 1단계':bmi(80),'비만 2단계':bmi(95),'고도비만':bmi(110)},
  // 환급(초록)과 추가 납부(주황·빨강)
  'income-tax':{
    '환급':run({wage:30000000,business:0,interest:0,other:0,prepaid:5000000}),
    '추가납부':run({wage:80000000,business:30000000,interest:0,other:0,prepaid:0})
  },
  'yearend':{
    '환급':run({salary:40000000,paid:3000000}),
    '추가납부':run({salary:90000000,paid:0})
  },
  'freelancer':{
    '연간 정산 환급':run({'annual-income':30000000,paid33:3000000},'button[onclick^="calcAnnual"]','annual'),
    '연간 정산 추가납부':run({'annual-income':150000000,paid33:0},'button[onclick^="calcAnnual"]','annual')
  },
  // 전세가 유리(파랑) / 월세가 유리(주황)
  'jeonse-vs-wolse':{
    '전세 유리':run({jeonse:200000000,'jeonse-loan':0,'jeonse-rate':4,'wolse-deposit':10000000,wolse:1500000,'invest-rate':3}),
    '월세 유리':run({jeonse:500000000,'jeonse-loan':400000000,'jeonse-rate':6,'wolse-deposit':10000000,wolse:300000,'invest-rate':3})
  },
  // 수익(초록) / 손실(빨강)
  'stock':{
    '수익':run({p1:10000,q1:10,p2:0,q2:0,cur:20000}),
    '손실':run({p1:10000,q1:10,p2:0,q2:0,cur:5000})
  },
  // 고정 연장수당이 법정 수당보다 많음(초록) / 부족(빨강)
  'inclusive-wage':{
    '고정수당 충분':run({ordinaryMonthly:3000000,fixedOt:2000000,weeklyHours:40,dailyHours:8,overtimeHours:5,nightHours:0,holidayHours1:0,holidayHours2:0}),
    '고정수당 부족':run({ordinaryMonthly:3000000,fixedOt:100000,weeklyHours:40,dailyHours:8,overtimeHours:40,nightHours:10,holidayHours1:8,holidayHours2:0})
  },
  // 비과세 안내 박스 / 세액 결과 박스
  'gift-tax':{'과세':run({amount:500000000})},
  'yangdo':{
    '양도차손':run({buy:500000000,sell:400000000,cost:0}),
    '고액 양도차익':run({buy:100000000,sell:1500000000,cost:0})
  },
  // 탭마다 다른 결과 화면
  'dday':{
    'D-Day 남음':run({target:'2026-12-25',ddayName:'크리스마스'},'button[onclick^="calcDday"]','dday'),
    'D-Day 지남':run({target:'2025-01-01',ddayName:'새해'},'button[onclick^="calcDday"]','dday')
  },
  'health-insurance':{'지역가입자':run({'l-income':30000000,'l-property':300000000},'button[onclick^="calcLocal"]','local')},
  'ovulation':{'임신 주수':run({'preg-period':'2026-06-01'},'button[onclick^="calcPregnancy"]','pregnancy')},
  'vat':{
    // 부가세 계산기는 입력 즉시 계산된다
    '부가세 제거':run({'rm-price':110000},null,'remove'),
    '여러 항목 합산':async({page,click})=>{await click(`.tab-btn[onclick*="'multi'"]`);for(const input of await page.locator('input:visible').all()){await input.fill('110000');await input.dispatchEvent('input');}}
  },
  'coffee-savings':{'8천원 프리셋':async({click})=>{await click('button[onclick^="setPreset(8000"]');await click('button[onclick^="calc"]');}},
  'lotto':{'마지막 게임 수':async({page,fillAndCalc})=>{const b=page.locator('.game-btn');const n=await b.count();if(n>1)await b.nth(n-1).click();await fillAndCalc();}},
  // 전기요금 구간별 색
  'electricity':{'1단계':run({kwh:150}),'3단계':run({kwh:550})},
  // 종부세 세부담상한 적용 화면
  'jongbu-tax':{'세부담상한':run({price:'2,000,000,000',prevTotal:'3,000,000'},'button.btn')},
  'payday':{'계산':calc('button[onclick^="calc"]')}
};
