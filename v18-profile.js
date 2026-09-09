(async function(){
  const D=window.DOOMBOT_V18,$=s=>document.querySelector(s);
  let client,user,viewer=null,target=null,blocked=false,isMod=false,isAdmin=false;

  function render(){
    $('#publicAvatar').innerHTML=D.avatar(target);
    $('#publicHandle').textContent='@'+target.username;
    $('#publicName').textContent=target.display_name||'DOOMBOT MEMBER';
    $('#publicRole').textContent=D.roleLabel(target.role);
    $('#publicRole').className='v18-role '+D.roleClass(target.role);
    $('#publicBio').textContent=target.bio||'No bio added.';
    $('#publicFavorite').textContent=target.favorite_character||'Not set';
    $('#publicJoined').textContent=new Date(target.joined_at).toLocaleDateString(undefined,{month:'short',year:'numeric'});
    const online=D.isOnline(target);
    $('#publicOnline').textContent=online?'ONLINE NOW':'OFFLINE';
    $('#publicOnline').className='v18-status '+(online?'online':'');
    const own=user?.id===target.user_id;
    $('#editOwnProfile').hidden=!own;
    $('#memberTools').hidden=own||!D.isPermanent(user);
    if(!own&&D.isPermanent(user))$('#muteProfile').textContent=blocked?'UNMUTE USER':'MUTE USER';
    $('#adminTools').hidden=!(isAdmin&&!own);
    $('#modTools').hidden=!(isMod&&!own);
  }

  async function loadStats(){
    const [tr,rr]=await Promise.all([
      client.from('doombot_warroom_threads').select('id,title,channel,created_at').eq('author_id',target.user_id).order('created_at',{ascending:false}).limit(50),
      client.from('doombot_warroom_replies').select('id').eq('author_id',target.user_id)
    ]);
    const threads=tr.data||[],replies=rr.data||[];
    let upvotes=0;
    if(threads.length){
      const vr=await client.from('doombot_warroom_votes').select('thread_id').in('thread_id',threads.map(x=>x.id));
      if(!vr.error)upvotes+=(vr.data||[]).length;
    }
    if(replies.length){
      const vr=await client.from('doombot_warroom_reply_votes').select('reply_id').in('reply_id',replies.map(x=>x.id));
      if(!vr.error)upvotes+=(vr.data||[]).length;
    }
    $('#statThreads').textContent=threads.length;
    $('#statReplies').textContent=replies.length;
    $('#statUpvotes').textContent=upvotes;
    $('#recentThreads').innerHTML=threads.length?threads.slice(0,10).map(t=>`<a class="war-thread" href="./warroom.html?thread=${t.id}">
      <div class="war-meta"><span>${D.channelLabel(t.channel)}</span><span>${D.relative(t.created_at)}</span></div>
      <h3>${D.esc(t.title)}</h3>
    </a>`).join(''):'<div class="war-empty">NO WAR ROOM THREADS YET</div>';
  }

  $('#muteProfile')?.addEventListener('click',async()=>{
    if(!D.isPermanent(user)||user.id===target.user_id)return;
    const res=blocked
      ?await client.from('doombot_blocks').delete().eq('blocker_id',user.id).eq('blocked_id',target.user_id)
      :await client.from('doombot_blocks').insert({blocker_id:user.id,blocked_id:target.user_id});
    if(res.error&&!String(res.error.message).includes('duplicate'))return D.toast(res.error.message);
    blocked=!blocked;render();D.toast(blocked?'User muted.':'User unmuted.');
  });

  $('#setRoleMember')?.addEventListener('click',()=>setRole('member'));
  $('#setRoleSupporter')?.addEventListener('click',()=>setRole('supporter'));
  $('#setRoleMod')?.addEventListener('click',()=>setRole('mod'));
  async function setRole(role){
    if(!isAdmin)return;
    const {error}=await client.rpc('doombot_set_member_role',{p_user_id:target.user_id,p_role:role});
    if(error)return D.toast(error.message);
    target.role=role;render();D.toast('Member role updated.');
  }

  $('#banProfile')?.addEventListener('click',async()=>{
    if(!isMod)return;
    const minutes=Number(prompt('Ban length in minutes. Use 60 for 1 hour, 1440 for 1 day, 5256000 for permanent:','1440'));
    if(!minutes)return;
    const reason=prompt('Ban reason:','War Room rule violation')||'';
    const {error}=await client.rpc('doombot_ban_member',{p_user_id:target.user_id,p_minutes:minutes,p_reason:reason});
    D.toast(error?error.message:'Member banned.');
  });
  $('#unbanProfile')?.addEventListener('click',async()=>{
    if(!isMod)return;
    const {error}=await client.rpc('doombot_ban_member',{p_user_id:target.user_id,p_minutes:0,p_reason:''});
    D.toast(error?error.message:'Ban removed.');
  });

  try{
    client=await D.waitForClient();user=await D.getUser(client);
    if(D.isPermanent(user)){
      viewer=await D.ensureProfile(client,user);
      isMod=['mod','admin'].includes(viewer.role);isAdmin=viewer.role==='admin';
      await client.from('doombot_profiles').update({last_seen_at:new Date().toISOString()}).eq('user_id',user.id);
    }
    const params=new URLSearchParams(location.search);
    const username=(params.get('u')||'').trim().toLowerCase();
    let q=client.from('doombot_profiles').select('*');
    if(username)q=q.eq('username',username);
    else if(D.isPermanent(user))q=q.eq('user_id',user.id);
    else throw new Error('Choose a member from the War Room to view their profile.');
    const {data,error}=await q.maybeSingle();
    if(error)throw error;if(!data)throw new Error('DOOMBOT member not found.');
    target=data;

    if(D.isPermanent(user)&&user.id!==target.user_id){
      const br=await client.from('doombot_blocks').select('blocked_id').eq('blocker_id',user.id).eq('blocked_id',target.user_id).maybeSingle();
      blocked=!!br.data;
    }
    render();await loadStats();
  }catch(err){
    $('#profileShell').innerHTML='<div class="war-empty">'+D.esc(err.message||String(err))+'</div>';
  }
})();
