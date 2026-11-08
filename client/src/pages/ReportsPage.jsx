import {API_BASE} from '../services/urls';
import { useEffect, useMemo, useState } from 'react';
import { FileBarChart, FileText, Users, Truck, Package, Boxes, ShoppingCart, ClipboardList, Wallet, CalendarDays, Eye, Download, X, RefreshCw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

const REPORTS = [
 {id:'sales',title:'Vendas',description:'Vendas, valores e formas de pagamento.',icon:ShoppingCart,endpoint:'/sales',columns:[['number','Venda'],['soldAt','Data'],['customer','Cliente'],['paymentMethod','Pagamento'],['status','Status'],['total','Total']]},
 {id:'products',title:'Produtos',description:'Catálogo, códigos e preços.',icon:Package,endpoint:'/products',columns:[['name','Produto'],['sku','Código'],['category','Categoria'],['costPrice','Custo'],['salePrice','Preço venda'],['stock','Estoque']]},
 {id:'stock',title:'Estoque',description:'Saldo atual e estoque mínimo.',icon:Boxes,endpoint:'/products',columns:[['name','Produto'],['sku','Código'],['stock','Saldo'],['minStock','Mínimo'],['stockStatus','Situação']]},
 {id:'customers',title:'Clientes',description:'Nome, documento, telefone, e-mail e endereço.',icon:Users,endpoint:'/customers',columns:[['name','Cliente'],['document','CPF/CNPJ'],['phone','Telefone'],['email','E-mail'],['address','Endereço']]},
 {id:'suppliers',title:'Fornecedores',description:'Contatos e dados de fornecedores.',icon:Truck,endpoint:'/suppliers',columns:[['name','Fornecedor'],['document','CPF/CNPJ'],['phone','Telefone'],['email','E-mail'],['contact','Contato']]},
 {id:'purchases',title:'Compras',description:'Histórico de compras e valores.',icon:FileText,endpoint:'/purchases',columns:[['number','Compra'],['createdAt','Data'],['supplier','Fornecedor'],['status','Status'],['total','Total']]},
 {id:'workorders',title:'Ordens de serviço',description:'Ordens, status, valores e entregas.',icon:ClipboardList,endpoint:'/workorders',columns:[['number','Nº OS'],['status','Status'],['total','Total'],['promisedAt','Entrega prevista'],['createdAt','Criada em']]},
 {id:'financial',title:'Financeiro',description:'Contas a pagar e receber.',icon:Wallet,endpoint:'/financial',columns:[['type','Tipo'],['description','Descrição'],['category','Categoria'],['amount','Valor'],['dueDate','Vencimento'],['status','Status']]}
];
const money = v => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date = v => { if(!v)return '—'; if(typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v)){const [y,m,d]=v.split('-');return `${d}/${m}/${y}`;} const d=new Date(v); return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR'); };
const value = (row,key) => {
 if(key==='customer')return row.Customer?.name||'—';
 if(key==='supplier')return row.Supplier?.name||'—';
 if(key==='stockStatus')return Number(row.stock)<=0?'Sem estoque':Number(row.stock)<=Number(row.minStock||0)?'Estoque baixo':'Normal';
 const v=row[key];
 if(['total','amount','costPrice','salePrice'].includes(key))return money(v);
 if(['soldAt','createdAt','dueDate','promisedAt','paidAt'].includes(key))return date(v);
 if(['status','type','paymentMethod'].includes(key))return String(v||'—').replaceAll('_',' ');
 return v===null||v===undefined||v===''?'—':String(v);
};
const inPeriod=(row,from,to)=>{
 const raw=row.soldAt||row.createdAt||row.dueDate||row.promisedAt||row.paidAt;
 if(!raw)return true;
 const d=new Date(raw);
 if(Number.isNaN(d.getTime()))return true;
 if(from&&d<new Date(`${from}T00:00:00`))return false;
 if(to&&d>new Date(`${to}T23:59:59.999`))return false;
 return true;
};
async function logoPng(logo){
 if(!logo)return null;
 try{
  const base=API_BASE.replace(/\/api\/?$/,'');
  const src=logo.startsWith('/uploads/')?`${base}${logo}`:logo;
  const res=await fetch(src);if(!res.ok)return null;
  const url=URL.createObjectURL(await res.blob());
  try{
   const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url;});
   const c=document.createElement('canvas');c.width=img.naturalWidth||240;c.height=img.naturalHeight||100;c.getContext('2d').drawImage(img,0,0);return c.toDataURL('image/png');
  }finally{URL.revokeObjectURL(url);}
 }catch{return null;}
}
export default function ReportsPage(){
 const {company}=useAuth();
 const [selected,setSelected]=useState('sales');
 const [from,setFrom]=useState(()=>{const d=new Date();d.setDate(1);return d.toISOString().slice(0,10)});
 const [to,setTo]=useState(()=>new Date().toISOString().slice(0,10));
 const [rows,setRows]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [previewUrl,setPreviewUrl]=useState(''),[pdfBlob,setPdfBlob]=useState(null),[previewTitle,setPreviewTitle]=useState('');
 const report=REPORTS.find(r=>r.id===selected)||REPORTS[0];
 useEffect(()=>{let alive=true;setBusy(true);setError('');api(report.endpoint).then(d=>{if(alive)setRows(Array.isArray(d)?d:[])}).catch(e=>{if(alive){setRows([]);setError(e.message||'Não foi possível carregar os dados.')}}).finally(()=>{if(alive)setBusy(false)});return()=>{alive=false}},[selected]);
 useEffect(()=>()=>{if(previewUrl)URL.revokeObjectURL(previewUrl)},[previewUrl]);
 const filtered=useMemo(()=>['sales','purchases','workorders','financial'].includes(selected)?rows.filter(r=>inPeriod(r,from,to)):rows,[rows,from,to,selected]);
 const closePreview=()=>{setPreviewUrl(old=>{if(old)URL.revokeObjectURL(old);return ''});setPdfBlob(null)};
 const generate=async()=>{
  setBusy(true);setError('');
  try{
   const pdf=new jsPDF({orientation:report.columns.length>5?'landscape':'portrait',unit:'mm',format:'a4'});
   const width=pdf.internal.pageSize.getWidth();const logo=await logoPng(company?.logo);let y=14;
   // Logo da empresa aparece primeiro no cabeçalho do PDF.
   if(logo){try{pdf.addImage(logo,'PNG',14,y,28,15,undefined,'FAST');y+=19}catch{}}
   else if(company?.name){pdf.setFont('helvetica','bold');pdf.setFontSize(12);pdf.text(company.name,14,y+5);y+=11}
   pdf.setFont('helvetica','bold');pdf.setFontSize(17);pdf.text(`Relatório de ${report.title}`,14,y+5);y+=11;
   pdf.setFont('helvetica','normal');pdf.setFontSize(9);
   if(company?.name){pdf.text(String(company.name),14,y+1);y+=5}
   const details=[company?.document?`CPF/CNPJ: ${company.document}`:'',company?.phone?`Telefone: ${company.phone}`:'',company?.email||''].filter(Boolean).join(' | ');
   if(details){pdf.text(details,14,y+1);y+=5}
   pdf.text(`Período: ${from?date(from):'Início'} a ${to?date(to):'Hoje'}  |  Gerado: ${new Date().toLocaleString('pt-BR')}`,14,y+1);y+=7;
   autoTable(pdf,{head:[report.columns.map(c=>c[1])],body:filtered.map(r=>report.columns.map(([k])=>value(r,k))),startY:y,theme:'grid',styles:{font:'helvetica',fontSize:8,cellPadding:2.5,overflow:'linebreak'},headStyles:{fillColor:[37,99,235],textColor:[255,255,255]},alternateRowStyles:{fillColor:[245,247,250]},margin:{left:14,right:14,bottom:16},didDrawPage:()=>{
    pdf.setFontSize(8);pdf.setTextColor(120);pdf.text(`OficinaPro • ${report.title}`,14,pdf.internal.pageSize.getHeight()-7);
    pdf.text(`Página ${pdf.internal.getCurrentPageInfo().pageNumber}`,width-14,pdf.internal.pageSize.getHeight()-7,{align:'right'});
   }});
   if(!filtered.length){pdf.setFontSize(10);pdf.text('Nenhum registro encontrado para o período selecionado.',14,y+8)}
   const blob=pdf.output('blob');const url=URL.createObjectURL(blob);
   setPreviewUrl(old=>{if(old)URL.revokeObjectURL(old);return url});setPdfBlob(blob);setPreviewTitle(`Relatório de ${report.title}`);
  }catch(e){setError(`Não foi possível gerar o PDF: ${e.message||'erro inesperado'}`)}
  finally{setBusy(false)}
 };
 const download=()=>{if(!pdfBlob)return;const url=URL.createObjectURL(pdfBlob);const a=document.createElement('a');a.href=url;a.download=`oficinapro-relatorio-${selected}-${new Date().toISOString().slice(0,10)}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 return <div className="reports-page">
  <div className="page-heading"><div><span className="eyebrow">DADOS E EXPORTAÇÃO</span><h1>Relatórios</h1><p>Consulte os dados da oficina e visualize o PDF antes de baixar.</p></div><button className="btn" onClick={generate} disabled={busy}><FileBarChart size={17}/>{busy?'Preparando...':'Gerar relatório PDF'}</button></div>
  <section className="reports-filters panel"><div className="reports-filter-title"><CalendarDays size={17}/><div><b>Período do relatório</b><small>Aplicado aos registros com data.</small></div></div><div className="reports-date-fields"><label>Data inicial<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Data final<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button className="btn secondary" onClick={()=>{const d=new Date();setFrom(new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10));setTo(d.toISOString().slice(0,10))}}><RefreshCw size={15}/> Este mês</button></div></section>
  {error&&<div className="error">{error}<button onClick={()=>setError('')}>Fechar</button></div>}
  <div className="reports-layout">
   <aside className="reports-list panel"><div className="panel-head"><h2>Tipos de relatório</h2><small>{REPORTS.length} opções</small></div>{REPORTS.map(item=>{const Icon=item.icon;return <button key={item.id} className={`report-option ${selected===item.id?'selected':''}`} onClick={()=>setSelected(item.id)}><span className="report-option-icon"><Icon size={18}/></span><span><b>{item.title}</b><small>{item.description}</small></span></button>})}</aside>
   <section className="reports-preview panel"><div className="panel-head"><div><h2><FileBarChart size={17}/>{report.title}</h2><p>{report.description}</p></div><button className="icon-button" onClick={()=>{setBusy(true);api(report.endpoint).then(d=>setRows(Array.isArray(d)?d:[])).catch(e=>setError(e.message)).finally(()=>setBusy(false))}} title="Atualizar dados" disabled={busy}><RefreshCw size={16}/></button></div>
    <div className="reports-summary"><div><small>Registros no período</small><b>{filtered.length}</b></div><div><small>Empresa</small><b>{company?.name||'Minha oficina'}</b></div><div><small>Logo no PDF</small><b>{company?.logo?'Configurada':'Nome da empresa'}</b></div></div>
    <div className="reports-table-wrap">{busy?<div className="loading">Carregando dados...</div>:<table><thead><tr>{report.columns.slice(0,5).map(([k,label])=><th key={k}>{label}</th>)}</tr></thead><tbody>{filtered.slice(0,8).map((r,i)=><tr key={r.id||i}>{report.columns.slice(0,5).map(([k])=><td key={k}>{value(r,k)}</td>)}</tr>)}</tbody></table>}{!busy&&!filtered.length&&<div className="empty">Nenhum registro para exibir neste período.</div>}</div>
    <div className="reports-footer"><span>O PDF abre em uma pré-visualização antes do download.</span><button className="btn" onClick={generate} disabled={busy}><Eye size={16}/> Visualizar PDF</button></div>
   </section>
  </div>
  {previewUrl&&<div className="pdf-preview-backdrop" role="dialog" aria-modal="true" aria-label={previewTitle} onMouseDown={e=>{if(e.target===e.currentTarget)closePreview()}}><section className="pdf-preview-modal"><header><div className="pdf-preview-name"><FileText size={19}/><div><b>{previewTitle}</b><small>Pré-visualização do documento</small></div></div><div className="pdf-preview-actions"><button className="btn secondary" onClick={download}><Download size={15}/> Baixar PDF</button><button className="icon-button" title="Fechar" onClick={closePreview}><X size={18}/></button></div></header><iframe title={previewTitle} src={previewUrl}/></section></div>}
 </div>;
}
