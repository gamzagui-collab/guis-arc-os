export const statusBadge=(text,tone="info")=>`<span class="status-badge ${tone}">${escapeHtml(text)}</span>`;
export const emptyState=(title,description)=>`<section class="empty-state"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></section>`;
export const errorState=message=>`<section class="error-state" role="alert"><strong>오류</strong><p>${escapeHtml(message)}</p></section>`;
export const loadingSkeleton=()=>'<div class="loading-skeleton" aria-label="불러오는 중"></div>';
export const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
