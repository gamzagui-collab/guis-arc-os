import {escapeHtml} from "../../../packages/ui/components.js";

const clean=value=>String(value??"").trim().replace(/\s+/g," ");

export const constructionWorkforceText=value=>{
 if(value===null||value===undefined||value==="")return "인원 확인 필요";
 const parsed=Number(value);
 return Number.isFinite(parsed)?`${parsed}명`:"인원 확인 필요";
};

export const constructionWorkItemParts=item=>{
 const trade=clean(item?.displayTrade||item?.trade||(item?.trades||[]).join(", "))||"공종 미기재";
 const workforceValue=item?.workforceRegistered===false?null:Object.prototype.hasOwnProperty.call(item||{},"plannedWorkforce")?item.plannedWorkforce:item?.total;
 const workforce=constructionWorkforceText(workforceValue);
 const description=item?.isFallbackWorkItem?"노코멘트":clean(item?.description??item?.name)||"작업내용 미기재";
 return {trade,workforce,description};
};

export const constructionWorkItemHtml=item=>{
 const {trade,workforce,description}=constructionWorkItemParts(item);
  return `<span class="construction-work-item__line"><strong class="construction-work-item__trade">${escapeHtml(`${trade}(${workforce})`)}</strong><span class="construction-work-item__separator" aria-hidden="true"> - </span><span class="construction-work-item__description">${escapeHtml(description)}</span></span>`;
};
