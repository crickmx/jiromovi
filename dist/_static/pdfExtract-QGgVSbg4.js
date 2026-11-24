const i="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs",p="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";async function d(s){const a=await import(i);a.GlobalWorkerOptions.workerSrc=p;const r=await s.arrayBuffer(),e=await a.getDocument({data:r}).promise,n=[];for(let t=1;t<=e.numPages;t++){const o=(await(await e.getPage(t)).getTextContent()).items.map(c=>c.str).join(" ");o.trim()&&n.push(o)}return n.join(`

`)}export{d as extractTextFromPdf};
