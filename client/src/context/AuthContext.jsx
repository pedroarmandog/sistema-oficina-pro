import {createContext,useContext,useEffect,useState} from 'react';
import {api} from '../services/api';
const Ctx=createContext(null);export const useAuth=()=>useContext(Ctx);
export function AuthProvider({children}){
 const [user,setUser]=useState(()=>JSON.parse(localStorage.getItem('oficinapro_user')||'null'));
 const [company,setCompanyState]=useState(()=>JSON.parse(localStorage.getItem('oficinapro_company')||'null'));
 const [loading,setLoading]=useState(false);
 const setCompany=(next)=>{setCompanyState(next);if(next)localStorage.setItem('oficinapro_company',JSON.stringify(next));};
 const save=data=>{localStorage.setItem('oficinapro_token',data.token);localStorage.setItem('oficinapro_user',JSON.stringify(data.user));localStorage.setItem('oficinapro_company',JSON.stringify(data.company));setUser(data.user);setCompanyState(data.company)};
 const login = async (email, password) => {
  setLoading(true);
  try {
   const data = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
   });
   save(data);
   try {
    const fresh = await api('/company');
    setCompany(fresh);
   } catch {
    // Mantém os dados da empresa retornados pelo login se a atualização falhar.
   }
  } finally {
   setLoading(false);
  }
 };
 const register = async (form) => {
  setLoading(true);
  try {
   const data = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify(form)
   });
   save(data);
  } finally {
   setLoading(false);
  }
 };
 const logout=()=>{['oficinapro_token','oficinapro_user','oficinapro_company'].forEach(k=>localStorage.removeItem(k));setUser(null);setCompanyState(null)};
 useEffect(()=>{if(!user||!localStorage.getItem('oficinapro_token'))return;let alive=true;api('/company').then(c=>{if(alive)setCompany(c)}).catch(()=>{});return()=>{alive=false}},[user?.id]);
 useEffect(()=>{
  const theme=localStorage.getItem('oficinapro_theme')||'dark';document.documentElement.dataset.theme=theme;
  const defaults=theme==='light'?{primary:'#2563eb',secondary:'#f3f6fb'}:{primary:company?.primaryColor||'#2563eb',secondary:company?.secondaryColor||'#0f172a'};
  const resetPalette=localStorage.getItem('oficinapro_theme_defaults')==='1';
  const primary=resetPalette?defaults.primary:(company?.primaryColor||defaults.primary);
  const secondary=resetPalette?defaults.secondary:(company?.secondaryColor||defaults.secondary);
  document.documentElement.style.setProperty('--primary',primary);
  document.documentElement.style.setProperty('--secondary',secondary);
  document.documentElement.style.setProperty('--app-bg',secondary);
  document.documentElement.style.setProperty('--sidebar-bg',theme==='light'?'#ffffff':secondary);
  document.documentElement.style.setProperty('--topbar-bg',theme==='light'?'#ffffff':secondary);
 },[company]);
 return <Ctx.Provider value={{user,company,setCompany,login,register,logout,loading}}>{children}</Ctx.Provider>
}
