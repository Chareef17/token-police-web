import { ge6CandidateByName } from '@/lib/ge6-candidates';
// Round profile photos in the given order, first on the left. Photos come from scripts/member-photos.mjs.
export default function MemberAvatars({names,captions=false}:{names:string[];captions?:boolean}){
  return <span className={captions?'member-avatars with-captions':'member-avatars'}>{names.map(name=>{
    const known=ge6CandidateByName.get(name.toLowerCase());
    const face=known?<img src={`/members/${known.toLowerCase()}.webp`} alt={captions?'':known} title={known} width={64} height={64} loading="lazy" decoding="async"/>:<span className="member-avatar-fallback" title={name} aria-label={captions?undefined:name}>{name.slice(0,1).toUpperCase()}</span>;
    return captions?<span className="member-avatar-item" key={name}>{face}<span>{known??name}</span></span>:<span className="member-avatar-item" key={name}>{face}</span>;
  })}</span>;
}
