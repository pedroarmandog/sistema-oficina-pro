import {useEffect,useState} from 'react';
import {Download,FileText,X} from 'lucide-react';
import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import {api} from '../services/api';
import {assetUrl} from '../services/urls';
const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date=v=>v&&!Number.isNaN(new Date(v).getTime())?new Date(v).toLocaleDateString('pt-BR'):'Não informada';
const str=v=>v===null||v===undefined||v===''?'Não informado':String(v);
async function imageData(src){if(!src)return null;try{const res=await fetch(assetUrl(src));if(!res.ok)return null;const blob=await res.blob();const object=URL.createObjectURL(blob);try{const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=object});const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d').drawImage(img,0,0);return canvas.toDataURL('image/png')}finally{URL.revokeObjectURL(object)}}catch{return null}}
export default function WorkOrderPdf({order,customers,vehicles,close}){
 const [url,setUrl]=useState(''),[blob,setBlob]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(true);
 useEffect(()=>{let active=true;let created='';(async()=>{try{
  // Fetch a fresh copy to include items added after initial creation and current company identity.
  const [os,company]=await Promise.all([api(`/workorders/${order.id}`),api('/company')]);
  const customer=customers.find(c=>Number(c.id)===Number(os.CustomerId))||{};
  const vehicle=vehicles.find(v=>Number(v.id)===Number(os.VehicleId))||{};
  const pdf=new jsPDF({unit:'mm',format:'a4'}),w=pdf.internal.pageSize.getWidth();let y=17;
  pdf.setFillColor(37,99,235);pdf.rect(0,0,w,5,'F');
  const logo=await imageData(company.logo);
  if(logo){try{const props=pdf.getImageProperties(logo);const maxW=42,maxH=19,ratio=Math.min(maxW/props.width,maxH/props.height);pdf.addImage(logo,'PNG',15,y,props.width*ratio,props.height*ratio);y+=24}catch{}}
  pdf.setTextColor(15,23,42);pdf.setFont('helvetica','bold');pdf.setFontSize(17);pdf.text(str(company.name||'Oficina'),15,y);y+=7;
  pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.setTextColor(90,100,115);
  const lines=[company.document?`CPF/CNPJ: ${company.document}`:'',company.phone?`Telefone: ${company.phone}`:'',company.email?`E-mail: ${company.email}`:'',company.address?`Endereço: ${company.address}`:''].filter(Boolean);
  for(const line of lines){const wrapped=pdf.splitTextToSize(line,w-30);pdf.text(wrapped,15,y);y+=wrapped.length*4.5}
  y+=5;pdf.setDrawColor(218,225,235);pdf.line(15,y,w-15,y);y+=11;
  pdf.setFont('helvetica','bold');pdf.setFontSize(16);pdf.setTextColor(20,35,65);pdf.text(`ORDEM DE SERVIÇO ${str(os.number)}`,15,y);y+=8;
  pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.setTextColor(90,100,115);pdf.text(`Status: ${str(os.status).replaceAll('_',' ')}   •   Emissão: ${date(os.createdAt)}   •   Entrega prevista: ${date(os.promisedAt)}`,15,y);y+=12;
  const section=(title,entries)=>{pdf.setFont('helvetica','bold');pdf.setFontSize(11);pdf.setTextColor(37,99,235);pdf.text(title,15,y);y+=6;pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.setTextColor(35,45,60);for(const [label,value] of entries){const line=pdf.splitTextToSize(`${label}: ${str(value)}`,w-30);if(y+line.length*5>270){pdf.addPage();y=20}pdf.text(line,15,y);y+=line.length*5}y+=7};
  section('DADOS DO CLIENTE',[['Nome',customer.name],['CPF/CNPJ',customer.document],['Telefone',customer.phone],['E-mail',customer.email],['Endereço',customer.address]]);
  if(os.VehicleId)section('VEÍCULO',[['Placa',vehicle.plate],['Marca / Modelo',[vehicle.brand,vehicle.model].filter(Boolean).join(' ')],['Ano',vehicle.year],['Cor',vehicle.color],['Quilometragem',vehicle.mileage]]);
  section('DESCRIÇÃO DO ATENDIMENTO',[['Solicitação do cliente',os.complaint],['Diagnóstico',os.diagnosis],['Observações',os.notes]]);
  const items=Array.isArray(os.items)?os.items:[];
  autoTable(pdf,{startY:y,head:[['Tipo','Descrição','Qtd.','Valor unit.','Subtotal']],body:items.map(i=>[i.kind==='product'?'Peça':'Serviço',str(i.description),String(i.quantity),money(i.unitPrice),money(i.total)]),theme:'grid',styles:{fontSize:8,cellPadding:3},headStyles:{fillColor:[37,99,235]},margin:{left:15,right:15,bottom:22}});
  y=(pdf.lastAutoTable?.finalY||y)+11;if(y>265){pdf.addPage();y=22}
  pdf.setFont('helvetica','bold');pdf.setFontSize(13);pdf.setTextColor(20,35,65);pdf.text(`TOTAL: ${money(os.total)}`,w-15,y,{align:'right'});
  const pages=pdf.internal.getNumberOfPages();for(let p=1;p<=pages;p++){pdf.setPage(p);pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(110,120,135);pdf.text(`Documento de atendimento • ${str(company.name)}`,15,287);pdf.text(`Página ${p} de ${pages}`,w-15,287,{align:'right'})}
  const output=pdf.output('blob');created=URL.createObjectURL(output);if(active){setBlob(output);setUrl(created)}else URL.revokeObjectURL(created);
 }catch(e){if(active)setError(e.message||'Erro ao gerar PDF')}finally{if(active)setBusy(false)}})();return()=>{active=false;if(created)URL.revokeObjectURL(created)}},[order.id]);
 const download=()=>{if(!blob)return;const link=document.createElement('a');const temp=URL.createObjectURL(blob);link.href=temp;link.download=`ordem-servico-${String(order.number||order.id).replace(/[^a-z0-9-]/gi,'_')}.pdf`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(temp),1000)};
 return <div className="pdf-preview-backdrop" role="dialog" aria-modal="true" aria-label="Pré-visualização da ordem de serviço" onMouseDown={e=>e.target===e.currentTarget&&close()}><section className="pdf-preview-modal"><header><div className="pdf-preview-name"><FileText size={19}/><div><b>Ordem de serviço {order.number}</b><small>Pré-visualização do PDF</small></div></div><div className="pdf-preview-actions"><button className="btn secondary" disabled={!blob} onClick={download}><Download size={15}/> Baixar PDF</button><button className="icon-button" onClick={close} title="Fechar"><X size={18}/></button></div></header>{busy?<div className="loading">Preparando documento...</div>:error?<div className="error">{error}</div>:<iframe title={`PDF da ordem ${order.number}`} src={url}/>}</section></div>
}
