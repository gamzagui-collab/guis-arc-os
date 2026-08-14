export function drawCloudPath(ctx,from,to){
 const left=Math.min(from.x,to.x),right=Math.max(from.x,to.x),top=Math.min(from.y,to.y),bottom=Math.max(from.y,to.y),width=right-left,height=bottom-top,cx=left+width/2,cy=top+height/2;
 ctx.moveTo(left+width*.18,bottom-height*.16);
 ctx.bezierCurveTo(left-width*.04,cy+height*.08,left+width*.02,top+height*.34,left+width*.22,top+height*.34);
 ctx.bezierCurveTo(left+width*.2,top+height*.08,left+width*.42,top-height*.04,cx,top+height*.2);
 ctx.bezierCurveTo(left+width*.66,top-height*.08,right-width*.12,top+height*.02,right-width*.16,top+height*.3);
 ctx.bezierCurveTo(right+width*.06,top+height*.3,right+width*.06,bottom-height*.22,right-width*.14,bottom-height*.18);
 ctx.bezierCurveTo(right-width*.18,bottom+height*.04,cx+width*.08,bottom+height*.06,cx,bottom-height*.12);
 ctx.bezierCurveTo(left+width*.36,bottom+height*.08,left+width*.12,bottom+height*.04,left+width*.18,bottom-height*.16);
 ctx.closePath();
}
