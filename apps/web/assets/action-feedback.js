const savedLabels=new WeakMap();

function statusElement(target,role="status"){
 if(!target)return null;
 target.setAttribute("role",role);
 target.setAttribute("aria-live",role==="alert"?"assertive":"polite");
 target.setAttribute("aria-atomic","true");
 return target;
}

export function setActionPending(button,{label="처리 중...",status=null,message=label}={}){
 if(!button||button.getAttribute("aria-busy")==="true")return false;
 savedLabels.set(button,button.textContent);
 button.disabled=true;
 button.setAttribute("aria-disabled","true");
 button.setAttribute("aria-busy","true");
 button.innerHTML=`<span class="action-spinner" aria-hidden="true"></span><span>${label}</span>`;
 const region=statusElement(status,"status");if(region){region.className="action-inline-status pending";region.textContent=message}
 return true;
}

export function clearActionPending(button,{label=null}={}){
 if(!button)return;
 button.disabled=false;
 button.removeAttribute("aria-disabled");
 button.removeAttribute("aria-busy");
 button.textContent=label||savedLabels.get(button)||button.textContent;
 savedLabels.delete(button);
}

function toast(message,tone,duration){
 let region=document.querySelector("#action-toast-region");
 if(!region){region=document.createElement("div");region.id="action-toast-region";region.className="action-toast-region";region.setAttribute("aria-live","polite");region.setAttribute("aria-atomic","true");document.body.append(region)}
 region.replaceChildren();const item=document.createElement("div");item.className=`action-toast ${tone}`;item.setAttribute("role",tone==="error"?"alert":"status");const text=document.createElement("span");text.textContent=message;const close=document.createElement("button");close.type="button";close.className="action-toast-close";close.setAttribute("aria-label","알림 닫기");close.textContent="×";close.onclick=()=>item.remove();item.append(text,close);region.append(item);if(duration)setTimeout(()=>item.remove(),duration)
}

export function showActionSuccess(message,{status=null,toastDuration=4000}={}){
 const region=statusElement(status,"status");if(region){region.className="action-inline-status success";region.textContent=message}
 toast(message,"success",toastDuration);
}

export function showActionError(message,{status=null,retryLabel=null,onRetry=null}={}){
 const region=statusElement(status,"alert");if(region){region.className="action-inline-status error";region.replaceChildren(document.createTextNode(message));if(retryLabel&&onRetry){const retry=document.createElement("button");retry.type="button";retry.className="secondary action-retry";retry.textContent=retryLabel;retry.onclick=onRetry;region.append(" ",retry)}}
 toast(message,"error",0);
}

export async function withActionFeedback({button,status,pendingLabel,pendingMessage,successMessage,run}){
 if(!setActionPending(button,{label:pendingLabel,status,message:pendingMessage}))return null;
 try{const result=await run();showActionSuccess(typeof successMessage==="function"?successMessage(result):successMessage,{status});return result}catch(error){showActionError(error.message,{status});throw error}finally{clearActionPending(button)}
}
