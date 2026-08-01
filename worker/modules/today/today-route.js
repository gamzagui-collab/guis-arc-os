import {json} from "../../core/response.js";
import {authenticate,context} from "../../core/session.js";
import {todayScope} from "./today-policy.js";
import {buildToday} from "./today-service.js";

const serverTiming=values=>Object.entries(values).map(([name,value])=>`${name};dur=${Math.max(0,Number(value)||0).toFixed(2)}`).join(", ");
export async function handleTodayRequest(request,env){const started=performance.now(),row=await authenticate(request,env),ctx=await context(env,row),scopeStarted=performance.now(),scope=await todayScope(env,row,ctx),scopeMs=performance.now()-scopeStarted,service=await buildToday(env,row,ctx,scope),serializationStarted=performance.now(),payload=service.payload,serialization=performance.now()-serializationStarted,total=performance.now()-started;return json(payload,200,{"server-timing":serverTiming({scope:scopeMs,...service.timing,serialization,total})})}
