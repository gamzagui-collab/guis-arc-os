const SQLITE_UTC_TIMESTAMP=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

export function formatIssuePhotoDateKst(value){
 const source=String(value||"").trim();
 if(!source)return"";
 const date=new Date(SQLITE_UTC_TIMESTAMP.test(source)?`${source.replace(" ","T")}Z`:source);
 if(Number.isNaN(date.getTime()))return"";
 const parts=Object.fromEntries(new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",weekday:"short"}).formatToParts(date).map(part=>[part.type,part.value]));
 return `${parts.year}.${parts.month}.${parts.day}(${String(parts.weekday||"").slice(0,1)})`;
}

export function fitWatermarkLocation(value,maxWidth,measure){
 const text=String(value||"위치 정보 없음");
 if(maxWidth<=0)return"";
 if(measure(text)<=maxWidth)return text;
 const suffix="…";
 let low=0,high=text.length;
 while(low<high){const mid=Math.ceil((low+high)/2);if(measure(text.slice(0,mid)+suffix)<=maxWidth)low=mid;else high=mid-1}
 return low?text.slice(0,low)+suffix:suffix;
}
