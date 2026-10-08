import Link from 'next/link';
import { ge6CandidateByName } from '@/lib/ge6-candidates';
// Round profile photos in the given order, first on the left; each opens that member's page.
// Photos come from scripts/member-photos.mjs.
export default function MemberAvatars({names,captions=false}:{names:string[];captions?:boolean}){
  return <span className={captions?'member-avatars with-captions':'member-avatars'}>{names.map(name=>{
    const known=ge6CandidateByName.get(name.toLowerCase());
    if(!known)return <span className="member-avatar-item" key={name}><span className="member-avatar-fallback" title={name} aria-label={name}>{name.slice(0,1).toUpperCase()}</span>{captions&&<span>{name}</span>}</span>;
    return <Link className="member-avatar-item" key={name} href={`/member/${encodeURIComponent(known)}`} prefetch={false} title={known} aria-label={captions?undefined:known}>
      <img src={`/members/${known.toLowerCase()}.webp`} alt="" width={64} height={64} loading="lazy" decoding="async"/>{captions&&<span>{known}</span>}
    </Link>;
  })}</span>;
}
