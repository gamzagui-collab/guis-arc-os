export const APP_VERSION = "9.8.8";
export const APP_NAME = "GUI's Arc OS";
export const APP_SUBTITLE = "Construction Site Decision Platform";
export const RELEASE_NAME = "Simple Mode Final · Photo First Action";

export function versionLabel(){
  return `v${APP_VERSION}`;
}

export function applyVersionToDocument(){
  document.title = `${APP_NAME} v${APP_VERSION}`;
  document.querySelectorAll("[data-app-version]").forEach((el) => { el.textContent = versionLabel(); });
  document.querySelectorAll("[data-app-name]").forEach((el) => { el.textContent = APP_NAME; });
  document.querySelectorAll("[data-app-subtitle]").forEach((el) => { el.textContent = APP_SUBTITLE; });
}
