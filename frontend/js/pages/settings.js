import { loadSettings, saveSettings, exportLocalData, importLocalData } from "../services/settings.js";
import { API_BASE } from "../services/api.js";

export function renderSettings(root){
  const s = loadSettings();
  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>설정 · 백업</h2>
        <p>Worker 주소, 글자 크기, 가독성, 백업/복원을 관리합니다.</p>
      </div>
      <button id="saveSettingsBtn" class="primary-btn">설정 저장</button>
    </div>

    <section class="card">
      <h3>API 연결</h3>
      <label>Worker API 주소
        <input id="apiBaseInput" value="${s.apiBase || API_BASE}" placeholder="https://guis-arc-os-api.xxx.workers.dev">
      </label>
      <p class="help-text">현장코드+PIN, D1 저장, AI 서버 기능은 이 Worker 주소를 사용합니다.</p>
      <div class="export-row">
        <button id="testApiBtn" class="secondary-btn">API 테스트</button>
        <span id="apiTestResult" class="status-pill">대기</span>
      </div>
    </section>

    <section class="card">
      <h3>가독성</h3>
      <div class="form-grid">
        <label>글자 크기
          <select id="fontScaleSelect">
            <option value="normal" ${s.fontScale==="normal"?"selected":""}>보통</option>
            <option value="large" ${s.fontScale==="large"?"selected":""}>크게</option>
            <option value="xlarge" ${s.fontScale==="xlarge"?"selected":""}>아주 크게</option>
          </select>
        </label>
        <label>고대비
          <select id="contrastSelect">
            <option value="false" ${!s.highContrast?"selected":""}>일반</option>
            <option value="true" ${s.highContrast?"selected":""}>고대비</option>
          </select>
        </label>
        <label>화면 밀도
          <select id="compactSelect">
            <option value="false" ${!s.compactMode?"selected":""}>넓게 보기</option>
            <option value="true" ${s.compactMode?"selected":""}>촘촘히 보기</option>
          </select>
        </label>
      </div>
    </section>

    <section class="card">
      <h3>백업 · 복원</h3>
      <p>게스트 데이터와 설정을 JSON 파일로 저장하거나 복원합니다. PC가 바뀔 때 유용합니다.</p>
      <div class="export-row">
        <button id="exportBtn" class="primary-btn">백업 다운로드</button>
        <label class="file-button">백업 복원<input id="importInput" type="file" accept=".json" hidden></label>
      </div>
    </section>

    <section class="card">
      <h3>운영 체크</h3>
      <div class="action-list">
        <label class="action-item"><input type="checkbox"> GitHub push 후 Pages 자동/수동 배포 확인</label>
        <label class="action-item"><input type="checkbox"> D1 스키마 적용 후 DEMO-001 / 1234 접속 확인</label>
        <label class="action-item"><input type="checkbox"> Worker /health 응답 확인</label>
      </div>
    </section>
  `;

  root.querySelector("#saveSettingsBtn").addEventListener("click", () => {
    const settings = {
      apiBase: root.querySelector("#apiBaseInput").value.trim(),
      fontScale: root.querySelector("#fontScaleSelect").value,
      highContrast: root.querySelector("#contrastSelect").value === "true",
      compactMode: root.querySelector("#compactSelect").value === "true"
    };
    saveSettings(settings);
    alert("설정을 저장했습니다.");
  });

  root.querySelector("#testApiBtn").addEventListener("click", async () => {
    const out = root.querySelector("#apiTestResult");
    out.textContent = "테스트 중...";
    try{
      const base = root.querySelector("#apiBaseInput").value.trim();
      const res = await fetch(`${base}/health`, {cache:"no-store"});
      const json = await res.json();
      out.textContent = json.ok ? `정상 · ${json.version || ""}` : "응답 오류";
      out.className = "status-pill ok";
    }catch(error){
      out.textContent = "실패";
      out.className = "status-pill fail";
    }
  });

  root.querySelector("#exportBtn").addEventListener("click", exportLocalData);
  root.querySelector("#importInput").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    try{
      await importLocalData(file);
      alert("복원 완료. 화면을 새로고침합니다.");
      location.reload();
    }catch(error){
      alert("복원 실패: " + error.message);
    }
  });
}
