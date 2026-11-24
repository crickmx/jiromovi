import{j as e,ch as ze,ci as De,cj as Re,ck as Ue,cl as $e,cm as qe,cn as Be,co as Me,cp as Oe,cq as Ve,cr as We,cs as Ge,ct as Xe,cu as Ye,cv as Je,cw as Qe,c1 as Ke,cx as Ze,cy as et,bM as tt,ah as at,cz as st,c9 as ot,cA as nt,cB as rt,cC as it,g as xe,cD as lt,aR as Se,b3 as be,aT as ct,aV as dt,aC as je,q as ve,ax as me,aS as mt,b1 as Ne,b$ as ut,aM as ht,U as pt,aQ as xt,d as gt,c7 as ft}from"./ui-CztHUkgx.js";import{r as f,k as bt,u as jt}from"./vendor-wNc7A80n.js";import{B as W}from"./button-i5c_lILw.js";import{L as le}from"./label-DQ5sGEsd.js";import{I as vt}from"./input-BfqYbM3Q.js";import{_ as Nt,e as wt,s as q,c as we}from"./index-D85sunqU.js";import{a as yt,b as Ct,d as St,s as ye,g as _t,h as kt,i as Tt,j as At}from"./comunicadosUtils-CvcPMvfY.js";import"./supabase-D6X4so3E.js";function It({value:n,onChange:s,placeholder:i="Escribe el contenido aquí...",minHeight:d="300px"}){const g=f.useRef(null),l=f.useRef(null),[p,j]=f.useState("visual"),[A,L]=f.useState(!1);f.useEffect(()=>{p==="visual"&&g.current&&!A&&(g.current.innerHTML=n)},[n,A,p]);const a=()=>{if(g.current){const o=g.current.innerHTML;s(o)}},H=o=>{s(o.target.value)},x=(o,k)=>{document.execCommand(o,!1,k),g.current?.focus(),a()},B=()=>{const o=prompt("Ingresa la URL:");o&&x("createLink",o)},I=o=>{x("formatBlock",`<${o}>`)},D=[{name:"Títulos",buttons:[{icon:ze,label:"Título Grande",action:()=>I("h1"),tooltip:"Título 1"},{icon:De,label:"Título Mediano",action:()=>I("h2"),tooltip:"Título 2"},{icon:Re,label:"Título Pequeño",action:()=>I("h3"),tooltip:"Título 3"}]},{name:"Formato",buttons:[{icon:Ue,label:"Negrita",action:()=>x("bold"),tooltip:"Negrita (Ctrl+B)"},{icon:$e,label:"Cursiva",action:()=>x("italic"),tooltip:"Cursiva (Ctrl+I)"},{icon:qe,label:"Subrayado",action:()=>x("underline"),tooltip:"Subrayado (Ctrl+U)"},{icon:Be,label:"Tachado",action:()=>x("strikethrough"),tooltip:"Tachado"},{icon:Me,label:"Subíndice",action:()=>x("subscript"),tooltip:"Subíndice"},{icon:Oe,label:"Superíndice",action:()=>x("superscript"),tooltip:"Superíndice"}]},{name:"Alineación",buttons:[{icon:Ve,label:"Alinear Izquierda",action:()=>x("justifyLeft"),tooltip:"Alinear a la izquierda"},{icon:We,label:"Centrar",action:()=>x("justifyCenter"),tooltip:"Centrar"},{icon:Ge,label:"Alinear Derecha",action:()=>x("justifyRight"),tooltip:"Alinear a la derecha"},{icon:Xe,label:"Justificar",action:()=>x("justifyFull"),tooltip:"Justificar"}]},{name:"Listas",buttons:[{icon:Ye,label:"Lista",action:()=>x("insertUnorderedList"),tooltip:"Lista con viñetas"},{icon:Je,label:"Lista Numerada",action:()=>x("insertOrderedList"),tooltip:"Lista numerada"}]},{name:"Insertar",buttons:[{icon:Qe,label:"Enlace",action:B,tooltip:"Insertar enlace"},{icon:Ke,label:"Imagen",action:()=>{const o=prompt("Ingresa la URL de la imagen:");o&&x("insertImage",o)},tooltip:"Insertar imagen"},{icon:Ze,label:"Tabla",action:()=>{const o=prompt("Número de filas:","3"),k=prompt("Número de columnas:","3");if(o&&k){const y=parseInt(o),R=parseInt(k);let F='<table border="1" style="border-collapse: collapse; width: 100%; margin: 1em 0;">';F+="<tbody>";for(let K=0;K<y;K++){F+="<tr>";for(let w=0;w<R;w++)F+='<td style="border: 1px solid #e5e7eb; padding: 8px;">&nbsp;</td>';F+="</tr>"}F+="</tbody></table>",x("insertHTML",F)}},tooltip:"Insertar tabla"},{icon:et,label:"Cita",action:()=>I("blockquote"),tooltip:"Cita"},{icon:tt,label:"Línea Horizontal",action:()=>{x("insertHorizontalRule")},tooltip:"Insertar línea horizontal"}]},{name:"Estilos",buttons:[{icon:at,label:"Color Texto",action:()=>{const o=prompt("Ingresa el color (hex ej: #FF0000 o nombre ej: red):");o&&x("foreColor",o)},tooltip:"Color de texto"},{icon:st,label:"Color Fondo",action:()=>{const o=prompt("Ingresa el color de fondo (hex ej: #FFFF00 o nombre ej: yellow):");o&&x("backColor",o)},tooltip:"Color de fondo"},{icon:ot,label:"Tamaño Fuente",action:()=>{const o=prompt("Tamaño de fuente (1-7):","3");o&&x("fontSize",o)},tooltip:"Tamaño de fuente"},{icon:nt,label:"Limpiar Formato",action:()=>{x("removeFormat")},tooltip:"Quitar formato"}]},{name:"Acciones",buttons:[{icon:rt,label:"Deshacer",action:()=>x("undo"),tooltip:"Deshacer (Ctrl+Z)"},{icon:it,label:"Rehacer",action:()=>x("redo"),tooltip:"Rehacer (Ctrl+Y)"}]}];return e.jsxs("div",{className:"space-y-2",children:[e.jsx("div",{className:"bg-neutral-50 border border-neutral-300 rounded-lg",children:e.jsxs("div",{className:"flex items-center justify-between gap-2 p-2 flex-wrap",children:[p==="visual"&&e.jsx("div",{className:"flex items-center gap-2 flex-wrap",children:D.map((o,k)=>e.jsxs("div",{className:"flex items-center",children:[e.jsx("div",{className:"flex items-center gap-0.5",children:o.buttons.map((y,R)=>e.jsx("button",{type:"button",onClick:y.action,title:y.tooltip,className:"p-2 hover:bg-white active:bg-neutral-100 rounded transition-colors group",children:e.jsx(y.icon,{className:"w-4 h-4 text-neutral-600 group-hover:text-neutral-900"})},R))}),k<D.length-1&&e.jsx("div",{className:"w-px h-6 bg-neutral-300 mx-1"})]},k))}),p!=="visual"&&e.jsx("div",{className:"text-sm text-neutral-600 px-2",children:p==="html"?"Modo HTML - Edita el código fuente directamente":"Vista Previa del Contenido"}),e.jsxs("div",{className:"flex items-center gap-1",children:[e.jsxs("button",{type:"button",onClick:()=>j("visual"),className:`flex items-center gap-2 px-3 py-2 rounded transition-colors ${p==="visual"?"bg-primary-100 text-primary-700":"hover:bg-white text-neutral-600"}`,title:"Editor Visual",children:[e.jsx(xe,{className:"w-4 h-4"}),e.jsx("span",{className:"text-xs font-medium hidden sm:inline",children:"Visual"})]}),e.jsxs("button",{type:"button",onClick:()=>j("html"),className:`flex items-center gap-2 px-3 py-2 rounded transition-colors ${p==="html"?"bg-primary-100 text-primary-700":"hover:bg-white text-neutral-600"}`,title:"Editor HTML",children:[e.jsx(lt,{className:"w-4 h-4"}),e.jsx("span",{className:"text-xs font-medium hidden sm:inline",children:"HTML"})]}),e.jsxs("button",{type:"button",onClick:()=>j("preview"),className:`flex items-center gap-2 px-3 py-2 rounded transition-colors ${p==="preview"?"bg-primary-100 text-primary-700":"hover:bg-white text-neutral-600"}`,title:"Vista Previa",children:[e.jsx(Se,{className:"w-4 h-4"}),e.jsx("span",{className:"text-xs font-medium hidden sm:inline",children:"Preview"})]})]})]})}),p==="visual"&&e.jsx("div",{ref:g,contentEditable:!0,onInput:a,onFocus:()=>L(!0),onBlur:()=>L(!1),className:"w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-base bg-surface-card overflow-y-auto prose max-w-none",style:{minHeight:d},"data-placeholder":i}),p==="html"&&e.jsx("textarea",{ref:l,value:n,onChange:H,className:"w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-base bg-surface-card font-mono text-sm",style:{minHeight:d},placeholder:"Escribe o pega tu HTML aquí..."}),p==="preview"&&e.jsx("div",{className:"prose max-w-none p-4 border border-neutral-300 rounded-2xl bg-surface-card overflow-y-auto",style:{minHeight:d},dangerouslySetInnerHTML:{__html:n}}),e.jsx("style",{children:`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
          display: block;
        }

        [contenteditable] {
          outline: none;
        }

        [contenteditable] h1 {
          font-size: 2em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
          line-height: 1.2;
        }

        [contenteditable] h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
          line-height: 1.3;
        }

        [contenteditable] h3 {
          font-size: 1.25em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
          line-height: 1.4;
        }

        [contenteditable] p {
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }

        [contenteditable] ul, [contenteditable] ol {
          padding-left: 2em;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }

        [contenteditable] li {
          margin-top: 0.25em;
          margin-bottom: 0.25em;
        }

        [contenteditable] blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1em;
          margin-left: 0;
          margin-right: 0;
          margin-top: 1em;
          margin-bottom: 1em;
          font-style: italic;
          color: #6b7280;
        }

        [contenteditable] a {
          color: #3b82f6;
          text-decoration: underline;
        }

        [contenteditable] a:hover {
          color: #2563eb;
        }

        [contenteditable] strong, [contenteditable] b {
          font-weight: bold;
        }

        [contenteditable] em, [contenteditable] i {
          font-style: italic;
        }

        [contenteditable] u {
          text-decoration: underline;
        }

        [contenteditable] strike, [contenteditable] s {
          text-decoration: line-through;
        }

        [contenteditable] hr {
          border: none;
          border-top: 2px solid #e5e7eb;
          margin: 1.5em 0;
        }

        [contenteditable] [style*="text-align: left"] {
          text-align: left;
        }

        [contenteditable] [style*="text-align: center"] {
          text-align: center;
        }

        [contenteditable] [style*="text-align: right"] {
          text-align: right;
        }

        [contenteditable] [style*="text-align: justify"] {
          text-align: justify;
        }

        [contenteditable] img {
          max-width: 100%;
          height: auto;
          margin: 1em 0;
          border-radius: 4px;
        }

        [contenteditable] table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }

        [contenteditable] table td,
        [contenteditable] table th {
          border: 1px solid #e5e7eb;
          padding: 8px;
        }

        [contenteditable] table th {
          background-color: #f3f4f6;
          font-weight: bold;
        }

        [contenteditable] sub {
          vertical-align: sub;
          font-size: smaller;
        }

        [contenteditable] sup {
          vertical-align: super;
          font-size: smaller;
        }

        .prose {
          font-size: 1rem;
          line-height: 1.75;
        }

        .prose h1 {
          font-size: 2em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
          line-height: 1.2;
        }

        .prose h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
          line-height: 1.3;
        }

        .prose h3 {
          font-size: 1.25em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
          line-height: 1.4;
        }

        .prose p {
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }

        .prose ul, .prose ol {
          padding-left: 2em;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }

        .prose li {
          margin-top: 0.25em;
          margin-bottom: 0.25em;
        }

        .prose blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1em;
          margin: 1em 0;
          font-style: italic;
          color: #6b7280;
        }

        .prose a {
          color: #3b82f6;
          text-decoration: underline;
        }

        .prose strong, .prose b {
          font-weight: bold;
        }

        .prose em, .prose i {
          font-style: italic;
        }

        .prose u {
          text-decoration: underline;
        }

        .prose strike, .prose s {
          text-decoration: line-through;
        }

        .prose hr {
          border: none;
          border-top: 2px solid #e5e7eb;
          margin: 1.5em 0;
        }

        .prose img {
          max-width: 100%;
          height: auto;
          margin: 1em 0;
          border-radius: 4px;
        }

        .prose table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }

        .prose table td,
        .prose table th {
          border: 1px solid #e5e7eb;
          padding: 8px;
        }

        .prose table th {
          background-color: #f3f4f6;
          font-weight: bold;
        }

        .prose sub {
          vertical-align: sub;
          font-size: smaller;
        }

        .prose sup {
          vertical-align: super;
          font-size: smaller;
        }
      `}),e.jsx("div",{className:"flex items-start gap-2 text-xs text-neutral-500",children:e.jsxs("div",{className:"flex-1",children:[e.jsx("strong",{className:"text-neutral-700",children:"Modos de Edición:"}),e.jsxs("ul",{className:"mt-1 space-y-1 ml-4 list-disc",children:[e.jsxs("li",{children:[e.jsx("strong",{children:"Visual:"})," Editor completo con formato visual - títulos, negrita, cursiva, subrayado, tachado, alineación (izquierda, centro, derecha, justificado), listas, enlaces, imágenes, tablas, colores, y más."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"HTML:"})," Edita el código HTML directamente para control avanzado."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Preview:"})," Vista previa del contenido renderizado."]})]})]})})]})}async function Ft(n){const s=n.name.toLowerCase();if(s.endsWith(".pdf")){const{extractTextFromPdf:i}=await Nt(async()=>{const{extractTextFromPdf:d}=await import("./pdfExtract-QGgVSbg4.js");return{extractTextFromPdf:d}},[]);return i(n)}return s.endsWith(".txt")||s.endsWith(".html")||s.endsWith(".htm")||s.endsWith(".md")?n.text():""}async function Lt(n){const s=[];for(const i of n)try{const d=await Ft(i);d.trim()&&s.push(`--- ${i.name} ---
${d}`)}catch(d){console.error("Error extracting text from",i.name,d)}return s.join(`

`)}async function Et(n,s){const g=await fetch("undefined/functions/v1/ia-process-document",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer undefined"},body:JSON.stringify({raw_text:n,titulo_sugerido:void 0})});if(!g.ok){const p=await g.json().catch(()=>({error:"Error desconocido"}));throw new Error(p.error||`Error ${g.status}`)}const l=await g.json();if(!l.success)throw new Error(l.error||"Error procesando documento");return{titulo:l.titulo,contenido_html:l.contenido_html,imagen_url:l.imagen_url,bajada:l.bajada,resumen_ejecutivo:l.resumen_ejecutivo,puntos_clave:l.puntos_clave,tiempo_lectura:l.tiempo_lectura}}function he(n){return new Promise((s,i)=>{const d=new Image;d.crossOrigin="anonymous",d.onload=()=>s(d),d.onerror=()=>i(new Error(`Failed to load image: ${n}`)),d.src=n})}function Pt(n,s,i){const d=s.split(" "),g=[];let l="";for(const p of d){const j=l?`${l} ${p}`:p;n.measureText(j).width>i&&l?(g.push(l),l=p):l=j}return l&&g.push(l),g}async function Ce(n){const s=await fetch(n,{mode:"cors"});if(!s.ok)throw new Error("Failed to fetch image");const i=await s.blob();return URL.createObjectURL(i)}function Ht(n){const s=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(n);return s?{r:parseInt(s[1],16),g:parseInt(s[2],16),b:parseInt(s[3],16)}:{r:14,g:99,b:215}}function pe(n,s,i,d,g,l){n.beginPath(),n.moveTo(s+l,i),n.lineTo(s+d-l,i),n.quadraticCurveTo(s+d,i,s+d,i+l),n.lineTo(s+d,i+g-l),n.quadraticCurveTo(s+d,i+g,s+d-l,i+g),n.lineTo(s+l,i+g),n.quadraticCurveTo(s,i+g,s,i+g-l),n.lineTo(s,i+l),n.quadraticCurveTo(s,i,s+l,i),n.closePath()}async function zt(n){const{backgroundUrl:s,titulo:i,aseguradoraNombre:d,aseguradoraLogoUrl:g,brandColor:l="#0e63d7"}=n,p=1200,j=675,A=p/2,L=document.createElement("canvas");L.width=p,L.height=j;const a=L.getContext("2d");let H=!1;try{const u=await Ce(s);try{const m=await he(u),v=Math.max(p/m.width,j/m.height),S=m.width*v,T=m.height*v;a.drawImage(m,(p-S)/2,(j-T)/2,S,T),H=!0}finally{URL.revokeObjectURL(u)}}catch{try{const u=await he(s),m=Math.max(p/u.width,j/u.height),v=u.width*m,S=u.height*m;a.drawImage(u,(p-v)/2,(j-S)/2,v,S),H=!0}catch{H=!1}}if(!H){const u=a.createLinearGradient(0,0,p,j);u.addColorStop(0,"#1e3a5f"),u.addColorStop(1,"#0f2027"),a.fillStyle=u,a.fillRect(0,0,p,j)}const x=a.createLinearGradient(0,0,0,j);x.addColorStop(0,"rgba(0,0,0,0.25)"),x.addColorStop(.4,"rgba(0,0,0,0.50)"),x.addColorStop(1,"rgba(0,0,0,0.72)"),a.fillStyle=x,a.fillRect(0,0,p,j);const{r:B,g:I,b:E}=Ht(l);a.fillStyle=l,a.fillRect(0,0,p,5);const M=22,z=64;if(g)try{let u=g;try{u=await Ce(g)}catch{}const m=await he(u),T=Math.min(200/m.width,44/m.height),U=m.width*T,ee=m.height*T,ne=50,X=M+(z-ee)/2,$=8,te=6;a.fillStyle="rgba(255,255,255,0.95)",pe(a,ne-$,X-te,U+$*2,ee+te*2,8),a.fill(),a.drawImage(m,ne,X,U,ee),u!==g&&URL.revokeObjectURL(u)}catch{}else if(d){a.font="bold 16px Arial, Helvetica, sans-serif";const m=a.measureText(d).width+28,v=36,S=50,T=M+(z-v)/2;a.fillStyle=l,pe(a,S,T,m,v,18),a.fill(),a.fillStyle="#FFFFFF",a.textAlign="center",a.textBaseline="middle",a.fillText(d,S+m/2,T+v/2)}a.font="500 14px Arial, Helvetica, sans-serif",a.fillStyle="rgba(255,255,255,0.7)",a.textAlign="right",a.textBaseline="middle",a.fillText("MOVI Digital",p-50,M+z/2);const G=i.length>100?34:i.length>70?38:i.length>45?44:50,J=Math.round(G*1.25),oe=p-120;a.font=`bold ${G}px Arial, Helvetica, sans-serif`;const Q=Pt(a,i,oe),D=3,o=Q.slice(0,D);if(Q.length>D){const u=o[D-1];o[D-1]=u.length>4?u.slice(0,-4)+"...":u+"..."}const k=o.length*J,y=!!(d&&d.trim()&&!g),R=y?38:0,F=y?14:0,w=R+F+k+24+16,Z=M+z,C=j-Z,Y=Z+(C-w)/2;if(y){const u=d.toUpperCase();a.font="bold 13px Arial, Helvetica, sans-serif";const m=a.measureText(u).width+36,v=R,S=A-m/2,T=Y;a.fillStyle=`rgba(${B},${I},${E},0.92)`,pe(a,S,T,m,v,v/2),a.fill(),a.fillStyle="#FFFFFF",a.textAlign="center",a.textBaseline="middle",a.fillText(u,A,T+v/2)}const O=Y+R+F;a.font=`bold ${G}px Arial, Helvetica, sans-serif`,a.fillStyle="#FFFFFF",a.textAlign="center",a.textBaseline="top",a.shadowColor="rgba(0,0,0,0.7)",a.shadowBlur=8,a.shadowOffsetX=0,a.shadowOffsetY=2;for(let u=0;u<o.length;u++)a.fillText(o[u],A,O+u*J);a.shadowColor="transparent",a.shadowBlur=0;const ce=O+k+16,ue=new Date().toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"});return a.font="400 14px Arial, Helvetica, sans-serif",a.fillStyle="rgba(255,255,255,0.65)",a.textAlign="center",a.textBaseline="top",a.fillText(ue,A,ce),a.fillStyle=`rgba(${B},${I},${E},0.8)`,a.fillRect(A-40,j-10,80,4),new Promise((u,m)=>{L.toBlob(v=>{v?u(v):m(new Error("Failed to generate cover image blob"))},"image/jpeg",.92)})}function Vt(){const{id:n}=bt(),{usuario:s}=wt(),i=jt(),[d,g]=f.useState(!1),[l,p]=f.useState([]),[j,A]=f.useState(""),[L,a]=f.useState(""),[H,x]=f.useState(null),[B,I]=f.useState(""),[E,M]=f.useState(""),[z,G]=f.useState(!0),[J,oe]=f.useState(""),[Q,D]=f.useState(!1),[o,k]=f.useState([]),[y,R]=f.useState([]),[F,K]=f.useState(!1),[w,Z]=f.useState("todos"),[C,Y]=f.useState([]),[O,ce]=f.useState([]),[ue,u]=f.useState([]),[m,v]=f.useState([]),[S,T]=f.useState(""),[U,ee]=f.useState(!1),[ne,X]=f.useState(null),[$,te]=f.useState(!1),[de,ge]=f.useState(""),[re,_e]=f.useState([]),ae=s?.rol==="Administrador",V=s?.rol==="Gerente",fe=ae||V,ie=!!n,ke=V&&!s?.oficina_id;f.useEffect(()=>{if(!fe){i("/comunicados");return}Te()},[n]);const Te=async()=>{try{g(!0);const t=await yt();p(t);const{data:c}=await q.from("oficinas").select("id, nombre").order("nombre");u(c||[]);const{data:N}=await q.from("web_page_insurers").select("id, name, logo_url").eq("is_active",!0).order("display_order");if(_e(N||[]),t.length>0&&!E&&M(t[0].id),n){const b=await Ct(n);if(b){if(V&&b.creado_por!==s?.id){alert("No tienes permiso para editar este comunicado"),i("/comunicados");return}if(A(b.titulo),a(b.contenido_html),I(b.imagen_principal),M(b.categoria_id),D(b.fijado),b.adjuntos&&b.adjuntos.length>0&&R(b.adjuntos),b.fecha_publicacion){const r=new Date(b.fecha_publicacion),h=new Date(r.getTime()-r.getTimezoneOffset()*6e4).toISOString().slice(0,16);oe(h),G(!1)}}}}catch(t){console.error("Error cargando datos:",t)}finally{g(!1)}},Ae=t=>{if(t.target.files&&t.target.files[0]){const c=t.target.files[0];x(c),I(URL.createObjectURL(c))}},Ie=t=>{if(t.target.files){const c=Array.from(t.target.files);if(o.length+y.length+c.length>5){alert("Máximo 5 adjuntos permitidos");return}k([...o,...c])}},Fe=t=>{k(o.filter((c,N)=>N!==t))},Le=t=>{if(t.target.files){const c=Array.from(t.target.files);v([...m,...c]),X(null),te(!1)}},Ee=t=>{v(m.filter((c,N)=>N!==t))},Pe=async()=>{if(m.length===0&&!S.trim()){X("Sube al menos un archivo o pega texto para procesar.");return}try{ee(!0),X(null);let t=S;if(m.length>0){const r=await Lt(m);r.trim()&&(t=t?`${t}

${r}`:r)}if(!t.trim()){X("No se pudo extraer texto de los archivos. Intenta pegando el contenido manualmente.");return}const c=await Et(t);A(c.titulo),a(c.contenido_html);let N=de;if(!N&&re.length>0){const r=`${c.titulo} ${c.contenido_html}`.toLowerCase(),h=re.find(_=>{const P=_.name.toLowerCase();return r.includes(P)?!0:P.split(/\s+/).some(se=>se.length>4&&r.includes(se))});h&&(N=h.id,ge(h.id))}const b=re.find(r=>r.id===N);try{const r=l.find(se=>se.id===E),h=await zt({backgroundUrl:c.imagen_url,titulo:c.titulo,aseguradoraNombre:b?.name,aseguradoraLogoUrl:b?.logo_url,categoria:r?.nombre}),_=new File([h],"cover-ia.jpg",{type:"image/jpeg"}),P=await ye(_);I(P),x(null)}catch(r){console.error("Error generating cover, using raw AI image:",r),c.imagen_url&&I(c.imagen_url)}if(m.length>0)if(o.length+y.length+m.length<=5)k(h=>[...h,...m]);else{const h=5-o.length-y.length;h>0&&k(_=>[..._,...m.slice(0,h)])}te(!0)}catch(t){X(t.message||"Error al procesar con IA")}finally{ee(!1)}},He=async()=>{if(!j.trim()){alert("El título es obligatorio");return}if(!L.trim()){alert("El contenido es obligatorio");return}if(!H&&!B){alert("La imagen principal es obligatoria");return}if(!E){alert("Debes seleccionar una categoría");return}if(V&&C.length===0){alert("Debes seleccionar al menos un destinatario (Empleados y/o Agentes)");return}if(V){if(!s?.oficina_id){alert("No tienes una oficina asignada. Contacta al administrador.");return}if(C.length===0){alert("Debes seleccionar al menos un rol (Empleado o Agente)");return}}if(ae){if(w==="rol"&&C.length===0){alert("Debes seleccionar al menos un rol");return}if(w==="oficina"&&O.length===0){alert("Debes seleccionar al menos una oficina");return}}try{K(!0);let t=B;H&&(t=await ye(H));const c=z?new Date().toISOString():new Date(J).toISOString(),N={titulo:j,contenido_html:L,imagen_principal:t,categoria_id:E,fecha_publicacion:c,publicado:!0,fijado:V?!1:Q,creado_por:s.id};let b=n;if(ie?await _t(n,N):b=(await kt(N)).id,o.length>0&&b)for(const r of o){const h=await Tt(r);await At({comunicado_id:b,archivo_url:h,nombre_archivo:r.name,tamanio_bytes:r.size,tipo_mime:r.type})}if(b){await q.from("comunicados_visibilidad").delete().eq("comunicado_id",b);const r=[];if(V)for(const h of C)r.push({comunicado_id:b,rol:h,oficina_id:s?.oficina_id,usuario_id:null,para_todos:!1});else if(ae){if(w==="todos")r.push({comunicado_id:b,rol:null,oficina_id:null,usuario_id:null,para_todos:!0});else if(w==="rol")for(const h of C)r.push({comunicado_id:b,rol:h,oficina_id:null,usuario_id:null,para_todos:!1});else if(w==="oficina")for(const h of O)r.push({comunicado_id:b,rol:null,oficina_id:h,usuario_id:null,para_todos:!1})}r.length>0&&await q.from("comunicados_visibilidad").insert(r)}if(!ie&&b)try{let r=[];if(V){const{data:h}=await q.from("usuarios").select("id").eq("oficina_id",s?.oficina_id).in("rol",C).eq("estado","activo");h&&(r=h.map(P=>P.id));const{data:_}=await q.from("usuarios").select("id").eq("rol","Administrador").eq("estado","activo");_&&r.push(..._.map(P=>P.id))}else if(ae){if(w==="todos"){const{data:h}=await q.from("usuarios").select("id").eq("estado","activo");h&&(r=h.map(_=>_.id))}else if(w==="rol"){const{data:h}=await q.from("usuarios").select("id").in("rol",C).eq("estado","activo");h&&(r=h.map(_=>_.id))}else if(w==="oficina"){const{data:h}=await q.from("usuarios").select("id").in("oficina_id",O).eq("estado","activo");h&&(r=h.map(_=>_.id))}}if(r=[...new Set(r)],r.length>0){const h=`/comunicados/${b}`,{data:_,error:P}=await q.rpc("notify",{p_event_code:"nuevo_comunicado",p_user_ids:r,p_payload:{titulo_comunicado:j,link_comunicado:h,categoria:E||"General",modulo:"Comunicados"},p_entity_id:b});P?console.error("Error al crear jobs de notificación:",P):console.log("Notificaciones programadas:",_),fetch("undefined/functions/v1/notification-dispatcher",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer undefined"}}).catch(se=>console.warn("Dispatcher no pudo ejecutarse:",se))}}catch(r){console.error("Error enviando notificaciones:",r)}alert(ie?"Comunicado actualizado exitosamente":"Comunicado creado exitosamente"),i("/comunicados")}catch(t){console.error("Error guardando comunicado:",t),alert("Error al guardar el comunicado")}finally{K(!1)}};return fe?ke?e.jsx(e.Fragment,{children:e.jsx("div",{children:e.jsxs("div",{className:"bg-red-50 border border-red-200 rounded-xl p-6 sm:p-8 md:p-12 text-center shadow-ios",children:[e.jsx("div",{className:"inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4",children:e.jsx(be,{className:"w-8 h-8 text-red-600"})}),e.jsx("h2",{className:"text-xl sm:text-2xl font-bold text-neutral-900 mb-3",children:"Oficina no asignada"}),e.jsx("p",{className:"text-sm sm:text-base text-neutral-600 mb-6 max-w-md mx-auto",children:"Para crear comunicados necesitas tener una oficina asignada. Por favor contacta al administrador del sistema."}),e.jsx(W,{onClick:()=>i("/comunicados"),children:"Volver a Comunicados"})]})})}):d?e.jsx(e.Fragment,{children:e.jsx("div",{children:e.jsx("div",{className:"flex items-center justify-center py-12",children:e.jsx("div",{className:"animate-spin rounded-full h-12 w-12 border-3 border-accent border-t-transparent"})})})}):e.jsx(e.Fragment,{children:e.jsxs("div",{children:[e.jsx("div",{className:"mb-4 sm:mb-6",children:e.jsxs(W,{variant:"ghost",onClick:()=>i("/comunicados"),className:"btn-touch",children:[e.jsx(ct,{className:"w-4 h-4 mr-2"}),"Volver"]})}),e.jsxs("div",{className:"bg-surface-card rounded-2xl border border-soft shadow-ios p-4 sm:p-6 md:p-8 space-y-6",children:[!ie&&e.jsxs("div",{className:we("rounded-xl border-2 border-dashed p-4 sm:p-6 transition-colors",$?"border-green-300 bg-green-50/50":"border-primary-200 bg-primary-50/30"),children:[e.jsxs("div",{className:"flex items-center gap-2 mb-3",children:[e.jsx("div",{className:we("w-8 h-8 rounded-lg flex items-center justify-center",$?"bg-green-100":"bg-primary-100"),children:$?e.jsx(dt,{className:"w-5 h-5 text-green-600"}):e.jsx(je,{className:"w-5 h-5 text-primary-600"})}),e.jsxs("div",{children:[e.jsx("h3",{className:"text-base font-semibold text-neutral-900",children:$?"Contenido generado por IA":"Generar con IA"}),e.jsx("p",{className:"text-xs text-neutral-500",children:$?"Revisa y edita el contenido generado abajo. Los archivos se adjuntaron automaticamente.":"Sube archivos o pega texto para generar el comunicado automaticamente"})]})]}),!$&&e.jsxs(e.Fragment,{children:[e.jsxs("label",{className:"flex flex-col items-center justify-center w-full h-32 border border-neutral-300 border-dashed rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-colors mb-3",children:[e.jsx(ve,{className:"w-8 h-8 text-neutral-500 mb-1"}),e.jsx("span",{className:"text-sm text-neutral-600 font-medium",children:"Subir archivos"}),e.jsx("span",{className:"text-xs text-neutral-500 mt-0.5",children:"PDF, DOCX, TXT, imagenes"}),e.jsx("input",{type:"file",multiple:!0,accept:".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp",onChange:Le,className:"hidden",disabled:U})]}),m.length>0&&e.jsx("div",{className:"space-y-2 mb-3",children:m.map((t,c)=>e.jsxs("div",{className:"flex items-center justify-between p-2 bg-surface-card rounded-lg border border-soft",children:[e.jsxs("div",{className:"flex items-center gap-2 min-w-0 flex-1",children:[e.jsx(xe,{className:"w-4 h-4 text-primary-500 flex-shrink-0"}),e.jsx("span",{className:"text-sm text-neutral-700 truncate",children:t.name}),e.jsxs("span",{className:"text-xs text-neutral-500 flex-shrink-0",children:[(t.size/1024).toFixed(0)," KB"]})]}),e.jsx("button",{type:"button",onClick:()=>Ee(c),className:"text-neutral-500 hover:text-red-500 p-1",disabled:U,children:e.jsx(me,{className:"w-4 h-4"})})]},c))}),e.jsx("textarea",{value:S,onChange:t=>T(t.target.value),placeholder:"O pega aqui el contenido del comunicado, circular o boletin que deseas transformar en articulo...",className:"w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary-300 focus:border-transparent transition-all",rows:4,disabled:U}),e.jsxs("div",{className:"mt-3",children:[e.jsxs("label",{className:"flex items-center gap-2 text-sm font-medium text-neutral-700 mb-1.5",children:[e.jsx(mt,{className:"w-4 h-4 text-primary-500"}),"Aseguradora (para imagen de portada)"]}),e.jsxs("select",{value:de,onChange:t=>ge(t.target.value),disabled:U,className:"w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-300 focus:border-transparent transition-all bg-surface-card",children:[e.jsx("option",{value:"",children:"Sin aseguradora (generar sin logo)"}),re.map(t=>e.jsx("option",{value:t.id,children:t.name},t.id))]}),de&&e.jsxs("div",{className:"flex items-center gap-2 mt-2 p-2 bg-surface-card border border-soft rounded-lg",children:[e.jsx("img",{src:re.find(t=>t.id===de)?.logo_url,alt:"",className:"h-8 w-auto object-contain"}),e.jsx("span",{className:"text-xs text-neutral-500",children:"El logo y nombre apareceran en la imagen de portada generada"})]})]}),ne&&e.jsxs("div",{className:"flex items-center gap-2 mt-2 p-2 bg-red-50 border border-red-200 rounded-lg",children:[e.jsx(be,{className:"w-4 h-4 text-red-500 flex-shrink-0"}),e.jsx("span",{className:"text-sm text-red-700",children:ne})]}),e.jsx(W,{type:"button",onClick:Pe,disabled:U||m.length===0&&!S.trim(),className:"mt-3 w-full sm:w-auto",children:U?e.jsxs(e.Fragment,{children:[e.jsx(Ne,{className:"w-4 h-4 mr-2 animate-spin"}),"Procesando con IA..."]}):e.jsxs(e.Fragment,{children:[e.jsx(je,{className:"w-4 h-4 mr-2"}),"Procesar con IA"]})}),U&&e.jsx("p",{className:"text-xs text-neutral-500 mt-2",children:"Esto puede tomar 30-60 segundos. Se generara el titulo, contenido e imagen."})]}),$&&e.jsx(W,{type:"button",variant:"outline",size:"sm",onClick:()=>{te(!1),v([]),T("")},className:"mt-2",children:"Procesar otro documento"})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(le,{htmlFor:"titulo",className:"text-sm sm:text-base",children:"Título *"}),e.jsx(vt,{id:"titulo",type:"text",value:j,onChange:t=>A(t.target.value),placeholder:"Escribe un título atractivo...",className:"text-base sm:text-lg py-3"})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(le,{htmlFor:"categoria",className:"text-sm sm:text-base",children:"Categoría *"}),e.jsx("select",{id:"categoria",value:E,onChange:t=>M(t.target.value),className:"w-full px-3 sm:px-4 py-2 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-base text-sm sm:text-base bg-surface-card",children:l.map(t=>e.jsx("option",{value:t.id,children:t.nombre},t.id))})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(le,{className:"text-sm sm:text-base",children:"Imagen Principal *"}),B?e.jsxs("div",{className:"relative rounded-lg overflow-hidden",children:[e.jsx("img",{src:B,alt:"Preview",className:"w-full h-48 sm:h-64 md:h-80 object-cover"}),e.jsx(W,{type:"button",variant:"outline",size:"sm",onClick:()=>{x(null),I("")},className:"absolute top-2 right-2 bg-white/90 backdrop-blur-sm hover:bg-white text-red-600 hover:text-red-700",children:e.jsx(me,{className:"w-4 h-4"})})]}):e.jsxs("label",{className:"flex flex-col items-center justify-center w-full h-48 sm:h-64 border-2 border-dashed border-neutral-300 rounded-lg cursor-pointer hover:border-accent active:border-accent transition-colors bg-neutral-50 hover:bg-neutral-100 btn-touch",children:[e.jsx(ve,{className:"w-10 h-10 sm:w-12 sm:h-12 text-neutral-500 mb-2"}),e.jsx("span",{className:"text-sm sm:text-base text-neutral-600 font-medium",children:"Click para subir imagen"}),e.jsx("span",{className:"text-xs sm:text-sm text-neutral-500 mt-1",children:"JPG, PNG o WEBP"}),e.jsx("input",{type:"file",accept:"image/*",onChange:Ae,className:"hidden"})]})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(le,{htmlFor:"contenido",className:"text-sm sm:text-base",children:"Contenido *"}),e.jsx(It,{value:L,onChange:a,placeholder:"Escribe el contenido del comunicado...",minHeight:"300px"})]}),e.jsxs("div",{className:"space-y-3",children:[e.jsx(le,{className:"text-sm sm:text-base",children:"Archivos Adjuntos (máximo 5)"}),y.length>0&&e.jsxs("div",{className:"space-y-2",children:[e.jsx("span",{className:"text-xs text-neutral-500 font-medium",children:"Archivos existentes:"}),y.map(t=>e.jsxs("div",{className:"flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100",children:[e.jsxs("div",{className:"flex items-center gap-2 flex-1 min-w-0",children:[e.jsx(xe,{className:"w-4 h-4 text-accent-ink flex-shrink-0"}),e.jsx("a",{href:t.archivo_url,target:"_blank",rel:"noopener noreferrer",className:"text-xs sm:text-sm text-blue-700 truncate hover:underline",children:t.nombre_archivo})]}),e.jsx(W,{type:"button",variant:"ghost",size:"sm",onClick:async()=>{await St(t.id),R(y.filter(c=>c.id!==t.id))},className:"text-red-600 hover:text-red-700 flex-shrink-0",children:e.jsx(me,{className:"w-4 h-4"})})]},t.id))]}),e.jsxs("label",{className:"inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 border border-neutral-300 rounded-lg cursor-pointer hover:bg-neutral-50 active:bg-neutral-100 transition-colors btn-touch",children:[e.jsx(ut,{className:"w-4 h-4 sm:w-5 sm:h-5 text-neutral-600"}),e.jsx("span",{className:"text-sm sm:text-base text-neutral-700 font-medium",children:"Agregar archivos"}),e.jsx("input",{type:"file",multiple:!0,onChange:Ie,className:"hidden",disabled:o.length+y.length>=5})]}),o.length>0&&e.jsx("div",{className:"space-y-2",children:o.map((t,c)=>e.jsxs("div",{className:"flex items-center justify-between p-3 bg-neutral-50 rounded-lg",children:[e.jsx("span",{className:"text-xs sm:text-sm text-neutral-700 truncate flex-1 mr-2",children:t.name}),e.jsx(W,{type:"button",variant:"ghost",size:"sm",onClick:()=>Fe(c),className:"text-red-600 hover:text-red-700 flex-shrink-0",children:e.jsx(me,{className:"w-4 h-4"})})]},c))})]}),e.jsxs("div",{className:"border-t pt-6",children:[e.jsx("h3",{className:"text-lg font-semibold text-neutral-900 mb-4",children:"Opciones de Publicación"}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsxs("label",{className:"flex items-center gap-2 cursor-pointer",children:[e.jsx("input",{type:"radio",checked:z,onChange:()=>G(!0),className:"w-4 h-4 text-accent-ink"}),e.jsx("span",{className:"text-neutral-700",children:"Publicar ahora"})]}),e.jsxs("label",{className:"flex items-center gap-2 cursor-pointer",children:[e.jsx("input",{type:"radio",checked:!z,onChange:()=>G(!1),className:"w-4 h-4 text-accent-ink"}),e.jsx("span",{className:"text-neutral-700",children:"Programar publicación"})]})]}),!z&&e.jsxs("div",{children:[e.jsx("label",{className:"block text-sm font-medium text-neutral-700 mb-2",children:"Fecha y hora de publicación"}),e.jsx("input",{type:"datetime-local",value:J,onChange:t=>oe(t.target.value),className:"px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/40"})]}),ae&&e.jsxs("label",{className:"flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer",children:[e.jsx("input",{type:"checkbox",checked:Q,onChange:t=>D(t.target.checked),className:"w-5 h-5 text-amber-600"}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(ht,{className:"w-5 h-5 text-amber-600"}),e.jsx("span",{className:"font-medium text-neutral-900",children:"Fijar comunicado"})]}),e.jsx("span",{className:"text-sm text-neutral-600 ml-auto",children:"Se mostrará siempre arriba"})]})]})]}),e.jsxs("div",{className:"border-t pt-6",children:[e.jsxs("h3",{className:"text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2",children:[e.jsx(Se,{className:"w-5 h-5"}),"Control de Visibilidad"]}),V&&e.jsx("div",{className:"space-y-4",children:e.jsxs("div",{className:"bg-primary-50 border border-primary-200 rounded-lg p-4",children:[e.jsx("label",{className:"block text-sm font-medium text-neutral-700 mb-3",children:"¿A quién deseas mostrar este comunicado?"}),e.jsx("p",{className:"text-sm text-neutral-600 mb-3",children:"Este comunicado será visible para los roles seleccionados de tu oficina. Los Administradores siempre podrán verlo."}),e.jsx("div",{className:"space-y-2",children:["Empleado","Agente"].map(t=>e.jsxs("label",{className:"flex items-center gap-2 cursor-pointer",children:[e.jsx("input",{type:"checkbox",checked:C.includes(t),onChange:c=>{c.target.checked?Y([...C,t]):Y(C.filter(N=>N!==t))},className:"w-4 h-4 text-accent-ink rounded"}),e.jsxs("span",{className:"text-neutral-700",children:[t,"s de mi oficina"]})]},t))}),C.length===0&&e.jsx("p",{className:"text-sm text-amber-600 mt-3",children:"Debes seleccionar al menos un destinatario"})]})}),ae&&e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"block text-sm font-medium text-neutral-700 mb-3",children:"¿Quién puede ver este comunicado?"}),e.jsxs("div",{className:"space-y-2",children:[e.jsxs("label",{className:"flex items-center gap-3 p-3 border border-neutral-300 rounded-lg cursor-pointer hover:bg-gray-50 transition",children:[e.jsx("input",{type:"radio",checked:w==="todos",onChange:()=>Z("todos"),className:"w-4 h-4 text-accent-ink"}),e.jsx(pt,{className:"w-5 h-5 text-neutral-600"}),e.jsxs("div",{children:[e.jsx("div",{className:"font-medium text-neutral-900",children:"Todos los usuarios"}),e.jsx("div",{className:"text-sm text-neutral-500",children:"Visible para toda la organización"})]})]}),e.jsxs("label",{className:"flex items-center gap-3 p-3 border border-neutral-300 rounded-lg cursor-pointer hover:bg-gray-50 transition",children:[e.jsx("input",{type:"radio",checked:w==="rol",onChange:()=>Z("rol"),className:"w-4 h-4 text-accent-ink"}),e.jsx(xt,{className:"w-5 h-5 text-neutral-600"}),e.jsxs("div",{children:[e.jsx("div",{className:"font-medium text-neutral-900",children:"Por roles"}),e.jsx("div",{className:"text-sm text-neutral-500",children:"Visible solo para roles específicos"})]})]}),e.jsxs("label",{className:"flex items-center gap-3 p-3 border border-neutral-300 rounded-lg cursor-pointer hover:bg-gray-50 transition",children:[e.jsx("input",{type:"radio",checked:w==="oficina",onChange:()=>Z("oficina"),className:"w-4 h-4 text-accent-ink"}),e.jsx(gt,{className:"w-5 h-5 text-neutral-600"}),e.jsxs("div",{children:[e.jsx("div",{className:"font-medium text-neutral-900",children:"Por oficinas"}),e.jsx("div",{className:"text-sm text-neutral-500",children:"Visible solo para oficinas específicas"})]})]})]})]}),w==="rol"&&e.jsxs("div",{className:"bg-primary-50 border border-primary-200 rounded-lg p-4",children:[e.jsx("label",{className:"block text-sm font-medium text-neutral-700 mb-3",children:"Selecciona los roles que pueden ver este comunicado:"}),e.jsx("div",{className:"space-y-2",children:["Administrador","Gerente","Empleado","Agente"].map(t=>e.jsxs("label",{className:"flex items-center gap-2 cursor-pointer",children:[e.jsx("input",{type:"checkbox",checked:C.includes(t),onChange:c=>{c.target.checked?Y([...C,t]):Y(C.filter(N=>N!==t))},className:"w-4 h-4 text-accent-ink rounded"}),e.jsx("span",{className:"text-neutral-700",children:t})]},t))})]}),w==="oficina"&&e.jsxs("div",{className:"bg-primary-50 border border-primary-200 rounded-lg p-4",children:[e.jsx("label",{className:"block text-sm font-medium text-neutral-700 mb-3",children:"Selecciona las oficinas que pueden ver este comunicado:"}),e.jsx("div",{className:"space-y-2 max-h-48 overflow-y-auto",children:ue.map(t=>e.jsxs("label",{className:"flex items-center gap-2 cursor-pointer",children:[e.jsx("input",{type:"checkbox",checked:O.includes(t.id),onChange:c=>{c.target.checked?ce([...O,t.id]):ce(O.filter(N=>N!==t.id))},className:"w-4 h-4 text-accent-ink rounded"}),e.jsx("span",{className:"text-neutral-700",children:t.nombre})]},t.id))})]})]})]}),e.jsxs("div",{className:"border-t pt-6 flex justify-end gap-3",children:[e.jsx(W,{variant:"outline",onClick:()=>i("/comunicados"),children:"Cancelar"}),e.jsx(W,{onClick:He,disabled:F,children:F?e.jsxs(e.Fragment,{children:[e.jsx(Ne,{className:"w-4 h-4 mr-2 animate-spin"}),"Guardando..."]}):e.jsxs(e.Fragment,{children:[e.jsx(ft,{className:"w-4 h-4 mr-2"}),ie?"Actualizar":"Publicar"]})})]})]})]})}):null}export{Vt as default};
