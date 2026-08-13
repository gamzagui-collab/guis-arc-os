const get=(row,camel,snake)=>row?.[camel]??row?.[snake];
const cleanLocation=row=>({id:get(row,"id","id"),siteId:get(row,"siteId","site_id"),parentId:get(row,"parentId","parent_id")??null,locationType:get(row,"locationType","location_type"),canonicalKey:get(row,"canonicalKey","canonical_key")??null,displayName:get(row,"displayName","display_name"),sortOrder:get(row,"sortOrder","sort_order"),source:get(row,"source","source"),isActive:Number(get(row,"isActive","is_active"))});
const cleanAlias=row=>({id:get(row,"id","id"),siteId:get(row,"siteId","site_id"),locationId:get(row,"locationId","location_id"),aliasText:get(row,"aliasText","alias_text"),normalizedAlias:get(row,"normalizedAlias","normalized_alias"),aliasType:get(row,"aliasType","alias_type"),source:get(row,"source","source"),isActive:Number(get(row,"isActive","is_active"))});
const same=(a,b,keys)=>keys.every(key=>a[key]===b[key]);
const stable=value=>JSON.stringify(value,Object.keys(value).sort());
function sha256(text){
  const bytes=new TextEncoder().encode(text),length=bytes.length*8,padded=new Uint8Array(((bytes.length+9+63)>>6)<<6);padded.set(bytes);padded[bytes.length]=128;new DataView(padded.buffer).setUint32(padded.length-4,length,false);
  const h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),k=new Uint32Array(64);
  for(let i=0;i<64;i++)k[i]=Math.floor(Math.abs(Math.sin(i+1))*2**32);
  const w=new Uint32Array(64),rotr=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let offset=0;offset<padded.length;offset+=64){const view=new DataView(padded.buffer,offset,64);for(let i=0;i<16;i++)w[i]=view.getUint32(i*4,false);for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2],s0=rotr(a,7)^rotr(a,18)^(a>>>3),s1=rotr(b,17)^rotr(b,19)^(b>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;}let [a,b,c,d,e,f,g,hh]=h;for(let i=0;i<64;i++){const s1=rotr(e,6)^rotr(e,11)^rotr(e,25),ch=(e&f)^(~e&g),t1=(hh+s1+ch+k[i]+w[i])>>>0,s0=rotr(a,2)^rotr(a,13)^rotr(a,22),maj=(a&b)^(a&c)^(b&c),t2=(s0+maj)>>>0;hh=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}for(const [i,v] of [a,b,c,d,e,f,g,hh].entries())h[i]=(h[i]+v)>>>0;}
  return [...h].map(value=>value.toString(16).padStart(8,"0")).join("");
}
const ordered=items=>[...items].sort((a,b)=>String(a.id).localeCompare(String(b.id))||a.type.localeCompare(b.type));

export function buildLocationImportDiff({siteId,normalized,current={}}){
  const currentLocations=(current.locations??[]).map(cleanLocation),currentAliases=(current.aliases??[]).map(cleanAlias);
  const locationById=new Map(currentLocations.map(row=>[row.id,row])),keyOwner=new Map(currentLocations.filter(row=>row.siteId===siteId&&row.canonicalKey).map(row=>[row.canonicalKey,row]));
  const aliasById=new Map(currentAliases.map(row=>[row.id,row])),aliasOwner=new Map(currentAliases.filter(row=>row.siteId===siteId).map(row=>[row.normalizedAlias,row]));
  const operations=[];let unchanged=0,aliasUnchanged=0;
  for(const incoming of normalized.locations??[]){const old=locationById.get(incoming.id),owner=keyOwner.get(incoming.canonicalKey);if(old&&old.siteId!==siteId)operations.push({type:"ERROR",id:incoming.id,code:"LOCATION_IMPORT_CROSS_SITE_REFERENCE"});else if(old&&old.canonicalKey&&old.canonicalKey!==incoming.canonicalKey)operations.push({type:"ERROR",id:incoming.id,code:"LOCATION_IMPORT_IDENTITY_REUSED"});else if(owner&&owner.id!==incoming.id)operations.push({type:"ERROR",id:incoming.id,code:"LOCATION_IMPORT_CANONICAL_KEY_REUSED"});else if(!old)operations.push({type:"ADD",id:incoming.id,after:incoming});else {const after={...incoming,isActive:1};if(same(old,after,["parentId","locationType","canonicalKey","displayName","sortOrder","isActive"]))unchanged++;else operations.push({type:"UPDATE",id:incoming.id,before:old,after});}}
  const incomingIds=new Set((normalized.locations??[]).map(row=>row.id));
  for(const row of currentLocations)if(row.siteId===siteId&&row.source==="IMPORT"&&row.isActive===1&&!incomingIds.has(row.id))operations.push({type:"INACTIVE",id:row.id,before:row,after:{...row,isActive:0}});
  for(const incoming of normalized.aliases??[]){const old=aliasById.get(incoming.id),owner=aliasOwner.get(incoming.normalizedAlias);if(old&&old.siteId!==siteId)operations.push({type:"ERROR",id:incoming.id,code:"LOCATION_IMPORT_CROSS_SITE_REFERENCE"});else if(old&&(old.normalizedAlias!==incoming.normalizedAlias||old.locationId!==incoming.locationId))operations.push({type:"ERROR",id:incoming.id,code:"LOCATION_IMPORT_IDENTITY_REUSED"});else if(owner&&owner.id!==incoming.id)operations.push({type:"ERROR",id:incoming.id,code:"LOCATION_IMPORT_IDENTITY_REUSED"});else if(!old)operations.push({type:"ALIAS_ADD",id:incoming.id,after:incoming});else {const after={...incoming,isActive:1};if(same(old,after,["locationId","aliasText","normalizedAlias","aliasType","isActive"]))aliasUnchanged++;else operations.push({type:"ALIAS_UPDATE",id:incoming.id,before:old,after});}}
  const incomingAliasIds=new Set((normalized.aliases??[]).map(row=>row.id));
  for(const row of currentAliases)if(row.siteId===siteId&&row.source==="IMPORT"&&row.isActive===1&&!incomingAliasIds.has(row.id))operations.push({type:"ALIAS_INACTIVE",id:row.id,before:row,after:{...row,isActive:0}});
  const sorted=ordered(operations),count=type=>sorted.filter(row=>row.type===type).length;
  const relevant={locations:currentLocations.filter(row=>row.siteId===siteId).sort((a,b)=>a.id.localeCompare(b.id)),aliases:currentAliases.filter(row=>row.siteId===siteId).sort((a,b)=>a.id.localeCompare(b.id))};
  return {operations:sorted,counts:{added:count("ADD"),updated:count("UPDATE"),unchanged,inactivated:count("INACTIVE"),aliasAdded:count("ALIAS_ADD"),aliasUpdated:count("ALIAS_UPDATE"),aliasInactivated:count("ALIAS_INACTIVE"),error:count("ERROR")},baseMasterFingerprint:sha256(stable(relevant)),previewHash:sha256(stable(sorted))};
}
