(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const toast=document.createElement("div");
  toast.className="toast"; toast.setAttribute("role","status"); toast.setAttribute("aria-live","polite");
  document.body.appendChild(toast);
  function showToast(msg){toast.textContent=msg;toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),1800)}
  function safeGet(key,fallback){try{const v=localStorage.getItem(key);return v===null?fallback:v}catch(e){return fallback}}
  function safeSet(key,val){try{localStorage.setItem(key,val);return true}catch(e){return false}}
  function safeJSON(key,fallback){try{return JSON.parse(safeGet(key,""))||fallback}catch(e){return fallback}}

  // Live theatrical countdowns.
  function pad2(n){ return String(Math.max(0,n)).padStart(2,"0"); }
  function partsUntil(target){
    const ms=Math.max(0,target-Date.now());
    const total=Math.floor(ms/1000);
    return {
      totalMs:ms,
      days:Math.floor(total/86400),
      hours:Math.floor((total%86400)/3600),
      minutes:Math.floor((total%3600)/60),
      seconds:total%60
    };
  }
  function paintCountdown(prefix,target){
    const p=partsUntil(target);
    const days=$("#"+prefix+"Days"),hours=$("#"+prefix+"Hours"),minutes=$("#"+prefix+"Minutes"),seconds=$("#"+prefix+"Seconds");
    if(days) days.textContent=String(p.days);
    if(hours) hours.textContent=pad2(p.hours);
    if(minutes) minutes.textContent=pad2(p.minutes);
    if(seconds) seconds.textContent=pad2(p.seconds);
    return p;
  }
  function updateMovieCountdowns(){
    // Local midnight keeps the counter intuitive for friends opening the site in their own timezone.
    const doomsday=new Date(2026,11,18,0,0,0);
    const encore=new Date(2026,8,25,0,0,0);
    const d=paintCountdown("doomsday",doomsday);
    paintCountdown("encore",encore);

    // Progress from the start of 2026 to release, purely as a visual road-to-release meter.
    const start=new Date(2026,0,1,0,0,0).getTime();
    const end=doomsday.getTime();
    const now=Math.min(end,Math.max(start,Date.now()));
    const pct=Math.max(0,Math.min(100,((now-start)/(end-start))*100));
    const bar=$("#doomsdayProgress");
    const label=$("#doomsdayProgressText");
    if(bar) bar.style.width=pct.toFixed(1)+"%";
    if(label){
      label.textContent=d.totalMs<=0?"DOOMSDAY HAS ARRIVED":(d.days<=30?"FINAL MONTH":(d.days<=100?"FINAL STRETCH":"APPROACHING"));
    }
  }
  updateMovieCountdowns();
  setInterval(updateMovieCountdowns,1000);


  // Confidence desk.
  const tier=$("#intelTier"), cor=$("#intelCorroboration"), visual=$("#intelVisual"), fit=$("#intelFit");
  function signed(n){n=Number(n)||0;return (n>0?"+":"")+n}
  function calcScore(){
    const a=Number(tier?.value||0), b=Number(cor?.value||0), c=Number(visual?.value||0), d=Number(fit?.value||0);
    const score=Math.max(1,Math.min(100,Math.round(a+b+c+d)));
    if($("#scoreNumber")) $("#scoreNumber").innerHTML=score+"<span>%</span>";
    if($("#scoreFill")) $("#scoreFill").style.width=score+"%";
    if($("#reasonTier")) $("#reasonTier").textContent=a;
    if($("#reasonCor")) $("#reasonCor").textContent=signed(b);
    if($("#reasonVisual")) $("#reasonVisual").textContent=signed(c);
    if($("#reasonFit")) $("#reasonFit").textContent=signed(d);
    return score;
  }
  [tier,cor,visual,fit].filter(Boolean).forEach(el=>el.addEventListener("change",calcScore));
  $("#scoreIntel")?.addEventListener("click",()=>{const n=calcScore();showToast("S.A.L.E.M. confidence: "+n+"%")});
  calcScore();

  // Local intel queue.
  const queueKey="salem-doomsday-intel-queue-v1";
  let queue=safeJSON(queueKey,[]);
  function renderQueue(){
    const box=$("#intelQueue"); if(!box)return;
    $("#queueCount").textContent=queue.length+" SAVED";
    if(!queue.length){box.innerHTML='<div class="queue-empty">Nothing saved yet. Grade a source and add it here.</div>';return}
    box.innerHTML=queue.slice().reverse().map((item,revIndex)=>{
      const realIndex=queue.length-1-revIndex;
      const url=item.url?'<a class="inspect-link" target="_blank" rel="noopener" href="'+item.url.replace(/"/g,"&quot;")+'">OPEN SOURCE ↗</a>':"";
      return '<div class="queue-item"><div class="queue-item-head"><div><b>'+escapeHtml(item.title)+'</b><br><small>'+escapeHtml(item.tierLabel)+' // '+item.score+'%</small></div><button class="filter2 queue-delete" data-delete="'+realIndex+'" type="button">REMOVE</button></div><p>'+escapeHtml(item.notes||"No notes yet.")+'</p>'+url+'</div>';
    }).join("");
    $$(".queue-delete",box).forEach(b=>b.addEventListener("click",()=>{
      queue.splice(Number(b.dataset.delete),1);safeSet(queueKey,JSON.stringify(queue));renderQueue();showToast("Intel removed");
    }));
  }
  function escapeHtml(v){return String(v||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
  $("#intelForm")?.addEventListener("submit",e=>{
    e.preventDefault();
    const title=$("#intelTitle").value.trim(); if(!title){showToast("Add a claim/headline first");return}
    const item={
      title, url:$("#intelUrl").value.trim(), notes:$("#intelNotes").value.trim(),
      tierLabel:$("#intelTier").options[$("#intelTier").selectedIndex].text,
      score:calcScore(), saved:new Date().toISOString()
    };
    queue.push(item); if(queue.length>40)queue=queue.slice(-40);
    safeSet(queueKey,JSON.stringify(queue));renderQueue();e.currentTarget.reset();
    $("#intelTier").value="70";$("#intelCorroboration").value="0";$("#intelVisual").value="0";$("#intelFit").value="2";calcScore();
    showToast("Saved to local intel queue");
  });
  $("#clearQueue")?.addEventListener("click",()=>{queue=[];safeSet(queueKey,"[]");renderQueue();showToast("Intel queue cleared")});
  renderQueue();

  // Theory filtering / locked picks / private notes.
  let theoryFilter="all";
  const theorySearch=$("#theorySearch");
  function applyTheories(){
    const q=(theorySearch?.value||"").toLowerCase().trim();
    $$(".theory-card").forEach(card=>{
      const type=card.dataset.theoryType||"";
      const key=card.dataset.key||"";
      const locked=safeGet("salem-lock-"+key,"0")==="1";
      const typeOK=theoryFilter==="all"||type===theoryFilter||(theoryFilter==="locked"&&locked);
      const searchOK=!q||card.innerText.toLowerCase().includes(q);
      card.classList.toggle("hidden",!(typeOK&&searchOK));
    });
  }
  $$(".theory-filter").forEach(btn=>btn.addEventListener("click",()=>{
    $$(".theory-filter").forEach(x=>x.classList.remove("active"));btn.classList.add("active");theoryFilter=btn.dataset.theoryFilter;applyTheories();
  }));
  theorySearch?.addEventListener("input",applyTheories);
  $$(".lock-btn").forEach(btn=>{
    const key=btn.dataset.lock, locked=safeGet("salem-lock-"+key,"0")==="1";
    btn.classList.toggle("locked",locked);btn.textContent=locked?"PREDICTION LOCKED ✓":"LOCK PREDICTION";
    btn.addEventListener("click",()=>{
      const next=safeGet("salem-lock-"+key,"0")!=="1";safeSet("salem-lock-"+key,next?"1":"0");
      btn.classList.toggle("locked",next);btn.textContent=next?"PREDICTION LOCKED ✓":"LOCK PREDICTION";
      showToast(next?"Prediction locked":"Prediction unlocked");applyTheories();
    });
  });
  $$(".note-toggle").forEach(btn=>btn.addEventListener("click",()=>{
    const p=$('[data-note-panel="'+btn.dataset.noteToggle+'"]');p?.classList.toggle("show");
  }));
  $$(".theory-note").forEach(area=>{area.value=safeGet("salem-note-"+area.dataset.note,"")});
  $$(".save-note").forEach(btn=>btn.addEventListener("click",()=>{
    const key=btn.dataset.noteSave,area=$('[data-note="'+key+'"]');safeSet("salem-note-"+key,area?.value||"");showToast("Private theory note saved");
  }));

  // Leak gallery filters.
  let leakFilter="all"; const leakSearch=$("#leakSearch");
  function applyLeaks(){
    const q=(leakSearch?.value||"").toLowerCase().trim();
    $$(".leak-card").forEach(card=>{
      const type=card.dataset.leakType||"";
      const ok=(leakFilter==="all"||type===leakFilter)&&(!q||card.innerText.toLowerCase().includes(q));
      card.classList.toggle("hidden",!ok);
    });
  }
  $$(".leak-filter").forEach(btn=>btn.addEventListener("click",()=>{
    $$(".leak-filter").forEach(x=>x.classList.remove("active"));btn.classList.add("active");leakFilter=btn.dataset.leakFilter;applyLeaks();
  }));
  leakSearch?.addEventListener("input",applyLeaks);

  // Evidence board inspector: links still work normally without JS. With JS, first tap inspects; "open file" stays available.
  const nodeInfo={
    doom:["Core Node","Doctor Doom","94%","7","ANCHOR","#theory-doom-savior","Almost every route to Battleworld passes through Doom: identity, Incursions, multiversal power and the final God Emperor state."],
    incursions:["Structure","Incursions","89%","5","CORE","#theory-incursions","This is the cleanest backbone for getting Avengers, X-Men and multiple realities into direct conflict without inventing a completely new mechanism."],
    battleworld:["Endgame","Battleworld","85%","6","LIKELY","#theory-battleworld","Battleworld solves the transition problem between a catastrophic Doomsday ending and a Secret Wars movie that can immediately begin inside a broken reality."],
    face:["Identity","RDJ Face","73%","3","THEORY","#theory-face","Even if Victor is not a Tony variant, the face can function as psychological warfare against heroes who associate it with sacrifice and trust."],
    stark:["Identity","Tony Stark Return","76%","4","THEORY","#theory-rdj-stark","The casting itself provides cover for RDJ to be present during production. The missing piece remains independent evidence that Tony himself returns."],
    avx:["Conflict","Avengers vs X-Men","84%","4","STRONG","#theory-avx","An Incursion creates a conflict where both sides can be heroic and still believe the other Earth has to die. That gives the crossover emotional stakes beyond cameos."],
    loki:["Power Node","Loki","71%","4","ACTIVE","#theory-loki","Loki is currently positioned as a living multiversal stabilizer. Any Doom/Battleworld plan logically needs to explain him, bypass him or use what he controls."],
    franklin:["Power Node","Franklin Richards","77%","4","ACTIVE","#theory-franklin","Franklin is an elegant MCU substitute or supplement for the raw reality-rebuilding power Doom needs once the multiverse is already collapsing."],
    savior:["Moral Theory","Doom the Savior","78%","5","ACTIVE","#theory-doom-savior","The most Doom-like version of the story is that he identifies the catastrophe correctly and then uses that truth to justify an authoritarian solution only he is willing to execute."],
    "god-emperor":["Final State","God Emperor Doom","86%","5","ENDGAME","#theory-god-emperor","Ending Doomsday after Doom has already won lets Secret Wars begin from the comic's strongest image: heroes waking inside a reality that belongs to him."]
  };
  $$(".map-node-link[data-node]").forEach(link=>link.addEventListener("click",e=>{
    if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches)e.preventDefault();
    const d=nodeInfo[link.dataset.node];if(!d)return;
    $("#inspectClass").textContent=d[0];$("#inspectTitle").textContent=d[1];$("#inspectConfidence").textContent=d[2];
    $("#inspectLinks").textContent=d[3];$("#inspectStatus").textContent=d[4];$("#inspectLink").href=d[5];$("#inspectAnalysis").textContent=d[6];
    $("#inspectText").textContent="Selected from the theory constellation. Follow the connected theory file for my full take.";
    showToast("Inspecting "+d[1]);
  }));

  // Graceful remote-image fallback.
  $$(".leak-img img").forEach(img=>img.addEventListener("error",()=>{
    img.style.display="none";
    const f=document.createElement("div");f.className="image-fallback";f.innerHTML="<div><b>REMOTE IMAGE UNAVAILABLE</b><br><br>The source link below still opens the original post/article.</div>";
    img.parentElement.insertBefore(f,img.nextSibling);
  }));
})();


// ---------- Repo live-intel data layer ----------
(function(){
  const root = document;
  const grid = root.querySelector('#liveIntelGrid');
  if(!grid) return;
  const updated = root.querySelector('#liveUpdated');
  const count = root.querySelector('#liveCount');
  let liveItems = [];
  let liveFilter = 'all';

  function esc(v){return String(v||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
  function cardClass(tier){ return tier==='S'?'official':(tier==='A'?'trade':(tier==='B'?'theory':'leak')); }
  function tagClass(tier){ return tier==='S'?'green':(tier==='A'?'cyan':(tier==='B'?'purple':'red')); }
  function renderLive(){
    const items = liveFilter==='all' ? liveItems : liveItems.filter(x=>x.tier===liveFilter);
    if(!items.length){grid.innerHTML='<article class="intel"><h3>No matching live intel</h3><p>Try another tier or reload the data file.</p></article>';}
    else grid.innerHTML = items.map(item=>{
      const link = item.url ? '<a class="source-link" href="'+esc(item.url)+'" target="_blank" rel="noopener">OPEN SOURCE ↗</a>' : '';
      return '<article class="intel '+cardClass(item.tier)+'" data-live-tier="'+esc(item.tier)+'">'
        +'<div class="tags"><span class="tag '+tagClass(item.tier)+'">TIER '+esc(item.tier)+' // '+esc(item.source||'SOURCE')+'</span>'
        +(item.kind?'<span class="tag">'+esc(item.kind)+'</span>':'')+'</div>'
        +'<h3>'+esc(item.title)+'</h3><p>'+esc(item.summary||'')+'</p>'
        +'<div class="analysis"><b>S.A.L.E.M.:</b> '+esc(item.analysis||'Public-source item. Review source quality before promoting it into a theory.')+'</div>'
        +'<div class="leak-meta"><span>'+esc(item.published||'DATE UNKNOWN')+'</span><span>'+esc(item.confidence||0)+'% CONFIDENCE</span></div>'+link+'</article>';
    }).join('');
    if(count) count.textContent=items.length+' ITEM'+(items.length===1?'':'S');
  }
  async function loadLive(){
    try{
      const res = await fetch('data/live-intel.json?ts='+Date.now(), {cache:'no-store'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      const data = await res.json();
      liveItems = Array.isArray(data.items)?data.items:[];
      if(updated) updated.textContent='UPDATED // '+(data.updatedAt||'UNKNOWN');
      renderLive();
    }catch(err){
      if(updated) updated.textContent='LIVE DATA UNAVAILABLE // SHOWING FALLBACK';
    }
  }
  document.querySelectorAll('.live-filter').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.live-filter').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active'); liveFilter=btn.dataset.liveFilter||'all'; renderLive();
  }));
  document.querySelector('#reloadLive')?.addEventListener('click',loadLive);
  loadLive();


  // V11 leak database image loader: local cache -> image proxy -> original -> clean placeholder.
  let loadedLocal=0, loadedRemote=0, imageFailures=0;
  function proxyUrl(remote){return "https://images.weserv.nl/?url="+encodeURIComponent(remote)+"&w=1200&h=750&fit=cover&output=jpg&q=82"}
  $$(".db-image img[data-remote]").forEach(img=>{
    const badge=img.parentElement.querySelector("[data-image-status]");
    img.addEventListener("load",()=>{
      const stage=Number(img.dataset.fallbackStage||0);
      if(stage===0){loadedLocal++; if(badge)badge.textContent="LOCAL CACHE"}
      else {loadedRemote++; if(badge)badge.textContent=stage===1?"PROXY FALLBACK":"REMOTE SOURCE"}
      const mode=$("#imageMode");if(mode)mode.textContent=loadedLocal?"LOCAL + FALLBACK":"REMOTE FALLBACK";
    });
    img.addEventListener("error",()=>{
      const stage=Number(img.dataset.fallbackStage||0), remote=img.dataset.remote||"";
      if(stage===0 && remote){img.dataset.fallbackStage="1";img.src=proxyUrl(remote);return}
      if(stage===1 && remote){img.dataset.fallbackStage="2";img.src=remote;return}
      imageFailures++;
      const wrap=img.parentElement;img.remove();if(badge)badge.textContent="SOURCE ONLY";
      const f=document.createElement("div");f.className="image-fallback-v11";f.innerHTML="<div><b>IMAGE HOST BLOCKED</b><br><br>Open the attached source trail. GitHub's cache workflow will store a local thumbnail when available.</div>";wrap.insertBefore(f,wrap.firstChild);
    });
  });

  // V11 count + confidence sorting.
  let leakSort="default";
  const gallery=$("#leakGallery");
  function refreshVisibleLeakCount(){
    const visible=$$(".leak-card",gallery).filter(c=>!c.classList.contains("hidden")).length;
    const el=$("#leakVisibleCount");if(el)el.textContent=visible+" FILES VISIBLE";
  }
  if(typeof applyLeaks==="function"){
    const originalApplyLeaks=applyLeaks;
    applyLeaks=function(){originalApplyLeaks();refreshVisibleLeakCount()};
  }
  $$(".leak-sort").forEach(btn=>btn.addEventListener("click",()=>{
    $$(".leak-sort").forEach(x=>x.classList.remove("active"));btn.classList.add("active");leakSort=btn.dataset.leakSort;
    if(!gallery)return;
    const cards=$$(".leak-card",gallery);
    if(leakSort==="confidence")cards.sort((a,b)=>Number(b.dataset.confidence||0)-Number(a.dataset.confidence||0));
    else cards.sort((a,b)=>Number(a.dataset.order||0)-Number(b.dataset.order||0));
    cards.forEach(c=>gallery.appendChild(c));refreshVisibleLeakCount();
  }));
  refreshVisibleLeakCount();

})();

// Installable PWA / offline shell.
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
