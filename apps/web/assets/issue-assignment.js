export const assignmentTypeForCompany=value=>value==="__DIRECT__"?"DIRECT":value==="__UNASSIGNED__"||value==="__CLEAR__"?"UNASSIGNED":value?"CONTRACTOR":null;

export function assignmentPayload({companyId,tradeId,assigneeUserId,revision}){
 const assignmentType=assignmentTypeForCompany(companyId),payload={revision};
 if(!assignmentType)return payload;
 payload.assignmentType=assignmentType;
 payload.contractorCompanyId=assignmentType==="CONTRACTOR"?companyId:null;
 payload.tradeId=tradeId||null;
 payload.assigneeUserId=assignmentType==="UNASSIGNED"?null:assigneeUserId||null;
 return payload;
}
