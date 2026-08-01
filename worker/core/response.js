export class ApiError extends Error{
 constructor(status,code,message,{field,details}={}){
  super(message);this.status=status;this.code=code;this.field=field;this.details=details
 }
}
export const json=(body,status=200,headers={})=>{const output=new Headers({"content-type":"application/json; charset=utf-8","cache-control":"no-store"});for(const [name,value] of Object.entries(headers)){if(Array.isArray(value))for(const item of value)output.append(name,item);else output.set(name,value)}return new Response(JSON.stringify(body),{status,headers:output})};
export const parseJson=async request=>{try{return await request.json()}catch{throw new ApiError(400,"INVALID_JSON","요청 본문이 올바른 JSON이 아닙니다.")}};
export const requestId=request=>request.headers.get("x-request-id")||crypto.randomUUID();
