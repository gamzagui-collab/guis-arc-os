export async function deliverIssueShareFile(file,{share,canShare,download}={}){
 const supported=typeof share==="function"&&(!canShare||canShare({files:[file]}));
 if(!supported){download(file);return"DOWNLOADED"}
 try{await share({files:[file]});return"SHARED"}catch(error){if(error?.name==="AbortError")return"CANCELLED";download(file);return"DOWNLOADED"}
}
