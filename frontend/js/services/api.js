// GUI's Arc OS API client
// 배포 후 실제 Worker 주소로 바꾸세요.
export const API_BASE = localStorage.getItem("guisArcApiBase") || "https://guis-arc-os-api.workers.dev";

async function request(path, options = {}){
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const json = await res.json().catch(() => ({}));
  if(!res.ok || json.ok === false){
    throw new Error(json.message || `API 오류: ${res.status}`);
  }
  return json;
}

export function setApiBase(url){
  localStorage.setItem("guisArcApiBase", url);
}

export async function createSite(profile){
  return request("/site/create", {
    method: "POST",
    body: JSON.stringify(profile)
  });
}

export async function createDemoSite(){
  return request("/site/demo", {method:"POST"});
}

export async function loginSite(siteCode, pin){
  return request("/site/login", {
    method:"POST",
    body:JSON.stringify({siteCode, pin})
  });
}

export async function saveSiteProfile(siteCode, pin, profile){
  return request("/site/profile", {
    method:"POST",
    body:JSON.stringify({siteCode, pin, profile})
  });
}

export async function getSiteBundle(siteCode, pin){
  const qs = new URLSearchParams({siteCode, pin});
  return request(`/site/bundle?${qs.toString()}`);
}

export async function saveSchedule(siteCode, pin, item){
  return request("/schedule", {
    method:"POST",
    body:JSON.stringify({siteCode, pin, item})
  });
}

export async function listSchedule(siteCode, pin){
  const qs = new URLSearchParams({siteCode, pin});
  return request(`/schedule?${qs.toString()}`);
}

export async function saveDailyWork(siteCode, pin, items){
  return request("/daily-work", {
    method:"POST",
    body:JSON.stringify({siteCode, pin, items})
  });
}
