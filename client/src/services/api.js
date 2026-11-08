import { API_BASE as BASE } from './urls';
export function token(){return localStorage.getItem('oficinapro_token')}
export async function api(path,options={}){const headers={'Content-Type':'application/json',...(options.headers||{})};if(token())headers.Authorization=`Bearer ${token()}`;const response=await fetch(`${BASE}${path}`,{...options,headers});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'Não foi possível concluir a solicitação.');return data}
