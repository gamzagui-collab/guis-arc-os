const integer=value=>Number.isInteger(Number(value))?Number(value):0;
const safeIndex=(value,length)=>{const parsed=integer(value);return parsed>=0&&parsed<length?parsed:0};
const roleOf=media=>media?.mediaRole||media?.media_role;
const orderOf=media=>Number(media?.sortOrder??media?.sort_order??0);

export function creationPhotos(detail){
  return [...(detail?.media||[])].filter(media=>roleOf(media)==="CREATION").sort((left,right)=>orderOf(left)-orderOf(right)||String(left?.created_at||"").localeCompare(String(right?.created_at||"")));
}

const representative=issue=>({id:`representative:${issue.id}`,thumbnailUrl:issue.thumbnailUrl||`/api/v1/issues/${issue.id}/media/thumbnail`,originalUrl:`/api/v1/issues/${issue.id}/media/original`});

export function createIssuePhotoViewerState({issues=[],initialIssueIndex=0,initialPhotoIndex=0,loadDetail,onChange}={}){
  let issueIndex=safeIndex(initialIssueIndex,issues.length),photoIndex=0,error="",loading=false;
  const cache=new Map(),pending=new Map();
  const issue=()=>issues[issueIndex];
  const photosFor=current=>cache.get(current?.id)||[representative(current)];
  const notify=()=>onChange?.(snapshot());
  function snapshot(){
    const current=issue(),photos=current?photosFor(current):[],knownCount=cache.has(current?.id)?photos.length:Math.max(1,Number(current?.creationMediaCount||1));
    photoIndex=safeIndex(photoIndex,Math.max(1,photos.length));
    const rawPhoto=photos[photoIndex]||photos[0]||null,photo=rawPhoto?{...rawPhoto,url:rawPhoto.thumbnailUrl||rawPhoto.originalUrl}:null;
    return {issue:current,issueIndex,photoIndex,photo,photoCount:knownCount,label:`이슈 ${issues.length?issueIndex+1:0}/${issues.length} · 사진 ${photoIndex+1}/${knownCount}`,loading,error,canMoveIssueBack:issueIndex>0,canMoveIssueForward:issueIndex<issues.length-1,canMovePhotoBack:photoIndex>0,canMovePhotoForward:photoIndex<photos.length-1};
  }
  photoIndex=safeIndex(initialPhotoIndex,photosFor(issue()).length);
  async function ensurePhotos(){
    const current=issue();if(!current||cache.has(current.id))return snapshot();
    if(pending.has(current.id))return pending.get(current.id);
    error="";loading=true;notify();
    const request=Promise.resolve().then(()=>loadDetail(current.id)).then(detail=>{
      const photos=creationPhotos(detail);cache.set(current.id,photos.length?photos:[representative(current)]);
      if(issue()?.id===current.id)photoIndex=safeIndex(photoIndex,cache.get(current.id).length);
      return snapshot();
    }).catch(cause=>{if(issue()?.id===current.id)error="사진 목록을 불러오지 못했습니다.";throw cause}).finally(()=>{pending.delete(current.id);if(issue()?.id===current.id){loading=false;notify()}});
    pending.set(current.id,request);return request;
  }
  function movePhoto(amount){const photos=photosFor(issue()),next=Math.max(0,Math.min(photoIndex+amount,photos.length-1));if(next!==photoIndex){photoIndex=next;notify()}return snapshot()}
  function moveIssue(amount){const next=Math.max(0,Math.min(issueIndex+amount,issues.length-1));if(next===issueIndex)return Promise.resolve(snapshot());issueIndex=next;photoIndex=0;error="";notify();return ensurePhotos()}
  function retry(){error="";return ensurePhotos()}
  return {snapshot,ensurePhotos,movePhoto,moveIssue,retry};
}
