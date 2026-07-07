export function renderChat(root){
  root.innerHTML = `<div class="section-head"><div><h2>현장채팅 · 지시사항</h2><p>현장소장 지시와 관리자 답변을 기록합니다.</p></div></div>
  <section class="card"><h3>오늘 지시</h3><div class="action-list"><label class="action-item"><input type="checkbox"> 3층 슬래브 타설 전 감리검측 완료 확인</label><label class="action-item"><input type="checkbox"> 오후 강풍 예보 시 크레인 양중작업 재검토</label></div><div class="export-row"><button class="primary-btn">지시 추가</button><button class="secondary-btn">읽음 확인</button></div></section>`;
}
