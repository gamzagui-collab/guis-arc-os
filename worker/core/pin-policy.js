export function pinValidationError(pin){
 const value=String(pin||"");
 if(!/^[0-9]{4}$/.test(value))return "PIN은 숫자 4자리여야 합니다.";
 const digits=[...value].map(Number),step=digits[1]-digits[0];
 if(new Set(digits).size===1||([1,-1].includes(step)&&digits.every((digit,index)=>index===0||digit-digits[index-1]===step)))return "반복되거나 연속된 단순 PIN은 사용할 수 없습니다.";
 return null;
}

export function validateFourDigitPin(pin){
 const error=pinValidationError(pin);
 if(error)throw new Error(error);
 return String(pin);
}
