export function compareRanks(forecastRows,actualNames){
  const predicted=new Map(forecastRows.map(row=>[row.name.toLowerCase(),row]));
  const rows=actualNames.map((name,index)=>{
    const forecast=predicted.get(name.toLowerCase());
    if(!forecast)throw new Error(`Unknown actual GE6 member: ${name}`);
    const actualRank=index+1;
    return {name:forecast.name,actualRank,predictedRank:forecast.rank,rankDifference:forecast.rank-actualRank,
      bestRank:forecast.bestRank,worstRank:forecast.worstRank,
      withinRange:actualRank>=forecast.bestRank&&actualRank<=forecast.worstRank,
      predictedScore:forecast.amount};
  });
  return {rows,compared:rows.length,exact:rows.filter(row=>row.rankDifference===0).length,
    withinRange:rows.filter(row=>row.withinRange).length,
    meanAbsoluteError:rows.length?rows.reduce((sum,row)=>sum+Math.abs(row.rankDifference),0)/rows.length:null};
}
