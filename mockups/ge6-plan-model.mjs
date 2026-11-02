// Frozen 31 Oct 2026 noon forecast. This module powers only the local prototype.
export const baseline=[
  ['Rose',55010],['Jew',32789.19],['Emma',25502.79],['Hoop',22988.96],['Nall',22154.18],['Luksorn',19308.69],
  ['Marine',19001.34],['Niya',16482.56],['Neen',12800.71],['Prae',11426.44],['Praew',10080.36],['Arlee',9949.74],
  ['Micha',9381.13],['Pancake',9327.72],['Nana',9024.3],['Blythe',7941.15],['Galeya',7903.77],['L',7437.62],
  ['Janry',7364.5],['Monet',7083.8],['Lookked',6655.65],['Nammonn',6469.62],['Fame',6044.85],['Wawa',5985.82],
  ['Ploen',5806.89],['Patt',5713.97],['Lingling',5708.84],['Palmmy',5625.04],['Emmy',5151.79],['Sindy',5094.52],
  ['Kwan',4792.91],['Grape',4183.01],['Saonoi',3517.73],['Jingjing',3258.75],['Mayji',2834.73],['Khowjow',2672.54],
  ['Nisha',2568.96],['Cartoon',2499.33],['Yoghurt',2473.15],['Shenae',2278.7],['Mail',2200.35],['Mint',2073.93],
  ['Khaimook',1917.77],['Inkcha',1134.15],['Berry',1078.33],['Punpon',1075.76],['Proud',1034.7],['Satangpound',1014.55],
  ['Else',861.85],['Tara',799.05],['Hongyok',791.79],['Lewlew',763.75],['Chifa',732.75],['Namphet',724.75],
  ['Valentine',711.25],['Ginna',705.71],['Mirin',679.15],['Praifa',675.35],
];
export const official=[
  'Rose','Emma','Hoop','Marine','Niya','Jew','Nall','Luksorn','Arlee','Monet','Prae','Micha',
  'Neen','Pancake','Praew','Nana','Blythe','Lookked','Ploen','Galeya','Janry','L','Palmmy','Fame',
  'Nammonn','Wawa','Lingling','Shenae','Patt','Emmy','Saonoi','Sindy','Kwan','Cartoon','Grape','Khowjow',
];
export const unknownPool=41594.36;
export const teamPreset=[
  ['Rose',37000],['Marine',22001.34],['Niya',22482.56],['Jew',22789.19],['Arlee',19949.74],
  ['Monet',17083.8],['Prae',12426.44],['Micha',12381.13],['Pancake',11327.72],['Lookked',7955.65],
  ['Ploen',7906.89],['Palmmy',6625.04],['Fame',6544.85],['Shenae',5778.7],['Saonoi',5117.73],
  ['Cartoon',4499.33],['Khowjow',4000],
].map(([member,amount],index)=>({id:`team-${index}`,kind:'estimate',member,amount,note:'จากชีตทีม'}));
const cents=value=>Math.round(Number(value)*100);
const names=new Set(baseline.map(([name])=>name));
export function calculatePlan(adjustments=[]){
  const scores=new Map(baseline.map(([name,score])=>[name,cents(score)]));
  const issues=[];const usedTx=new Set();let allocatedUnknown=0;
  for(const item of adjustments){
    const value=cents(item.amount);
    if(!Number.isSafeInteger(value)||value<=0){issues.push('ยอดคะแนนต้องมากกว่า 0');continue;}
    if(item.kind==='estimate'){
      if(!names.has(item.member)){issues.push(`ไม่พบเมมเบอร์ ${item.member}`);continue;}
      scores.set(item.member,value);
    }else if(item.kind==='unknown'){
      if(!names.has(item.member)){issues.push(`ไม่พบเมมเบอร์ ${item.member}`);continue;}
      if(allocatedUnknown+value>cents(unknownPool)){issues.push('จัดสรรเกินยอดที่ยังไม่รู้ผู้รับ');continue;}
      allocatedUnknown+=value;scores.set(item.member,scores.get(item.member)+value);
    }else if(item.kind==='tx'){
      const key=String(item.txHash??'').trim().toLowerCase();
      if(!/^0x[0-9a-f]{64}$/.test(key)){issues.push('TX hash ต้องมี 64 หลัก');continue;}
      if(usedTx.has(key)){issues.push(`TX ซ้ำ: ${key.slice(0,10)}…`);continue;}
      if(!names.has(item.from)||!names.has(item.member)||item.from===item.member){issues.push('เลือกผู้รับเดิมและผู้รับใหม่ให้ต่างกัน');continue;}
      if(scores.get(item.from)<value){issues.push(`ยอดที่ย้ายจาก ${item.from} เกินคะแนนในแผน`);continue;}
      usedTx.add(key);scores.set(item.from,scores.get(item.from)-value);scores.set(item.member,scores.get(item.member)+value);
    }
  }
  const ranks=[...scores].map(([name,score])=>({name,score:score/100,base:baseline.find(([n])=>n===name)[1],actual:official.indexOf(name)+1||null})).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
  ranks.forEach((row,index)=>row.simulated=index+1);
  const byName=new Map(ranks.map(row=>[row.name,row]));
  const inversions=[];
  for(let i=1;i<official.length;i++)if(byName.get(official[i-1]).score<=byName.get(official[i]).score)inversions.push(`${official[i-1]} / ${official[i]}`);
  return {ranks,byName,allocatedUnknown:allocatedUnknown/100,unknownRemaining:(cents(unknownPool)-allocatedUnknown)/100,issues,inversions};
}
