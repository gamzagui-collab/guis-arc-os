export const ISSUE_ASSIGNMENT_TYPES=Object.freeze(["CONTRACTOR","DIRECT","UNASSIGNED"]);

export function inferIssueAssignmentType(body,currentType="UNASSIGNED"){
 if(Object.prototype.hasOwnProperty.call(body,"assignmentType"))return String(body.assignmentType||"").toUpperCase();
 if(body.contractorCompanyId==="__DIRECT__")return "DIRECT";
 if(body.contractorCompanyId==="__UNASSIGNED__"||body.contractorCompanyId===null)return "UNASSIGNED";
 if(body.contractorCompanyId)return "CONTRACTOR";
 return currentType;
}

export const issueStatusForAssignment=assignmentType=>assignmentType==="UNASSIGNED"?"OPEN":"ASSIGNED";
