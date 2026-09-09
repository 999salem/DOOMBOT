(async function(){
  const D=window.DOOMBOT_V18;
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  let client,user,profile=null,isMod=false,isAdmin=false;
  let threads=[],profiles=new Map(),threadVotes=[],replyCounts=new Map(),follows=new Set(),blocked=new Set();
  let activeChannel='all',searchTerm='',selectedThread=null,detailReplyVotes=[];

  const feed=$('#warFeed'),composer=$('#warComposer'),detail=$('#warDetail');

  function permanent(){return D.isPermanent(user)}
  function requireMember(){
    if(permanent())return true;
    D.toast('Sign in to post, vote or save War Room threads.');
    $('#warGuestGate')?.scrollIntoView({behavior:'smooth',block:'center'});
    return false;
  }
  function pFor(id){return profiles.get(id)||{user_id:id,username:'member',display_name:'DOOMBOT MEMBER',role:'member'}}
  function userLink(p){return `<a href="./profile.html?u=${encodeURIComponent(p.username||'')}" class="war-profile-link">@${D.esc(p.username||'member')}</a>`}
  function roleBadge(p){
    if(!p?.role||p.role==='member')return '';
    return `<span class="v18-role ${D.roleClass(p.role)}">${D.roleLabel(p.role)}</span>`;
  }
  function threadVoteCount(id){return threadVotes.filter(v=>String(v.thread_id)===String(id)).length}
  function hasThreadVote(id){return threadVotes.some(v=>String(v.thread_id)===String(id)&&v.user_id===user?.id)}
  function spoilerBlock(body,id,type='thread'){
    return `<div class="war-spoiler" data-reveal-spoiler="${type}:${id}">⚠ SPOILER HIDDEN // TAP TO REVEAL</div><div class="war-body" data-spoiler-body="${type}:${id}" hidden>${D.esc(body)}</div>`;
  }
  function bodyHtml(t){
    const hide=(profile?.hide_spoilers??true)&&t.spoiler;
    return hide?spoilerBlock(t.body,t.id):`<div class="war-body">${D.esc(t.body)}</div>`;
  }
  function theoryHtml(snapshot){
    if(!snapshot||typeof snapshot!=='object')return '';
    return `<div class="war-theory-snapshot"><b>THEORY FILE // ${D.esc(snapshot.title||'PERSONAL THEORY')}</b><br>
      ${D.esc(snapshot.summary||'')}${snapshot.confidence?`<br><b>CONFIDENCE:</b> ${Number(snapshot.confidence)}%`:''}
      ${snapshot.evidence?`<br><b>EVIDENCE:</b> ${D.esc(snapshot.evidence)}`:''}</div>`;
  }
  function threadActions(t,p){
    const own=user?.id===t.author_id;
    let html='';
    if(own&&!t.locked)html+=`<button class="v18-btn ghost" data-edit-thread="${t.id}">EDIT</button>`;
    if(own||isMod)html+=`<button class="v18-btn red" data-delete-thread="${t.id}">DELETE</button>`;
    if(permanent()&&!own){
      html+=`<button class="v18-btn ghost" data-report-thread="${t.id}">REPORT</button>`;
      html+=`<button class="v18-btn ghost" data-mute-user="${D.attr(t.author_id)}">MUTE</button>`;
    }
    if(isMod){
      html+=`<button class="v18-btn gold" data-mod-thread="${t.id}" data-action="${t.pinned?'unpin':'pin'}">${t.pinned?'UNPIN':'PIN'}</button>`;
      html+=`<button class="v18-btn gold" data-mod-thread="${t.id}" data-action="${t.locked?'unlock':'lock'}">${t.locked?'UNLOCK':'LOCK'}</button>`;
      html+=`<button class="v18-btn gold" data-mod-thread="${t.id}" data-action="${t.verified?'unverify':'verify'}">${t.verified?'UNVERIFY':'999SALEM VERIFIED'}</button>`;
    }
    return html;
  }

  function renderFeed(){
    const q=searchTerm.toLowerCase();
    const list=threads.filter(t=>{
      if(blocked.has(t.author_id))return false;
      if(activeChannel!=='all'&&t.channel!==activeChannel)return false;
      if(q&&!(`${t.title} ${t.body}`.toLowerCase().includes(q)))return false;
      return true;
    });
    if(!list.length){feed.innerHTML='<div class="war-empty">NO THREADS IN THIS CHANNEL YET // START THE FIRST ONE</div>';return}
    feed.innerHTML=list.map(t=>{
      const p=pFor(t.author_id),votes=threadVoteCount(t.id),ownVote=hasThreadVote(t.id),replies=replyCounts.get(String(t.id))||0;
      return `<article class="war-thread ${t.pinned?'pinned':''} ${t.verified?'verified':''}" data-thread-card="${t.id}">
        <div class="v18-between">
          <div class="war-meta">
            ${userLink(p)} ${roleBadge(p)}
            <span>${D.channelLabel(t.channel)}</span><span>${D.relative(t.created_at)}</span>
            ${D.isOnline(p)?'<span class="war-badge verify">ONLINE</span>':''}
          </div>
          <div class="war-meta">
            ${t.pinned?'<span class="war-badge pin">PINNED</span>':''}
            ${t.verified?'<span class="war-badge verify">999SALEM VERIFIED</span>':''}
            ${t.locked?'<span class="war-badge lock">LOCKED</span>':''}
            ${t.spoiler?'<span class="war-badge">SPOILER</span>':''}
          </div>
        </div>
        <h3>${D.esc(t.title)}</h3>
        ${bodyHtml(t)}
        ${theoryHtml(t.theory_snapshot)}
        <div class="war-footer">
          <div class="v18-actions">
            <button class="v18-btn ${ownVote?'primary':''}" data-vote-thread="${t.id}">▲ ${votes}</button>
            <button class="v18-btn" data-open-thread="${t.id}">DISCUSS // ${replies}</button>
            ${permanent()?`<button class="v18-btn ${follows.has(String(t.id))?'gold':''}" data-follow-thread="${t.id}">${follows.has(String(t.id))?'SAVED ✓':'SAVE'}</button>`:''}
          </div>
          <div class="v18-actions">${threadActions(t,p)}</div>
        </div>
      </article>`;
    }).join('');
  }

  async function loadFeed(){
    feed.innerHTML='<div class="v18-loading">S.A.L.E.M. // LOADING WAR ROOM…</div>';
    const tr=await client.from('doombot_warroom_threads')
      .select('id,author_id,channel,title,body,theory_snapshot,spoiler,pinned,locked,verified,status,created_at,updated_at')
      .order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(100);
    if(tr.error)throw tr.error;
    threads=tr.data||[];
    profiles=await D.loadProfiles(client,threads.map(t=>t.author_id));

    const ids=threads.map(t=>t.id);
    threadVotes=[];
    replyCounts=new Map();
    if(ids.length){
      const [vr,rr]=await Promise.all([
        client.from('doombot_warroom_votes').select('thread_id,user_id').in('thread_id',ids),
        client.from('doombot_warroom_replies').select('id,thread_id').in('thread_id',ids)
      ]);
      if(!vr.error)threadVotes=vr.data||[];
      if(!rr.error)(rr.data||[]).forEach(r=>replyCounts.set(String(r.thread_id),(replyCounts.get(String(r.thread_id))||0)+1));
    }

    follows=new Set();
    blocked=new Set();
    if(permanent()){
      const [fr,br]=await Promise.all([
        client.from('doombot_warroom_follows').select('thread_id').eq('user_id',user.id),
        client.from('doombot_blocks').select('blocked_id').eq('blocker_id',user.id)
      ]);
      if(!fr.error)follows=new Set((fr.data||[]).map(x=>String(x.thread_id)));
      if(!br.error)blocked=new Set((br.data||[]).map(x=>x.blocked_id));
    }
    renderFeed();
  }

  async function toggleThreadVote(id){
    if(!requireMember())return;
    const has=hasThreadVote(id);
    const res=has
      ?await client.from('doombot_warroom_votes').delete().eq('thread_id',id).eq('user_id',user.id)
      :await client.from('doombot_warroom_votes').insert({thread_id:Number(id),user_id:user.id});
    if(res.error){D.toast(res.error.message);return}
    await loadFeed();
    if(selectedThread&&String(selectedThread.id)===String(id))await openThread(id,false);
  }

  async function toggleFollow(id){
    if(!requireMember())return;
    const has=follows.has(String(id));
    const res=has
      ?await client.from('doombot_warroom_follows').delete().eq('thread_id',id).eq('user_id',user.id)
      :await client.from('doombot_warroom_follows').insert({thread_id:Number(id),user_id:user.id});
    if(res.error){D.toast(res.error.message);return}
    has?follows.delete(String(id)):follows.add(String(id));renderFeed();
  }

  function replyVoteCount(id){return detailReplyVotes.filter(v=>String(v.reply_id)===String(id)).length}
  function hasReplyVote(id){return detailReplyVotes.some(v=>String(v.reply_id)===String(id)&&v.user_id===user?.id)}

  async function openThread(id,scroll=true){
    const t=threads.find(x=>String(x.id)===String(id));
    if(!t)return;
    selectedThread=t;
    const rr=await client.from('doombot_warroom_replies')
      .select('id,thread_id,author_id,body,spoiler,status,created_at,updated_at')
      .eq('thread_id',Number(id)).order('created_at',{ascending:true});
    if(rr.error){D.toast(rr.error.message);return}
    const replies=(rr.data||[]).filter(r=>!blocked.has(r.author_id));
    const more=await D.loadProfiles(client,replies.map(r=>r.author_id));
    more.forEach((v,k)=>profiles.set(k,v));
    detailReplyVotes=[];
    if(replies.length){
      const rv=await client.from('doombot_warroom_reply_votes').select('reply_id,user_id').in('reply_id',replies.map(r=>r.id));
      if(!rv.error)detailReplyVotes=rv.data||[];
    }
    const p=pFor(t.author_id);
    $('#warDetailContent').innerHTML=`
      <div class="war-detail-head">
        <div class="war-meta">${userLink(p)} ${roleBadge(p)} <span>${D.channelLabel(t.channel)}</span><span>${D.relative(t.created_at)}</span></div>
        <h2>${D.esc(t.title)}</h2>${bodyHtml(t)}${theoryHtml(t.theory_snapshot)}
      </div>
      <div class="war-replies">
        ${replies.length?replies.map(r=>{
          const rp=pFor(r.author_id),own=user?.id===r.author_id,hide=(profile?.hide_spoilers??true)&&r.spoiler;
          return `<div class="war-reply">
            <div class="v18-between">
              <div class="war-meta">${userLink(rp)} ${roleBadge(rp)} <span>${D.relative(r.created_at)}</span>${r.spoiler?'<span class="war-badge">SPOILER</span>':''}</div>
              <div class="v18-actions">
                ${permanent()?`<button class="v18-btn ${hasReplyVote(r.id)?'primary':''}" data-vote-reply="${r.id}">▲ ${replyVoteCount(r.id)}</button>`:''}
                ${own?`<button class="v18-btn ghost" data-edit-reply="${r.id}">EDIT</button><button class="v18-btn red" data-delete-reply="${r.id}">DELETE</button>`:''}
                ${permanent()&&!own?`<button class="v18-btn ghost" data-report-reply="${r.id}">REPORT</button><button class="v18-btn ghost" data-mute-user="${D.attr(r.author_id)}">MUTE</button>`:''}
                ${isMod?`<button class="v18-btn gold" data-mod-reply="${r.id}" data-action="hide">HIDE</button>`:''}
              </div>
            </div>
            ${hide?spoilerBlock(r.body,r.id,'reply'):`<div class="war-body">${D.esc(r.body)}</div>`}
          </div>`;
        }).join(''):'<div class="war-empty">NO REPLIES YET // START THE DISCUSSION</div>'}
      </div>
      ${t.locked?'<div class="war-account-gate"><b>THREAD LOCKED</b><span>Moderators have closed replies on this discussion.</span></div>':
        permanent()?`<form id="replyForm" class="v18-card" style="margin-top:10px">
          <label class="v18-label">REPLY<textarea id="replyBody" class="v18-textarea" maxlength="3500" required placeholder="Add to the discussion…"></textarea></label>
          <label class="v18-check"><input id="replySpoiler" type="checkbox"> This reply contains spoilers</label>
          <button class="v18-btn primary" type="submit">POST REPLY</button>
        </form>`:
        '<div class="war-account-gate"><b>SIGN IN TO REPLY</b><span>Guest browsing stays free. A permanent account is only required to participate.</span><a class="v18-btn gold" href="./account.html" style="display:inline-block;margin-top:8px">OPEN ACCOUNT →</a></div>'}
    `;
    detail.classList.add('open');
    if(scroll)detail.scrollIntoView({behavior:'smooth',block:'start'});
    $('#replyForm')?.addEventListener('submit',postReply);
  }

  async function postReply(e){
    e.preventDefault();
    if(!requireMember()||!selectedThread)return;
    const body=$('#replyBody').value.trim();
    if(!body)return;
    const res=await client.from('doombot_warroom_replies').insert({
      thread_id:selectedThread.id,author_id:user.id,body,spoiler:$('#replySpoiler').checked
    });
    if(res.error){D.toast(res.error.message);return}
    D.toast('Reply posted.');await loadFeed();await openThread(selectedThread.id,false);
  }

  async function createThread(e){
    e.preventDefault();if(!requireMember())return;
    const title=$('#threadTitle').value.trim(),body=$('#threadBody').value.trim();
    if(!title||!body)return;
    let snapshot=null;
    try{snapshot=JSON.parse(localStorage.getItem('doombot-warroom-theory-draft-v1')||'null')}catch(e){}
    const res=await client.from('doombot_warroom_threads').insert({
      author_id:user.id,channel:$('#threadChannel').value,title,body,
      spoiler:$('#threadSpoiler').checked,theory_snapshot:snapshot
    });
    if(res.error){D.toast(res.error.message);return}
    localStorage.removeItem('doombot-warroom-theory-draft-v1');
    $('#threadForm').reset();composer.classList.remove('open');
    D.toast('Thread posted to the War Room.');await loadFeed();
  }

  async function editThread(id){
    const t=threads.find(x=>String(x.id)===String(id));if(!t)return;
    const title=prompt('Edit thread title:',t.title);if(title===null)return;
    const body=prompt('Edit thread body:',t.body);if(body===null)return;
    const res=await client.from('doombot_warroom_threads').update({title:title.trim(),body:body.trim()}).eq('id',Number(id));
    if(res.error){D.toast(res.error.message);return}await loadFeed();if(selectedThread?.id==id)await openThread(id,false);
  }
  async function editReply(id){
    const res=await client.from('doombot_warroom_replies').select('body').eq('id',Number(id)).single();
    if(res.error)return D.toast(res.error.message);
    const body=prompt('Edit reply:',res.data.body);if(body===null)return;
    const up=await client.from('doombot_warroom_replies').update({body:body.trim()}).eq('id',Number(id));
    if(up.error)return D.toast(up.error.message);await openThread(selectedThread.id,false);
  }
  async function deleteThread(id){
    if(!confirm('Delete this War Room thread?'))return;
    const res=await client.from('doombot_warroom_threads').delete().eq('id',Number(id));
    if(res.error)return D.toast(res.error.message);
    detail.classList.remove('open');selectedThread=null;await loadFeed();
  }
  async function deleteReply(id){
    if(!confirm('Delete this reply?'))return;
    const res=await client.from('doombot_warroom_replies').delete().eq('id',Number(id));
    if(res.error)return D.toast(res.error.message);await loadFeed();await openThread(selectedThread.id,false);
  }
  async function voteReply(id){
    if(!requireMember())return;
    const has=hasReplyVote(id);
    const res=has
      ?await client.from('doombot_warroom_reply_votes').delete().eq('reply_id',Number(id)).eq('user_id',user.id)
      :await client.from('doombot_warroom_reply_votes').insert({reply_id:Number(id),user_id:user.id});
    if(res.error)return D.toast(res.error.message);await openThread(selectedThread.id,false);
  }
  async function reportTarget(type,id){
    if(!requireMember())return;
    const reason=prompt('Report reason (spam, harassment, fake leak, spoiler, etc.):','');
    if(!reason)return;
    const details=prompt('Optional details:','')||'';
    const payload={reporter_id:user.id,reason:reason.slice(0,80),details:details.slice(0,1000)};
    payload[type==='thread'?'thread_id':'reply_id']=Number(id);
    const res=await client.from('doombot_warroom_reports').insert(payload);
    D.toast(res.error?res.error.message:'Report sent to moderators.');
  }
  async function muteUser(id){
    if(!requireMember()||id===user.id)return;
    const res=await client.from('doombot_blocks').insert({blocker_id:user.id,blocked_id:id});
    if(res.error&&!String(res.error.message).includes('duplicate'))return D.toast(res.error.message);
    blocked.add(id);D.toast('User muted.');renderFeed();if(selectedThread&&blocked.has(selectedThread.author_id))detail.classList.remove('open');
  }
  async function moderateThread(id,action){
    const {error}=await client.rpc('doombot_moderate_thread',{p_thread_id:Number(id),p_action:action});
    if(error)return D.toast(error.message);D.toast('Moderation action applied.');await loadFeed();
  }
  async function moderateReply(id,action){
    const {error}=await client.rpc('doombot_moderate_reply',{p_reply_id:Number(id),p_action:action});
    if(error)return D.toast(error.message);
    D.toast('Reply moderated.');
    if(selectedThread) await openThread(selectedThread.id,false);
    if(isMod) await loadModQueue();
  }

  async function loadModQueue(){
    if(!isMod)return;
    const box=$('#warModReports');box.innerHTML='<div class="v18-loading">LOADING REPORTS…</div>';
    const {data,error}=await client.from('doombot_warroom_reports')
      .select('id,reporter_id,thread_id,reply_id,reason,details,status,created_at')
      .eq('status','open').order('created_at',{ascending:false}).limit(100);
    if(error){box.innerHTML='<div class="war-empty">'+D.esc(error.message)+'</div>';return}
    const reps=data||[],pm=await D.loadProfiles(client,reps.map(r=>r.reporter_id));
    box.innerHTML=reps.length?reps.map(r=>`<div class="war-report">
      <div class="war-meta">${pm.get(r.reporter_id)?userLink(pm.get(r.reporter_id)):'MEMBER'} <span>${D.relative(r.created_at)}</span></div>
      <b>${D.esc(r.reason)}</b><div class="v18-small">${D.esc(r.details||'No extra details')}</div>
      <div class="v18-actions">
        ${r.thread_id?`<button class="v18-btn" data-open-thread="${r.thread_id}">OPEN THREAD</button><button class="v18-btn red" data-mod-thread="${r.thread_id}" data-action="hide">HIDE THREAD</button>`:''}
        ${r.reply_id?`<button class="v18-btn red" data-mod-reply="${r.reply_id}" data-action="hide">HIDE REPLY</button>`:''}
        <button class="v18-btn primary" data-resolve-report="${r.id}">RESOLVE</button>
      </div>
    </div>`).join(''):'<div class="war-empty">MOD QUEUE CLEAR // NO OPEN REPORTS</div>';
  }

  document.addEventListener('click',async e=>{
    const reveal=e.target.closest('[data-reveal-spoiler]');
    if(reveal){const key=reveal.dataset.revealSpoiler;reveal.hidden=true;$(`[data-spoiler-body="${CSS.escape(key)}"]`)?.removeAttribute('hidden');return}
    const open=e.target.closest('[data-open-thread]');if(open)return openThread(open.dataset.openThread);
    const vote=e.target.closest('[data-vote-thread]');if(vote)return toggleThreadVote(vote.dataset.voteThread);
    const follow=e.target.closest('[data-follow-thread]');if(follow)return toggleFollow(follow.dataset.followThread);
    const edit=e.target.closest('[data-edit-thread]');if(edit)return editThread(edit.dataset.editThread);
    const del=e.target.closest('[data-delete-thread]');if(del)return deleteThread(del.dataset.deleteThread);
    const er=e.target.closest('[data-edit-reply]');if(er)return editReply(er.dataset.editReply);
    const dr=e.target.closest('[data-delete-reply]');if(dr)return deleteReply(dr.dataset.deleteReply);
    const vr=e.target.closest('[data-vote-reply]');if(vr)return voteReply(vr.dataset.voteReply);
    const rt=e.target.closest('[data-report-thread]');if(rt)return reportTarget('thread',rt.dataset.reportThread);
    const rr=e.target.closest('[data-report-reply]');if(rr)return reportTarget('reply',rr.dataset.reportReply);
    const mu=e.target.closest('[data-mute-user]');if(mu)return muteUser(mu.dataset.muteUser);
    const mt=e.target.closest('[data-mod-thread]');if(mt)return moderateThread(mt.dataset.modThread,mt.dataset.action);
    const mr=e.target.closest('[data-mod-reply]');if(mr)return moderateReply(mr.dataset.modReply,mr.dataset.action);
    const resolve=e.target.closest('[data-resolve-report]');
    if(resolve){
      const {error}=await client.rpc('doombot_resolve_report',{p_report_id:Number(resolve.dataset.resolveReport)});
      if(error)return D.toast(error.message);D.toast('Report resolved.');return loadModQueue();
    }
  });

  $('#refreshWarRoom')?.addEventListener('click',()=>loadFeed());
  $('#newThreadButton')?.addEventListener('click',()=>{
    if(!requireMember())return;
    composer.classList.toggle('open');
    if(composer.classList.contains('open'))composer.scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('#cancelThreadButton')?.addEventListener('click',()=>composer.classList.remove('open'));
  $('#threadForm')?.addEventListener('submit',createThread);
  $('#threadSearch')?.addEventListener('input',e=>{searchTerm=e.target.value.trim();renderFeed()});
  $$('.v18-channel').forEach(btn=>btn.addEventListener('click',()=>{
    $$('.v18-channel').forEach(x=>x.classList.remove('active'));btn.classList.add('active');activeChannel=btn.dataset.channel;renderFeed();
  }));
  $('#toggleModQueue')?.addEventListener('click',async()=>{
    $('#warModPanel').classList.toggle('open');
    if($('#warModPanel').classList.contains('open'))await loadModQueue();
  });

  try{
    client=await D.waitForClient();user=await D.getUser(client);
    if(permanent()){
      profile=await D.ensureProfile(client,user);
      isMod=['mod','admin'].includes(profile.role);isAdmin=profile.role==='admin';
      await client.from('doombot_profiles').update({last_seen_at:new Date().toISOString()}).eq('user_id',user.id);
      $('#warIdentity').innerHTML=`<a href="./profile.html?u=${encodeURIComponent(profile.username)}">@${D.esc(profile.username)}</a> <span class="v18-role ${D.roleClass(profile.role)}">${D.roleLabel(profile.role)}</span>`;
      $('#warGuestGate').hidden=true;
      if(isMod)$('#toggleModQueue').hidden=false;
    }else{
      $('#warIdentity').innerHTML='<span class="v18-status guest">GUEST // READ ONLY</span>';
      $('#warGuestGate').hidden=false;
    }
    await loadFeed();

    let draft=null;try{draft=JSON.parse(localStorage.getItem('doombot-warroom-theory-draft-v1')||'null')}catch(e){}
    if(draft){
      $('#theoryDraftPreview').hidden=false;
      $('#theoryDraftPreview').innerHTML=`<b>THEORY READY TO SHARE // ${D.esc(draft.title||'PERSONAL THEORY')}</b><br>${D.esc(draft.summary||'')}`;
      $('#threadTitle').value=draft.title||'';
      $('#threadBody').value=draft.summary||'';
      $('#threadChannel').value='theory';
      if(new URLSearchParams(location.search).get('new')==='1'&&permanent()){
        composer.classList.add('open');composer.scrollIntoView({behavior:'smooth',block:'start'});
      }
    }
    const requested=new URLSearchParams(location.search).get('thread');
    if(requested)setTimeout(()=>openThread(requested),250);
    setInterval(()=>loadFeed().catch(()=>{}),45000);
    if(permanent())setInterval(()=>client.from('doombot_profiles').update({last_seen_at:new Date().toISOString()}).eq('user_id',user.id),120000);
  }catch(err){
    feed.innerHTML='<div class="war-empty">WAR ROOM CONNECTION ERROR // '+D.esc(err.message||String(err))+'</div>';
  }
})();
