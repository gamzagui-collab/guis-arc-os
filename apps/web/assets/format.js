export const digits=value=>String(value||"").replace(/\D/g,"");
export function formatPhone(value){
 const number=digits(value).slice(0,11);
 if(number.length<=3)return number;
 if(number.length<=7)return `${number.slice(0,3)}-${number.slice(3)}`;
 return `${number.slice(0,3)}-${number.slice(3,7)}-${number.slice(7)}`;
}
export function formatBusinessNumber(value){
 const number=digits(value).slice(0,10);
 if(number.length<=3)return number;
 if(number.length<=5)return `${number.slice(0,3)}-${number.slice(3)}`;
 return `${number.slice(0,3)}-${number.slice(3,5)}-${number.slice(5)}`;
}
export const canonicalPhone=value=>digits(value).slice(0,11);
export const canonicalBusinessNumber=value=>digits(value).slice(0,10);
export function bindNumericFormat(input,formatter){
 const update=()=>{input.value=formatter(input.value)};
 input.addEventListener("input",update);
 input.addEventListener("paste",()=>queueMicrotask(update));
 update();
}
