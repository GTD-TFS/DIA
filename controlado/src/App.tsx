import { useState } from 'react';
import { api } from '@appdeploy/client';
import { ArrowRight, FileDown, RotateCcw, ChevronDown, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

type Pair = {question:string;answer:string};
type Draft={
 formato:string;estado:string;tipo_hecho:string;fecha_hora:string;lugar:string;
 residencia_en_tenerife:string;motivo_estancia:string;fecha_salida_tenerife:string;
 relato_inicial:string;preguntas_respuestas:{pregunta:string;respuesta:string}[];
 tarjetas:Record<string,unknown>[];operaciones:Record<string,unknown>[];
 objetos:Record<string,unknown>[];declaracion:string;pendientes:string[];condicion:string;
};
const FIRST='¿Qué ha ocurrido, dónde y cuándo sucedió?';
function encodeUtf8(text:string):string{
 const bytes=new TextEncoder().encode(text);
 let raw='';
 for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(raw);
}
function encodeAndVerify(data:Draft):Blob{
 if(!data||!Array.isArray(data.objetos)||!Array.isArray(data.preguntas_respuestas))throw Error('Faltan datos');
 const inside=JSON.stringify(data),b64=encodeUtf8(inside);
 const recovered=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)));
 if(recovered!==inside||JSON.stringify(JSON.parse(recovered))!==inside)throw Error('Base64 inválido');
 const outside={formato:'declaracion-ia-codificada-v5',codificacion:'base64-utf8',contenido_base64_utf8:b64};
 const output=JSON.stringify(outside);
 if(JSON.parse(output).contenido_base64_utf8!==b64)throw Error('Error de JSON');
 return new Blob([output],{type:'text/plain;charset=utf-8'});
}
export default function App(){
 const [question,setQuestion]=useState(FIRST);
 const [answer,setAnswer]=useState('');
 const [history,setHistory]=useState<Pair[]>([]);
 const [draft,setDraft]=useState<Draft|null>(null);
 const [busy,setBusy]=useState<'turn'|'final'|null>(null);
 const [error,setError]=useState('');
 const [expanded,setExpanded]=useState(false);
 const [downloaded,setDownloaded]=useState(false);
 async function send(){
  if(!answer.trim()||busy)return;
  const items=[...history,{question,answer:answer.trim()}];
  setBusy('turn');setError('');
  try{
   const response=await api.post('/api/turn',{history:items});
   const next=String(response.data?.question||'');
   if(!next.startsWith('¿')||!next.endsWith('?'))throw Error('Pregunta incorrecta');
   setHistory(items);setQuestion(next);setAnswer('');
  }catch{setError('No se pudo continuar. Reintenta: la respuesta escrita sigue aquí.')}
  finally{setBusy(null)}
 }
 async function finish(){
  if(busy||(!history.length&&!answer.trim()))return;
  const items=answer.trim()?[...history,{question,answer:answer.trim()}]:history;
  setBusy('final');setError('');
  try{
   const response=await api.post('/api/final',{history:items});
   const candidate=response.data as Draft;
   if(!candidate.declaracion||!Array.isArray(candidate.objetos))throw Error('Borrador incompleto');
   encodeAndVerify(candidate);
   setHistory(items);setDraft(candidate);setAnswer('');
  }catch{setError('No se pudo preparar un TXT válido. Puedes reintentar sin perder la entrevista.')}
  finally{setBusy(null)}
 }
 function download(){
  if(!draft)return;
  try{
   const blob=encodeAndVerify(draft);
   const url=URL.createObjectURL(blob);
   const link=document.createElement('a');
   link.href=url;link.download='DECLARACION_CODIFICADA.txt';
   document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1500);
   setDownloaded(true);setError('');
  }catch{setError('Ha fallado la validación de codificación.')}
 }
 function restart(){
  if(!window.confirm('¿Descartar la entrevista y comenzar de nuevo?'))return;
  setQuestion(FIRST);setAnswer('');setHistory([]);setDraft(null);setError('');setExpanded(false);setDownloaded(false);
 }
 return <div className="page">
  <header className="header">
   <div className="mark">DIA</div>
   <div className="brand"><strong>Declaración asistida</strong><span>Entrevista controlada · versión de prueba</span></div>
   <div className="privacy"><ShieldCheck size={16}/> Sin registro</div>
  </header>
  <main className="layout">
   <div className="intro">
    <h1>{draft?'Borrador preparado':'Cuéntanos qué ha sucedido'}</h1>
    <p>{draft?'Revisa la declaración y descarga el archivo codificado.':'Responde a las preguntas para preparar tu declaración.'}</p>
   </div>
   <section className="panel">
    {draft ? <>
     <div className="ready"><CheckCircle2 size={20}/> Documento estructurado validado</div>
     <div className="preview">{draft.declaracion}</div>
     <div className="meta"><span>Objetos individualizados</span><b>{draft.objetos.length}</b></div>
     <div className="meta"><span>Cuestiones pendientes</span><b>{draft.pendientes.length}</b></div>
     <button className="main full" onClick={download}><FileDown size={21}/> DESCARGAR TXT CODIFICADO</button>
     {downloaded&&<div className="confirmation">Descarga iniciada. Comprueba los archivos de tu dispositivo.</div>}
    </> : <>
     <div className="eyebrow">PREGUNTA {history.length+1}</div>
     <div className="question">{question}</div>
     <label htmlFor="answer">Tu respuesta</label>
     <textarea id="answer" value={answer} onChange={e=>setAnswer(e.target.value)}
       rows={5} maxLength={4500} placeholder="Escribe o dicta tu respuesta…" disabled={Boolean(busy)}/>
     <div className="actions">
      <button className="main" onClick={send} disabled={Boolean(busy)||!answer.trim()}>
       {busy==='turn'?'Analizando…':<>Continuar <ArrowRight size={19}/></>}
      </button>
      <button className="outline" onClick={finish} disabled={Boolean(busy)||(!history.length&&!answer.trim())}>
       {busy==='final'?'Elaborando…':'Finalizar'}
      </button>
     </div>
     {history.length>0&&<>
      <button className="prior" onClick={()=>setExpanded(v=>!v)}>{history.length} respuestas registradas <ChevronDown size={17}/></button>
      {expanded&&<div className="history">{history.map((p,i)=><div key={i}><b>{i+1}. {p.question}</b><p>{p.answer}</p></div>)}</div>}
     </>}
    </>}
    {error&&<div className="error" role="alert"><AlertTriangle size={19}/>{error}</div>}
   </section>
   <div className="foot">
    <p>Versión experimental. El archivo es un borrador sujeto a revisión policial; no constituye una denuncia presentada.</p>
    <p>Las respuestas se procesan por un servicio de IA. No se guardan declaraciones en una base de datos de DIA.</p>
    {(history.length>0||draft)&&<button className="reset" onClick={restart}><RotateCcw size={16}/> Nueva entrevista</button>}
   </div>
  </main>
 </div>;
}