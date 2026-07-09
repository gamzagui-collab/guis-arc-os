import { state, loadLocal, setCurrentSiteProfile, startGuestSite } from "./state.js";
import { renderDashboard } from "../pages/dashboard.js";
import { renderToday } from "../pages/today.js";
import { renderKnowledge } from "../pages/knowledge.js";
import { renderWeather } from "../pages/weather.js";
import { renderSite } from "../pages/site.js";
import { renderQuality } from "../pages/quality.js";
import { renderSchedule } from "../pages/schedule.js";
import { renderBriefing } from "../pages/briefing.js";
import { renderChat } from "../pages/chat.js";
import { renderSettings } from "../pages/settings.js";
import { renderDirector, renderSafetyRole, renderConstructionRole, renderResourceRole } from "../pages/rolePage.js";

const PAGE_RENDERERS = {
  dashboardPage: renderDashboard,
  todayPage: renderToday,
  directorPage: renderDirector,
  safetyPage: renderSafetyRole,
  qualityPage: renderQuality,
  constructionPage: renderConstructionRole,
  resourcePage: renderResourceRole,
  knowledgePage: renderKnowledge,
  sitePage: renderSite,
  schedulePage: renderSchedule,
  weatherPage: renderWeather,
  briefingPage: renderBriefing,
  chatPage: renderChat,
  settingsPage: renderSettings
};

function renderError(root, pageId, error){
  root.innerHTML = `<section class="card risk-red">
    <h2>화면 로딩 오류</h2>
    <p>${pageId} 화면을 불러오는 중 오류가 발생했습니다.</p>
    <pre class="tbm-box">${error.message}</pre>
  </section>`;
}

export function renderPage(pageId){
  const root = document.getElementById(pageId);
  const renderer = PAGE_RENDERERS[pageId];
  if(!root || !renderer) return;
  try{ renderer(root); }catch(error){ console.error(error); renderError(root, pageId, error); }
}

export function renderActivePage(){
  const active = document.querySelector("#homePage .subpage.active") || document.querySelector("#dashboardPage");
  if(active) renderPage(active.id);
}

function showHome(){
  document.querySelector("#loginPage")?.classList.remove("active");
  document.querySelector("#homePage")?.classList.add("active");
  renderActivePage();
}

function bindLogin(){
  document.querySelector("#guestStartBtn")?.addEventListener("click", () => {
    startGuestSite();
    showHome();
  });

  document.querySelector("#openCreateSiteBtn")?.addEventListener("click", () => {
    const panel = document.querySelector("#createSitePanel");
    if(panel) panel.hidden = !panel.hidden;
  });

  document.querySelector("#createSiteBtn")?.addEventListener("click", () => {
    const profile = {
      mode: "local-site",
      siteName: document.querySelector("#newSiteName")?.value || "새 현장",
      siteCode: (document.querySelector("#newSiteCode")?.value || "SITE-" + Date.now()).toUpperCase(),
      pin: document.querySelector("#newSitePin")?.value || "1234",
      siteType: document.querySelector("#newSiteType")?.value || "school",
      clientName: document.querySelector("#newClientName")?.value || "",
      contractorName: document.querySelector("#newContractorName")?.value || "",
      supervisorName: document.querySelector("#newSupervisorName")?.value || "",
      scaleText: document.querySelector("#newScaleText")?.value || "",
      createdAt: new Date().toISOString()
    };
    setCurrentSiteProfile(profile);
    showHome();
  });

  document.querySelector("#siteLoginBtn")?.addEventListener("click", () => {
    const siteCode = (document.querySelector("#siteCodeInput")?.value || "").trim().toUpperCase();
    const pin = document.querySelector("#sitePinInput")?.value || "";
    setCurrentSiteProfile({mode:"site-login", siteName:siteCode || "현장", siteCode:siteCode || "SITE", pin, siteType:"school"});
    showHome();
  });
}

function bindTabs(){
  const tabs = [...document.querySelectorAll(".main-tabs .tab")];
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const pageId = tab.dataset.page;
      if(!pageId) return;
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll("#homePage .subpage").forEach(page => {
        page.classList.toggle("active", page.id === pageId);
      });
      renderPage(pageId);
      window.scrollTo({top:0, behavior:"smooth"});
    });
  });
}

function ensureInitialRoute(){
  const activeTab = document.querySelector(".main-tabs .tab.active") || document.querySelector(".main-tabs .tab");
  if(!activeTab) return;
  const pageId = activeTab.dataset.page;
  document.querySelectorAll(".main-tabs .tab").forEach(t => t.classList.toggle("active", t === activeTab));
  document.querySelectorAll("#homePage .subpage").forEach(p => p.classList.toggle("active", p.id === pageId));
}

document.addEventListener("DOMContentLoaded", () => {
  loadLocal();
  bindLogin();
  bindTabs();
  ensureInitialRoute();
  if(state.siteProfile || state.site?.siteCode) showHome();
  else renderActivePage();
});
