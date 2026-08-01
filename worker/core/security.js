const enc=new TextEncoder();
export const hex=bytes=>[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,"0")).join("");
export const sha256=async value=>hex(await crypto.subtle.digest("SHA-256",enc.encode(value)));
export const randomToken=(bytes=32)=>{const value=new Uint8Array(bytes);crypto.getRandomValues(value);return btoa(String.fromCharCode(...value)).replaceAll("+","-").replaceAll("/","_").replaceAll("=","")};
export async function deriveCredential(secret,salt,iterations=100000){const key=await crypto.subtle.importKey("raw",enc.encode(secret),"PBKDF2",false,["deriveBits"]);return hex(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:enc.encode(salt),iterations},key,256))}
export const safeEqual=(a,b)=>{if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0};
export const cookie=(name,value,maxAge)=>`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
export const csrfCookie=(name,value,maxAge)=>`${name}=${encodeURIComponent(value)}; Path=/; Secure; SameSite=Lax; Max-Age=${maxAge}`;
