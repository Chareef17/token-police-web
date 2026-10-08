// GE2026's 58 declared BNK48/CGM48 candidates. Keep this separate from historical vote data;
// a former member can have old votes without being a GE6 candidate.
// Roster cross-checked against https://48pedia.org/BNK48_%26_CGM48_%E9%81%B8%E6%8A%9C%E7%B7%8F%E9%81%B8%E6%8C%99_2026
export const ge6CandidateNames=[
  'Arlee','Berry','Blythe','Cartoon','Emmy','Fame','Galeya','Grape','Hoop','Inkcha',
  'Janry','Jew','Khaimook','Khowjow','L','Luksorn','Mail','Marine','Mayji','Micha',
  'Mint','Mirin','Monet','Nall','Nammonn','Neen','Niya','Palmmy','Pancake','Patt',
  'Praew','Proud','Rose','Saonoi','Sindy','Wawa','Yoghurt',
  'Else','Ginna','Jingjing','Kwan','Lingling','Lookked','Nana','Nisha','Ploen','Prae',
  'Chifa','Emma','Hongyok','Lewlew','Namphet','Praifa','Punpon','Satangpound',
  'Shenae','Tara','Valentine',
] as const;
export const ge6Candidates=new Set(ge6CandidateNames.map(name=>name.toLowerCase()));
// The first 37 names are BNK48 members, the rest CGM48.
export const ge6CandidateGroup=(name:string)=>ge6CandidateNames.indexOf(name as typeof ge6CandidateNames[number])<37?'BNK48':'CGM48';
export const ge6CandidateByName=new Map(ge6CandidateNames.map(name=>[name.toLowerCase(),name]));
