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

const cleanShareText=value=>String(value||"").replace(/\s+/g," ").trim();
const escapePattern=value=>value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

export function issueShareDisplay(issue={}){
 const rawLocation=cleanShareText(issue.location)||"위치 정보 없음",description=cleanShareText(issue.description||issue.title);
 const canonicalCount=[issue.buildingLocationId,issue.floorLocationId,issue.unitLocationId,issue.roomLocationId].filter(Boolean).length;
 if(!canonicalCount)return {location:rawLocation,content:description||"내용 없음"};
 const parts=rawLocation.split(/\s*\/\s*/).map(cleanShareText).filter(Boolean),structuralParts=parts.slice(0,canonicalCount),detail=parts.slice(canonicalCount).join(" / ");
 const location=structuralParts.join(" / ")||rawLocation;
 let content=description;
 for(const part of structuralParts)content=content.replace(new RegExp(escapePattern(part),"g")," ");
 content=content.replace(/(?:\s*[/>·,]\s*)+/g," ").replace(/\s+/g," ").trim();
 if(detail&&content){
  if(content.startsWith(detail))return {location,content};
  if(detail.startsWith(content))return {location,content:detail};
  return {location,content:`${detail} ${content}`};
 }
 return {location,content:detail||content||"내용 없음"};
}

export function wrapWatermarkContent(value,maxWidth,measure,maxLines=2){
 const words=cleanShareText(value).split(" ").filter(Boolean),lines=[];
 let line="";
 for(let index=0;index<words.length;index++){
  const next=line?`${line} ${words[index]}`:words[index];
  if(measure(next)<=maxWidth){line=next;continue}
  if(line){lines.push(line);line=""}
  if(lines.length>=maxLines-1){lines.push(fitWatermarkLocation(words.slice(index).join(" "),maxWidth,measure));return lines}
  if(measure(words[index])>maxWidth){lines.push(fitWatermarkLocation(words[index],maxWidth,measure));if(index<words.length-1&&lines.length<maxLines)lines.push(fitWatermarkLocation(words.slice(index+1).join(" "),maxWidth,measure));return lines}
  line=words[index];
 }
 if(line&&lines.length<maxLines)lines.push(line);
 return lines;
}

export function issueShareWatermarkLayout(width,height){
 const padding=28,gap=Math.max(18,Math.round(width*.018)),locationSize=Math.max(24,Math.round(width*.032));
 const contentSize=locationSize*.8,dateSize=locationSize*.6;
 const dateWidthBudget=Math.round(dateSize*7.6),contentLineHeight=Math.max(34,Math.round(contentSize*1.25));
 const footerHeight=Math.min(height,22+Math.max(locationSize,dateSize)+12+contentLineHeight*2+padding);
 return {padding,gap,locationSize,contentSize,dateSize,dateWidthBudget,contentLineHeight,footerHeight,locationMaxWidth:Math.max(0,width-padding*2-dateWidthBudget-gap),contentTop:height-footerHeight+22+Math.max(locationSize,dateSize)+12};
}
