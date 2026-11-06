/* ===== Granda online: substitui os recursos do Claude (banco, arquivos, downloads, IA) pelo servidor da Netlify ===== */
(function(){
  const api=async(p,o)=>{const r=await fetch(p,Object.assign({credentials:'same-origin'},o||{}));if(r.status===401){mostraLogin();throw Object.assign(new Error('sessão expirada'),{code:'not_granted'})}
    if(!r.ok){let t='';try{t=(await r.json()).erro}catch(e){}throw Object.assign(new Error(t||('erro '+r.status)),{code:'http_'+r.status})}return r};
  let logado;const pronto=new Promise(res=>{logado=res});
  function mostraLogin(){if(document.getElementById('grLogin'))return;const d=document.createElement('div');d.id='grLogin';
    d.innerHTML=`<div style="position:fixed;inset:0;z-index:9999;background:#2b3a7a;display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,sans-serif">
      <form style="background:#fff;border-radius:16px;padding:26px 22px;width:100%;max-width:360px;box-shadow:0 10px 40px #0004">
        <img src="${typeof GRANDA_LOGO!=='undefined'?GRANDA_LOGO:''}" alt="Granda" style="height:56px;display:block;margin:0 auto 14px">
        <div style="font-weight:700;font-size:17px;text-align:center;margin-bottom:4px">Ajustes de Arquivo</div>
        <div style="color:#666;font-size:13px;text-align:center;margin-bottom:16px">Digite a senha da Granda para entrar</div>
        <input type="password" name="s" autocomplete="current-password" placeholder="Senha" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #ccd;border-radius:10px;font-size:16px">
        <button style="width:100%;margin-top:12px;padding:12px;border:0;border-radius:10px;background:#d6336c;color:#fff;font-weight:700;font-size:15px">Entrar</button>
        <div class="m" style="color:#c92a2a;font-size:13px;text-align:center;margin-top:10px"></div></form></div>`;
    document.body.appendChild(d);const f=d.querySelector('form');f.s.focus();
    f.onsubmit=async e=>{e.preventDefault();f.querySelector('.m').textContent='Entrando…';
      const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({senha:f.s.value})});
      if(r.ok)location.reload();else f.querySelector('.m').textContent='Senha incorreta.'}}
  window.addEventListener('DOMContentLoaded',async()=>{try{const r=await fetch('/api/login');if(r.ok)logado();else mostraLogin()}catch(e){mostraLogin()}});
  // senha e sair (em Cadastros)
  window.addEventListener('DOMContentLoaded',()=>{const tb=document.getElementById('tab-tipos');if(!tb)return;const c=document.createElement('div');c.className='card';
    c.innerHTML=`<h2>Acesso ao sistema</h2><p class="note" style="margin-top:0">Todos entram com a mesma senha da Granda. Trocar a senha desconecta os outros aparelhos.</p>
      <div class="g3"><div><label class="f">Senha atual</label><input type="password" id="grSA"></div><div><label class="f">Nova senha</label><input type="password" id="grSN"></div>
      <div style="align-self:end"><button class="btn acc" id="grSB" style="width:100%">Trocar senha</button></div></div>
      <div class="row" style="margin-top:10px"><button class="btn ghost sm" id="grSair">Sair deste aparelho</button><span id="grSM" class="note"></span></div>`;
    tb.appendChild(c);
    c.querySelector('#grSB').onclick=async()=>{const m=c.querySelector('#grSM');m.textContent='Trocando…';const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({atual:c.querySelector('#grSA').value,nova:c.querySelector('#grSN').value})});
      const j=await r.json().catch(()=>({}));m.textContent=r.ok?'Senha trocada.':(j.erro||'Não foi possível trocar.');if(r.ok){c.querySelector('#grSA').value='';c.querySelector('#grSN').value=''}};
    c.querySelector('#grSair').onclick=async()=>{await fetch('/api/login',{method:'DELETE'});location.reload()}});
  // ---------- banco (coleção/documento com atualização periódica) ----------
  const ouvintes=new Set();const atualizaTodos=()=>ouvintes.forEach(f=>f());
  const snapDoc=(id,data)=>({id,exists:data!=null,data:()=>data});
  const ouvir=(fn)=>{let last='';const tick=async()=>{try{const t=await fn();if(t.raw!==last){last=t.raw;t.cb()}}catch(e){t&&t.err&&t.err(e)}};return tick};
  function colRef(name){return{doc:id=>docRef(name+'/'+id),
    onSnapshot(cb,err){const tick=ouvir(async()=>{const r=await api('/api/db?col='+encodeURIComponent(name));const raw=await r.text();return{raw,cb:()=>cb({docs:JSON.parse(raw).map(x=>snapDoc(x.id,x.data))}),err}});
      ouvintes.add(tick);tick();const h=setInterval(()=>{if(!document.hidden)tick()},10000);return()=>{clearInterval(h);ouvintes.delete(tick)}}}}
  function docRef(path){const u='/api/db?doc='+encodeURIComponent(path);return{
    async get(){const r=await api(u);const j=await r.json();return snapDoc(path.split('/').pop(),j.data)},
    async set(data){await api(u,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(data)});atualizaTodos()},
    async update(data){const r=await api(u);const j=await r.json();await this.set(Object.assign({},j.data||{},data))},
    async delete(){await api(u,{method:'DELETE'});atualizaTodos()},
    onSnapshot(cb,err){const tick=ouvir(async()=>{const r=await api(u);const raw=await r.text();return{raw,cb:()=>cb(snapDoc(path.split('/').pop(),JSON.parse(raw).data)),err}});
      ouvintes.add(tick);tick();const h=setInterval(()=>{if(!document.hidden)tick()},15000);return()=>{clearInterval(h);ouvintes.delete(tick)}}}}
  const db={collection:colRef,doc:docRef};
  // ---------- arquivos ----------
  const assets={async upload(blob){if(blob.size>5.5e6)throw Object.assign(new Error('arquivo grande demais (máx. 5 MB)'),{code:'too_large'});
      const r=await api('/api/arquivo',{method:'POST',headers:{'content-type':blob.type||'application/octet-stream'},body:blob});return r.json()},
    async delete(id){await api('/api/arquivo?id='+encodeURIComponent(id),{method:'DELETE'})},async list(){return{assets:[],usage:{}}}};
  // ---------- downloads ----------
  const downloads={async save({filename,data}){const blob=data instanceof Blob?data:new Blob([data]);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename||'arquivo';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},4000)}};
  // ---------- IA (Montar 3D) ----------
  const b64=async b=>{const u=new Uint8Array(await b.arrayBuffer());let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
  async function sample(input,opts){opts=opts||{};const messages=typeof input==='string'?[{role:'user',content:input}]:input;
    const images=[];for(const im of (opts.images||[]))images.push({media_type:im.type||'image/png',data:await b64(im)});
    if(opts.onText)opts.onText({text:'Thinking...',delta:''});
    const r=await api('/api/ia',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages,images,modelTier:opts.modelTier})});
    const rd=r.body.getReader();const dec=new TextDecoder();let text='';
    for(;;){const {done,value}=await rd.read();if(done)break;const d=dec.decode(value,{stream:true});text+=d;if(opts.onText)opts.onText({text,delta:d})}
    const k=text.indexOf('\u0000ERRO:');if(k>=0)throw Object.assign(new Error(text.slice(k+6)),{code:'error',text:text.slice(0,k)});
    return{text,truncated:false}}
  sample.json=async(i,o)=>JSON.parse((await sample(i,o)).text);sample.limits=async()=>({images:true});
  const NS={db,assets,downloads,sample};
  window.claude={use:async n=>{await pronto;return NS[n]||null}};
})();
