import { state, loadLocal, saveLocal, setCurrentSiteProfile, startGuestSite } from "./state.js";
import { applyVersionToDocument } from "../services/version.js";
import { migrateLegacyWorkData } from "../services/workInstanceDatabase.js";
import { migrateQualityData } from "../services/qualityManagement.js";
import { migrateConstructionData } from "../services/constructionManagement.js";
import { migrateRoleSeparatedDataV981 } from "../services/roleDataMigration.js";
import { migrateResourceData } from "../services/resourceManagement.js";
import { migrateComplianceData } from "../services/complianceAudit.js";
import { migrateEvidenceData } from "../services/evidenceManagement.js";
import { ensureDirectorInstructionState } from "../services/directorInstructions.js";
import { renderDashboard } from "../pages/dashboard.js";
import { renderToday } from "../pages/today.js";
import { renderWorkHub } from "../pages/workHub.js";
import { renderKnowledge } from "../pages/knowledge.js";
import { renderWeather } from "../pages/weather.js";
import { renderSite } from "../pages/site.js";
import { renderQuality } from "../pages/quality.js";
import { renderSchedule } from "../pages/schedule.js";
import { renderBriefing } from "../pages/briefing.js";
import { renderChat } from "../pages/chat.js";
import { renderSettings } from "../pages/settings.js";
import { renderDirectorDashboard } from "../pages/directorDashboard.js";
import { renderResource } from "../pages/resource.js";
import { renderConstruction } from "../pages/construction.js";
import { renderSafety } from "../pages/safety.js";
import { renderRoleScope } from "../pages/roleScope.js";
import { migrateTaskRoleClassification } from "../services/taskRoleClassification.js";
import { migrateRoleTaskGeneration } from "../services/roleTaskGenerationEngine.js";
import { migrateWorkStartConditionData } from "../services/workStartConditionEngine.js";
import { migrateSimpleActionFlow } from "../services/simpleActionFlow.js";

const PAGE_RENDERERS = {
  dashboardPage: renderDashboard,
  todayPage: renderToday,
  workHubPage: renderWorkHub,
  directorPage: renderDirectorDashboard,
  safetyPage: renderSafety,
  qualityPage: renderQuality,
  constructionPage: renderConstruction,
  resourcePage: renderResource,
  roleScopePage: renderRoleScope,
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


function showLogin(){
  document.querySelector("#homePage")?.classList.remove("active");
  document.querySelector("#loginPage")?.classList.add("active");
  document.querySelectorAll(".main-tabs .tab").forEach((t, i) => t.classList.toggle("active", i === 0));
  document.querySelectorAll("#homePage .subpage").forEach((p, i) => p.classList.toggle("active", i === 0));
  updateHeaderSite();
  window.scrollTo({top:0, behavior:"smooth"});
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

  document.querySelector("#resetLoginBtn")?.addEventListener("click", () => {
    delete state.siteProfile;
    delete state.site;
    saveLocal();
    showLogin();
  });
}


function applySimpleMode(){
  const enabled = state.uiSimpleMode !== false;
  document.body.classList.toggle("simple-mode", enabled);
  const btn = document.querySelector("#simpleModeBtn");
  if(btn){
    btn.setAttribute("aria-pressed", String(enabled));
    btn.textContent = enabled ? "간편화면 사용중" : "간편화면 보기";
    btn.title = enabled ? "누르면 상세화면으로 전환" : "누르면 간편화면으로 전환";
  }
}
function bindSimpleMode(){
  document.querySelector("#simpleModeBtn")?.addEventListener("click",()=>{
    state.uiSimpleMode = !(state.uiSimpleMode !== false);
    saveLocal();
    applySimpleMode();
    renderActivePage();
  });
}

function updateHeaderSite(){const el=document.querySelector("#headerSiteName");if(el)el.textContent=state.site?.siteName||state.siteProfile?.siteName||"Guest";const chip=document.querySelector(".user-chip");if(chip)chip.textContent=state.site?.siteCode||state.siteProfile?.siteCode||"Guest";}
function bindMobileMenu(){const btn=document.querySelector("#mobileMenuBtn");const tabs=document.querySelector(".header-tabs");btn?.addEventListener("click",()=>tabs?.classList.toggle("open"));}
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
      document.querySelector(".header-tabs")?.classList.remove("open");
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
  applyVersionToDocument();
  loadLocal();
  migrateLegacyWorkData();
  migrateQualityData();
  migrateConstructionData();
  migrateRoleSeparatedDataV981();
  migrateResourceData();
  migrateComplianceData();
  migrateEvidenceData();
  ensureDirectorInstructionState();
  migrateTaskRoleClassification();
  migrateRoleTaskGeneration();
  migrateWorkStartConditionData();
  migrateSimpleActionFlow();
  saveLocal();
  bindLogin();
  bindTabs();
  bindMobileMenu();
  bindSimpleMode();
  applySimpleMode();
  updateHeaderSite();
  ensureInitialRoute();
  if(state.siteProfile || state.site?.siteCode) showHome();
  else showLogin();
});
