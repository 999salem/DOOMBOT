(async function(){
  const D=window.DOOMBOT_V18;
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  let client,user,profile=null,isMod=false;
  let realThreads=[],seedThreads=[],seedReplies=[],threads=[],profiles=new Map(),threadVotes=[],replyCounts=new Map(),follows=new Set(),blocked=new Set();
  let activeChannel='all',searchTerm='',selectedThread=null,detailReplyVotes=[];
  const feed=$('#warFeed'),composer=$('#warComposer'),detail=$('#warDetail');

  function permanent(){return D.isPermanent(user)}
  function requireMember(){
    if(permanent())return true;
    D.toast('Sign in to post, vote or reply.');
    $('#warGuestGate')?.scrollIntoView({behavior:'smooth',block:'center'});
    return false;
  }
  function isSeed(t){return String(t?.id||'').startsWith('seed-')}
  function pFor(id){
    return profiles.get(id)||{user_id:id,username:'member',display_name:'DOOMBOT MEMBER',role:'member',seed:false};
  }
  function userLink(p){
    return p.seed
      ?`<span>@${D.esc(p.username||'archive')}</span>`
      :`<a href="./profile.html?u=${encodeURIComponent(p.username||'')}">@${D.esc(p.username||'member')}</a>`;
  }
  function roleBadge(p){
    if(!p?.role||p.role==='member')return '';
    return `<span class="v18-role ${D.roleClass(p.role)}">${D.roleLabel(p.role)}</span>`;
  }
  function voteCount(t){
    if(isSeed(t))return Number(t.seed_votes||0);
    return threadVotes.filter(v=>String(v.thread_id)===String(t.id)).length;
  }
  function hasVote(t){
    return !isSeed(t)&&threadVotes.some(v=>String(v.thread_id)===String(t.id)&&v.user_id===user?.id);
  }
  function repliesFor(t){
    return isSeed(t)?Number(t.seed_replies||0):(replyCounts.get(String(t.id))||0);
  }
  function spoilerBlock(body,id,type='thread'){
    return `<div class="war-spoiler" data-reveal-spoiler="${type}:${D.attr(id)}">⚠ SPOILER HIDDEN // TAP TO REVEAL</div><div class="war-body" data-spoiler-body="${type}:${D.attr(id)}" hidden>${D.esc(body)}</div>`;
  }
  function bodyHtml(t){
    const hide=(profile?.hide_spoilers??true)&&t.spoiler;
    return hide?spoilerBlock(t.body,t.id):`<div class="war-body">${D.esc(t.body)}</div>`;
  }
  function theoryHtml(snapshot){
    if(!snapshot||typeof snapshot!=='object')return '';
    return `<div class="war-theory-snapshot"><b>THEORY FILE // ${D.esc(snapshot.title||'PERSONAL THEORY')}</b><br>${D.esc(snapshot.summary||'')}
      ${snapshot.confidence?`<br><b>CONFIDENCE:</b> ${Number(snapshot.confidence)}%`:''}
      ${snapshot.evidence?`<br><b>EVIDENCE:</b> ${D.esc(snapshot.evidence)}`:''}</div>`;
  }

  async function loadSeed(){
    try{
      const r=await fetch('./warroom-seed.json',{cache:'no-store'});
      if(!r.ok)throw new Error('seed');
      const data=await r.json();
      (data.profiles||[]).forEach(p=>profiles.set(p.id,{
        user_id:p.id,username:p.username,display_name:p.display_name,role:p.role||'member',
        avatar_url:null,joined_at:'2026-09-09T00:00:00Z',show_online:false,last_seen_at:'2026-09-09T00:00:00Z',
        seed:true,seed_avatar:p.avatar||'?'
      }));
      seedReplies=(data.replies||[]).map(r=>({...r,status:'active',updated_at:r.created_at}));
      seedThreads=(data.threads||[]).map(t=>({
        ...t,status:'active',updated_at:t.created_at,theory_snapshot:null,
        seed_votes:t.votes||0,
        seed_replies:seedReplies.filter(r=>String(r.thread_id)===String(t.id)).length
      }));
    }catch(e){seedThreads=[]}
  }

  function renderChrome(list){
    const realReplyTotal=[...replyCounts.values()].reduce((a,b)=>a+b,0);
    const seedReplyTotal=seedThreads.reduce((a,t)=>a+Number(t.seed_replies||0),0);
    const online=[...profiles.values()].filter(p=>!p.seed&&D.isOnline(p)).length;
    $('#warThreadTotal').textContent=threads.length;
    $('#warReplyTotal').textContent=realReplyTotal+seedReplyTotal;
    $('#warOnlineTotal').textContent=online;
    $('#warFeedStatus').textContent=list.length+' FILE'+(list.length===1?'':'S')+' VISIBLE';
    $('#warFeedLabel').textContent=activeChannel==='all'?'ALL FILES':D.channelLabel(activeChannel);

    $$('[data-channel-count]').forEach(el=>{
      const c=el.dataset.channelCount;
      el.textContent=c==='all'?threads.length:threads.filter(t=>t.channel===c).length;
    });

    const hot=[...threads].sort((a,b)=>{
      const as=voteCount(a)*2+repliesFor(a)+(a.pinned?20:0);
      const bs=voteCount(b)*2+repliesFor(b)+(b.pinned?20:0);
      return bs-as||new Date(b.created_at)-new Date(a.created_at);
    }).slice(0,5);
    const box=$('#warHotThreads');
    box.innerHTML=hot.map((t,i)=>`<a class="wr-hot-item" href="${isSeed(t)?'#':'./warroom.html?thread='+t.id}" ${isSeed(t)?'data-open-seed="'+D.attr(t.id)+'"':'data-open-thread="'+t.id+'"'}>
      <span>0${i+1}</span><div><b>${D.esc(t.title)}</b><small>${voteCount(t)} votes · ${repliesFor(t)} replies${isSeed(t)?' · seed':''}</small></div>
    </a>`).join('');
  }

  function renderFeed(){
    const q=searchTerm.toLowerCase();
    const list=threads.filter(t=>{
      if(!isSeed(t)&&blocked.has(t.author_id))return false;
      if(activeChannel!=='all'&&t.channel!==activeChannel)return false;
      if(q&&!(`${t.title} ${t.body}`.toLowerCase().includes(q)))return false;
      return true;
    });
    renderChrome(list);
    if(!list.length){
      feed.innerHTML='<div class="war-empty">NO ACTIVE SIGNAL IN THIS CHANNEL</div>';return;
    }

    feed.innerHTML=list.map(t=>{
      const p=pFor(t.author_id),seed=isSeed(t),votes=voteCount(t),replies=repliesFor(t),ownVote=hasVote(t),own=user?.id===t.author_id;
      const avatar=p.seed
        ?D.esc(p.seed_avatar||'?')
        :D.avatar(p);
      return `<article class="wr-card ${seed?'seed':''} ${t.pinned?'pinned':''} ${t.verified?'verified':''}" data-thread-card="${D.attr(t.id)}">
        <div class="wr-card-head">
          <div class="wr-avatar">${avatar}</div>
          <div class="wr-author">
            <div class="wr-author-line">
              ${userLink(p)} ${roleBadge(p)}
              ${seed?'<span class="wr-seed-tag">ARCHIVE SEED</span>':''}
            </div>
            <div class="wr-author-sub"><span>${D.channelLabel(t.channel)}</span><span>${seed?'FOUNDING ARCHIVE':D.relative(t.created_at)}</span></div>
          </div>
          <div class="wr-flags">
            ${t.pinned?'<span class="war-badge pin">PINNED</span>':''}
            ${t.verified?'<span class="war-badge verify">999SALEM VERIFIED</span>':''}
            ${t.locked?'<span class="war-badge lock">LOCKED</span>':''}
            ${t.spoiler?'<span class="war-badge">SPOILER</span>':''}
          </div>
        </div>

        <div class="wr-card-body">
          <h3>${D.esc(t.title)}</h3>
          ${bodyHtml(t)}
          ${theoryHtml(t.theory_snapshot)}
        </div>

        <div class="wr-card-actions">
          <div class="wr-actions-left">
            ${seed
              ?`<span class="wr-link seed-static">▲ ${votes}</span><button class="wr-link" data-open-seed="${D.attr(t.id)}">◌ DISCUSS ${replies}</button>`
              :`<button class="wr-link ${ownVote?'active':''}" data-vote-thread="${t.id}">▲ ${votes}</button>
                 <button class="wr-link" data-open-thread="${t.id}">◌ DISCUSS ${replies}</button>
                 ${permanent()?`<button class="wr-link ${follows.has(String(t.id))?'saved':''}" data-follow-thread="${t.id}">${follows.has(String(t.id))?'◆ SAVED':'◇ SAVE'}</button>`:''}`
            }
          </div>
          <div class="wr-actions-right">
            ${!seed&&own&&!t.locked?`<button class="wr-link" data-edit-thread="${t.id}">EDIT</button>`:''}
            ${!seed&&permanent()&&!own?`<button class="wr-link" data-report-thread="${t.id}">REPORT</button><button class="wr-link" data-mute-user="${D.attr(t.author_id)}">MUTE</button>`:''}
            ${!seed&&(own||isMod)?`<button class="wr-link danger" data-delete-thread="${t.id}">DELETE</button>`:''}
            ${!seed&&isMod?`<button class="wr-link saved" data-mod-thread="${t.id}" data-action="${t.pinned?'unpin':'pin'}">${t.pinned?'UNPIN':'PIN'}</button>
              <button class="wr-link saved" data-mod-thread="${t.id}" data-action="${t.locked?'unlock':'lock'}">${t.locked?'UNLOCK':'LOCK'}</button>
              <button class="wr-link saved" data-mod-thread="${t.id}" data-action="${t.verified?'unverify':'verify'}">${t.verified?'UNVERIFY':'VERIFY'}</button>`:''}
          </div>
        </div>
      </article>`;
    }).join('');
  }

  async function loadFeed(){
    feed.innerHTML='<div class="v18-loading">S.A.L.E.M. // LOADING WAR ROOM…</div>';
    await loadSeed();

    const tr=await client.from('doombot_warroom_threads')
      .select('id,author_id,channel,title,body,theory_snapshot,spoiler,pinned,locked,verified,status,created_at,updated_at')
      .order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(100);
    if(tr.error)throw tr.error;
    realThreads=tr.data||[];

    const realProfiles=await D.loadProfiles(client,realThreads.map(t=>t.author_id));
    realProfiles.forEach((v,k)=>profiles.set(k,v));

    const ids=realThreads.map(t=>t.id);
    threadVotes=[];replyCounts=new Map();
    if(ids.length){
      const [vr,rr]=await Promise.all([
        client.from('doombot_warroom_votes').select('thread_id,user_id').in('thread_id',ids),
        client.from('doombot_warroom_replies').select('id,thread_id').in('thread_id',ids)
      ]);
      if(!vr.error)threadVotes=vr.data||[];
      if(!rr.error)(rr.data||[]).forEach(r=>replyCounts.set(String(r.thread_id),(replyCounts.get(String(r.thread_id))||0)+1));
    }

    follows=new Set();blocked=new Set();
    if(permanent()){
      const [fr,br]=await Promise.all([
        client.from('doombot_warroom_follows').select('thread_id').eq('user_id',user.id),
        client.from('doombot_blocks').select('blocked_id').eq('blocker_id',user.id)
      ]);
      if(!fr.error)follows=new Set((fr.data||[]).map(x=>String(x.thread_id)));
      if(!br.error)blocked=new Set((br.data||[]).map(x=>x.blocked_id));
    }

    // Seed posts gradually disappear as the real community fills the room.
    // 0–7 real threads: all seeds
    // 8–14 real threads: 12 seeds
    // 15–23 real threads: 6 seeds
    // 24+ real threads: fully real feed
    let visibleSeeds=seedThreads;
    if(realThreads.length>=24)visibleSeeds=[];
    else if(realThreads.length>=15)visibleSeeds=seedThreads.slice(0,6);
    else if(realThreads.length>=8)visibleSeeds=seedThreads.slice(0,12);
    threads=[...realThreads,...visibleSeeds];
    renderFeed();
  }

  function seedDetail(id){
    const t=seedThreads.find(x=>String(x.id)===String(id));if(!t)return;
    const p=pFor(t.author_id);
    const replies=seedReplies.filter(r=>String(r.thread_id)===String(id));
    selectedThread=null;
    $('#warDetailContent').innerHTML=`
      <div class="war-detail-head">
        <div class="wr-card-head" style="padding:0 0 9px">
          <div class="wr-avatar">${D.esc(p.seed_avatar||'?')}</div>
          <div class="wr-author">
            <div class="wr-author-line"><span>@${D.esc(p.username)}</span><span class="wr-seed-tag">ARCHIVE SEED</span></div>
            <div class="wr-author-sub"><span>${D.channelLabel(t.channel)}</span><span>FOUNDING ARCHIVE</span></div>
          </div>
        </div>
        <h2>${D.esc(t.title)}</h2>${bodyHtml(t)}
      </div>

      <div class="war-replies">
        ${replies.length?replies.map(r=>{
          const rp=pFor(r.author_id);
          return `<div class="war-reply">
            <div class="v18-between">
              <div class="war-meta">
                <span>@${D.esc(rp.username)}</span>
                <span class="wr-seed-tag">ARCHIVE SEED</span>
                <span>FOUNDING ARCHIVE</span>
              </div>
              <span class="wr-link seed-static">▲ ${Number(r.votes||0)}</span>
            </div>
            ${r.spoiler?spoilerBlock(r.body,r.id,'reply'):`<div class="war-body">${D.esc(r.body)}</div>`}
          </div>`;
        }).join(''):'<div class="war-empty">NO ARCHIVE REPLIES</div>'}
      </div>

      <div class="war-account-gate">
        <b>FICTIONAL FOUNDING ARCHIVE</b>
        <span>These starter accounts, posts and replies are intentionally labeled ARCHIVE SEED. They keep the room populated while real discussions grow and automatically phase out as real threads are added.</span>
      </div>
    `;
    detail.classList.add('open');
    detail.scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function openThread(id,scroll=true){
    const t=realThreads.find(x=>String(x.id)===String(id));if(!t)return;
    selectedThread=t;
    const rr=await client.from('doombot_warroom_replies')
      .select('id,thread_id,author_id,body,spoiler,status,created_at,updated_at')
      .eq('thread_id',Number(id)).order('created_at',{ascending:true});
    if(rr.error){D.toast(rr.error.message);return}
    const replies=(rr.data||[]).filter(r=>!blocked.has(r.author_id));
    const more=await D.loadProfiles(client,replies.map(r=>r.author_id));more.forEach((v,k)=>profiles.set(k,v));
    detailReplyVotes=[];
    if(replies.length){
      const rv=await client.from('doombot_warroom_reply_votes').select('reply_id,user_id').in('reply_id',replies.map(r=>r.id));
      if(!rv.error)detailReplyVotes=rv.data||[];
    }
    const p=pFor(t.author_id);
    $('#warDetailContent').innerHTML=`
      <div class="war-detail-head">
        <div class="wr-card-head" style="padding:0 0 9px">
          <div class="wr-avatar">${D.avatar(p)}</div>
          <div class="wr-author"><div class="wr-author-line">${userLink(p)} ${roleBadge(p)}</div><div class="wr-author-sub"><span>${D.channelLabel(t.channel)}</span><span>${D.relative(t.created_at)}</span></div></div>
        </div>
        <h2>${D.esc(t.title)}</h2>${bodyHtml(t)}${theoryHtml(t.theory_snapshot)}
      </div>
      <div class="war-replies">
        ${replies.length?replies.map(r=>{
          const rp=pFor(r.author_id),own=user?.id===r.author_id,hide=(profile?.hide_spoilers??true)&&r.spoiler;
          const voteCount=(detailReplyVotes||[]).filter(v=>String(v.reply_id)===String(r.id)).length;
          const hasVote=(detailReplyVotes||[]).some(v=>String(v.reply_id)===String(r.id)&&v.user_id===user?.id);
          return `<div class="war-reply">
            <div class="v18-between">
              <div class="war-meta">${userLink(rp)} ${roleBadge(rp)} <span>${D.relative(r.created_at)}</span>${r.spoiler?'<span class="war-badge">SPOILER</span>':''}</div>
              <div class="wr-actions-right">
                ${permanent()?`<button class="wr-link ${hasVote?'active':''}" data-vote-reply="${r.id}">▲ ${voteCount}</button>`:''}
                ${own?`<button class="wr-link" data-edit-reply="${r.id}">EDIT</button><button class="wr-link danger" data-delete-reply="${r.id}">DELETE</button>`:''}
                ${permanent()&&!own?`<button class="wr-link" data-report-reply="${r.id}">REPORT</button><button class="wr-link" data-mute-user="${D.attr(r.author_id)}">MUTE</button>`:''}
                ${isMod?`<button class="wr-link saved" data-mod-reply="${r.id}" data-action="hide">HIDE</button>`:''}
              </div>
            </div>
            ${hide?spoilerBlock(r.body,r.id,'reply'):`<div class="war-body">${D.esc(r.body)}</div>`}
          </div>`;
        }).join(''):'<div class="war-empty">NO REPLIES YET // START THE DISCUSSION</div>'}
      </div>
      ${t.locked?'<div class="war-account-gate"><b>THREAD LOCKED</b><span>Moderators have closed replies.</span></div>':
        permanent()?`<form id="replyForm" class="v18-card" style="margin-top:10px">
          <label class="v18-label">REPLY<textarea id="replyBody" class="v18-textarea" maxlength="3500" required placeholder="Add to the discussion…"></textarea></label>
          <label class="v18-check"><input id="replySpoiler" type="checkbox"> This reply contains spoilers</label>
          <button class="wr-send" type="submit">POST REPLY →</button>
        </form>`:
        '<div class="war-account-gate"><b>SIGN IN TO REPLY</b><span>Guest browsing stays free.</span><a class="v18-btn gold" href="./account.html" style="display:inline-block;margin-top:8px">OPEN ACCOUNT →</a></div>'}
    `;
    detail.classList.add('open');
    if(scroll)detail.scrollIntoView({behavior:'smooth',block:'start'});
    $('#replyForm')?.addEventListener('submit',postReply);
  }

  async function toggleVote(id){
    if(!requireMember())return;
    const has=threadVotes.some(v=>String(v.thread_id)===String(id)&&v.user_id===user.id);
    const res=has
      ?await client.from('doombot_warroom_votes').delete().eq('thread_id',id).eq('user_id',user.id)
      :await client.from('doombot_warroom_votes').insert({thread_id:Number(id),user_id:user.id});
    if(res.error)return D.toast(res.error.message);
    await loadFeed();
  }
  async function toggleFollow(id){
    if(!requireMember())return;
    const has=follows.has(String(id));
    const res=has
      ?await client.from('doombot_warroom_follows').delete().eq('thread_id',id).eq('user_id',user.id)
      :await client.from('doombot_warroom_follows').insert({thread_id:Number(id),user_id:user.id});
    if(res.error)return D.toast(res.error.message);
    await loadFeed();
  }
  async function postReply(e){
    e.preventDefault();if(!selectedThread||!requireMember())return;
    const body=$('#replyBody').value.trim();if(!body)return;
    const r=await client.from('doombot_warroom_replies').insert({thread_id:selectedThread.id,author_id:user.id,body,spoiler:$('#replySpoiler').checked});
    if(r.error)return D.toast(r.error.message);
    D.toast('Reply posted.');await loadFeed();await openThread(selectedThread.id,false);
  }
  async function createThread(e){
    e.preventDefault();if(!requireMember())return;
    const title=$('#threadTitle').value.trim(),body=$('#threadBody').value.trim();if(!title||!body)return;
    let snapshot=null;try{snapshot=JSON.parse(localStorage.getItem('doombot-warroom-theory-draft-v1')||'null')}catch(e){}
    const r=await client.from('doombot_warroom_threads').insert({author_id:user.id,channel:$('#threadChannel').value,title,body,spoiler:$('#threadSpoiler').checked,theory_snapshot:snapshot});
    if(r.error)return D.toast(r.error.message);
    localStorage.removeItem('doombot-warroom-theory-draft-v1');$('#threadForm').reset();composer.classList.remove('open');D.toast('Thread posted.');await loadFeed();
  }
  async function editThread(id){
    const t=realThreads.find(x=>String(x.id)===String(id));if(!t)return;
    const title=prompt('Edit thread title:',t.title);if(title===null)return;
    const body=prompt('Edit thread body:',t.body);if(body===null)return;
    const r=await client.from('doombot_warroom_threads').update({title:title.trim(),body:body.trim()}).eq('id',Number(id));
    if(r.error)return D.toast(r.error.message);await loadFeed();
  }
  async function editReply(id){
    const r=await client.from('doombot_warroom_replies').select('body').eq('id',Number(id)).single();if(r.error)return D.toast(r.error.message);
    const body=prompt('Edit reply:',r.data.body);if(body===null)return;
    const up=await client.from('doombot_warroom_replies').update({body:body.trim()}).eq('id',Number(id));if(up.error)return D.toast(up.error.message);
    await openThread(selectedThread.id,false);
  }
  async function deleteThread(id){
    if(!confirm('Delete this War Room thread?'))return;
    const r=await client.from('doombot_warroom_threads').delete().eq('id',Number(id));if(r.error)return D.toast(r.error.message);
    detail.classList.remove('open');selectedThread=null;await loadFeed();
  }
  async function deleteReply(id){
    if(!confirm('Delete this reply?'))return;
    const r=await client.from('doombot_warroom_replies').delete().eq('id',Number(id));if(r.error)return D.toast(r.error.message);
    await loadFeed();await openThread(selectedThread.id,false);
  }
  async function voteReply(id){
    if(!requireMember())return;
    const has=detailReplyVotes.some(v=>String(v.reply_id)===String(id)&&v.user_id===user.id);
    const r=has
      ?await client.from('doombot_warroom_reply_votes').delete().eq('reply_id',Number(id)).eq('user_id',user.id)
      :await client.from('doombot_warroom_reply_votes').insert({reply_id:Number(id),user_id:user.id});
    if(r.error)return D.toast(r.error.message);await openThread(selectedThread.id,false);
  }
  async function report(type,id){
    if(!requireMember())return;
    const reason=prompt('Report reason:','');if(!reason)return;
    const details=prompt('Optional details:','')||'';
    const payload={reporter_id:user.id,reason:reason.slice(0,80),details:details.slice(0,1000)};
    payload[type==='thread'?'thread_id':'reply_id']=Number(id);
    const r=await client.from('doombot_warroom_reports').insert(payload);D.toast(r.error?r.error.message:'Report sent.');
  }
  async function mute(id){
    if(!requireMember()||id===user.id)return;
    const r=await client.from('doombot_blocks').insert({blocker_id:user.id,blocked_id:id});
    if(r.error&&!String(r.error.message).includes('duplicate'))return D.toast(r.error.message);
    blocked.add(id);D.toast('User muted.');renderFeed();
  }
  async function moderateThread(id,action){
    const {error}=await client.rpc('doombot_moderate_thread',{p_thread_id:Number(id),p_action:action});
    if(error)return D.toast(error.message);D.toast('Moderation applied.');await loadFeed();
  }
  async function moderateReply(id,action){
    const {error}=await client.rpc('doombot_moderate_reply',{p_reply_id:Number(id),p_action:action});
    if(error)return D.toast(error.message);D.toast('Reply moderated.');if(selectedThread)await openThread(selectedThread.id,false);
  }
  async function loadModQueue(){
    if(!isMod)return;
    const box=$('#warModReports');box.innerHTML='<div class="v18-loading">LOADING REPORTS…</div>';
    const {data,error}=await client.from('doombot_warroom_reports').select('*').eq('status','open').order('created_at',{ascending:false}).limit(100);
    if(error){box.innerHTML='<div class="war-empty">'+D.esc(error.message)+'</div>';return}
    const reps=data||[];
    box.innerHTML=reps.length?reps.map(r=>`<div class="war-report"><b>${D.esc(r.reason)}</b><div class="v18-small">${D.esc(r.details||'No details')}</div>
      <div class="v18-actions">${r.thread_id?`<button class="v18-btn red" data-mod-thread="${r.thread_id}" data-action="hide">HIDE THREAD</button>`:''}${r.reply_id?`<button class="v18-btn red" data-mod-reply="${r.reply_id}" data-action="hide">HIDE REPLY</button>`:''}<button class="v18-btn primary" data-resolve-report="${r.id}">RESOLVE</button></div></div>`).join(''):'<div class="war-empty">MOD QUEUE CLEAR</div>';
  }

  document.addEventListener('click',async e=>{
    const reveal=e.target.closest('[data-reveal-spoiler]');if(reveal){const key=reveal.dataset.revealSpoiler;reveal.hidden=true;$(`[data-spoiler-body="${CSS.escape(key)}"]`)?.removeAttribute('hidden');return}
    const seed=e.target.closest('[data-open-seed]');if(seed){e.preventDefault();return seedDetail(seed.dataset.openSeed)}
    const open=e.target.closest('[data-open-thread]');if(open){e.preventDefault();return openThread(open.dataset.openThread)}
    const vote=e.target.closest('[data-vote-thread]');if(vote)return toggleVote(vote.dataset.voteThread)
    const follow=e.target.closest('[data-follow-thread]');if(follow)return toggleFollow(follow.dataset.followThread)
    const edit=e.target.closest('[data-edit-thread]');if(edit)return editThread(edit.dataset.editThread)
    const del=e.target.closest('[data-delete-thread]');if(del)return deleteThread(del.dataset.deleteThread)
    const er=e.target.closest('[data-edit-reply]');if(er)return editReply(er.dataset.editReply)
    const dr=e.target.closest('[data-delete-reply]');if(dr)return deleteReply(dr.dataset.deleteReply)
    const vr=e.target.closest('[data-vote-reply]');if(vr)return voteReply(vr.dataset.voteReply)
    const rt=e.target.closest('[data-report-thread]');if(rt)return report('thread',rt.dataset.reportThread)
    const rr=e.target.closest('[data-report-reply]');if(rr)return report('reply',rr.dataset.reportReply)
    const mu=e.target.closest('[data-mute-user]');if(mu)return mute(mu.dataset.muteUser)
    const mt=e.target.closest('[data-mod-thread]');if(mt)return moderateThread(mt.dataset.modThread,mt.dataset.action)
    const mr=e.target.closest('[data-mod-reply]');if(mr)return moderateReply(mr.dataset.modReply,mr.dataset.action)
    const rs=e.target.closest('[data-resolve-report]');if(rs){
      const {error}=await client.rpc('doombot_resolve_report',{p_report_id:Number(rs.dataset.resolveReport)});
      if(error)return D.toast(error.message);D.toast('Report resolved.');return loadModQueue();
    }
  });

  $('#newThreadButton')?.addEventListener('click',()=>{
    if(!requireMember())return;composer.classList.toggle('open');if(composer.classList.contains('open'))composer.scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('#cancelThreadButton')?.addEventListener('click',()=>composer.classList.remove('open'));
  $('#threadForm')?.addEventListener('submit',createThread);
  $('#refreshWarRoom')?.addEventListener('click',()=>loadFeed().catch(err=>D.toast(err.message||String(err))));
  $('#threadSearch')?.addEventListener('input',e=>{searchTerm=e.target.value.trim();renderFeed()});
  $$('.v18-channel').forEach(btn=>btn.addEventListener('click',()=>{
    $$('.v18-channel').forEach(x=>x.classList.remove('active'));btn.classList.add('active');activeChannel=btn.dataset.channel;renderFeed();
  }));
  $('#toggleModQueue')?.addEventListener('click',async()=>{
    $('#warModPanel').classList.toggle('open');if($('#warModPanel').classList.contains('open'))await loadModQueue();
  });

  try{
    client=await D.waitForClient();user=await D.getUser(client);
    if(permanent()){
      profile=await D.ensureProfile(client,user);isMod=['mod','admin'].includes(profile.role);
      await client.from('doombot_profiles').update({last_seen_at:new Date().toISOString()}).eq('user_id',user.id);
      $('#warIdentity').innerHTML=`<a href="./profile.html?u=${encodeURIComponent(profile.username)}">@${D.esc(profile.username)}</a> · ${D.roleLabel(profile.role)}`;
      $('#warGuestGate').hidden=true;if(isMod)$('#toggleModQueue').hidden=false;
    }else{
      $('#warIdentity').textContent='GUEST OBSERVER';
      $('#warGuestGate').hidden=false;
    }
    await loadFeed();

    let draft=null;try{draft=JSON.parse(localStorage.getItem('doombot-warroom-theory-draft-v1')||'null')}catch(e){}
    if(draft){
      $('#theoryDraftPreview').hidden=false;
      $('#theoryDraftPreview').innerHTML=`<b>THEORY READY TO SHARE // ${D.esc(draft.title||'PERSONAL THEORY')}</b><br>${D.esc(draft.summary||'')}`;
      $('#threadTitle').value=draft.title||'';$('#threadBody').value=draft.summary||'';$('#threadChannel').value='theory';
      if(new URLSearchParams(location.search).get('new')==='1'&&permanent()){composer.classList.add('open');composer.scrollIntoView({behavior:'smooth',block:'start'})}
    }
    const requested=new URLSearchParams(location.search).get('thread');if(requested)setTimeout(()=>openThread(requested),200);
    setInterval(()=>loadFeed().catch(()=>{}),45000);
  }catch(err){
    await loadSeed();
    threads=[...seedThreads];
    renderFeed();
    feed.insertAdjacentHTML('afterbegin','<div class="wr-guest" style="margin-bottom:7px"><div><b>LIVE COMMUNITY OFFLINE</b><span>Showing founding archive seed posts until Supabase reconnects.</span></div></div>');
  }
})();