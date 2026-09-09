(async function(){
  const D=window.DOOMBOT_V18;
  const $=s=>document.querySelector(s);
  const authView=$('#accountAuthView'), memberView=$('#accountMemberView');
  const msg=$('#accountMessage');
  let client,user,profile;

  function message(text,type='good'){
    msg.textContent=text;msg.className='v18-auth-message show '+type;
  }
  function clearMessage(){msg.className='v18-auth-message';msg.textContent=''}

  function renderGuest(){
    authView.hidden=false;memberView.hidden=true;
    $('#accountStatus').innerHTML='<span class="v18-status guest">GUEST CLOUD SAVE ACTIVE</span>';
    $('#accountStatusCopy').textContent='Your current locks, notes, favorites and personal theories are still saved. Upgrade this exact guest to keep the same Supabase user ID.';
  }

  function renderMember(){
    authView.hidden=true;memberView.hidden=false;
    $('#accountStatus').innerHTML='<span class="v18-status online">SIGNED IN</span>';
    $('#accountStatusCopy').textContent=user.email||'Permanent DOOMBOT member';
    $('#accountEmail').textContent=user.email||'Email identity linked';
    $('#profileRole').textContent=D.roleLabel(profile.role);
    $('#profileRole').className='v18-role '+D.roleClass(profile.role);
    $('#profileUsername').value=profile.username||'';
    $('#profileDisplayName').value=profile.display_name||'';
    $('#profileBio').value=profile.bio||'';
    $('#profileAvatar').value=profile.avatar_url||'';
    $('#profileFavorite').value=profile.favorite_character||'';
    $('#profileHideSpoilers').checked=profile.hide_spoilers!==false;
    $('#profileShowOnline').checked=profile.show_online!==false;
    $('#profileAvatarPreview').innerHTML=D.avatar(profile);
    $('#profileHandlePreview').textContent='@'+profile.username;
    $('#profileNamePreview').textContent=profile.display_name||'DOOMBOT MEMBER';
    $('#openMyProfile').href='./profile.html?u='+encodeURIComponent(profile.username);
  }

  async function refresh(){
    client=await D.waitForClient();
    user=await D.getUser(client);
    if(!user)throw new Error('No DOOMBOT session.');
    if(!D.isPermanent(user)){renderGuest();return}
    profile=await D.ensureProfile(client,user);
    try{
      await client.from('doombot_profiles').update({last_seen_at:new Date().toISOString()}).eq('user_id',user.id);
      profile.last_seen_at=new Date().toISOString();
    }catch(e){}
    renderMember();
  }

  $('#upgradeGuestForm')?.addEventListener('submit',async e=>{
    e.preventDefault();clearMessage();
    const email=$('#upgradeGuestEmail').value.trim();
    if(!email)return;
    try{
      client=client||await D.waitForClient();
      user=await D.getUser(client);
      if(!user?.is_anonymous){message('This DOOMBOT session is already a permanent account.');return}
      localStorage.setItem('doombot-auth-mode-v18','upgrade');
      const {error}=await client.auth.updateUser({email});
      if(error)throw error;
      message('Check '+email+'. Tap the confirmation link and this SAME guest save will become your permanent DOOMBOT account.');
    }catch(err){
      localStorage.removeItem('doombot-auth-mode-v18');
      message((err.message||String(err))+' If that email already belongs to an account, use “Sign in to existing account” below.','bad');
    }
  });

  $('#existingAccountForm')?.addEventListener('submit',async e=>{
    e.preventDefault();clearMessage();
    const email=$('#existingAccountEmail').value.trim();
    if(!email)return;
    try{
      client=client||await D.waitForClient();
      localStorage.setItem('doombot-auth-mode-v18','existing');
      const redirect=location.origin+location.pathname;
      const {error}=await client.auth.signInWithOtp({
        email,
        options:{emailRedirectTo:redirect,shouldCreateUser:false}
      });
      if(error)throw error;
      message('Magic link sent if that account exists. Open it on this device to restore that account’s cloud data.');
    }catch(err){
      localStorage.removeItem('doombot-auth-mode-v18');
      message(err.message||String(err),'bad');
    }
  });

  $('#profileForm')?.addEventListener('submit',async e=>{
    e.preventDefault();clearMessage();
    const username=$('#profileUsername').value.trim().toLowerCase();
    if(!/^[a-z0-9_]{3,20}$/.test(username)){message('Username must be 3–20 characters using lowercase letters, numbers or underscores.','bad');return}
    try{
      const payload={
        username,
        display_name:$('#profileDisplayName').value.trim().slice(0,50),
        bio:$('#profileBio').value.trim().slice(0,280),
        avatar_url:D.cleanUrl($('#profileAvatar').value.trim())||null,
        favorite_character:$('#profileFavorite').value.trim().slice(0,60),
        hide_spoilers:$('#profileHideSpoilers').checked,
        show_online:$('#profileShowOnline').checked,
        last_seen_at:new Date().toISOString()
      };
      const {data,error}=await client.from('doombot_profiles').update(payload).eq('user_id',user.id).select('*').single();
      if(error)throw error;
      profile=data;renderMember();message('DOOMBOT profile saved.');
    }catch(err){
      const text=String(err.message||err);
      message(text.includes('duplicate')||text.includes('unique')?'That @username is already taken.':text,'bad');
    }
  });

  $('#profileAvatar')?.addEventListener('input',()=>{
    const fake={...profile,avatar_url:D.cleanUrl($('#profileAvatar').value),display_name:$('#profileDisplayName').value,username:$('#profileUsername').value};
    $('#profileAvatarPreview').innerHTML=D.avatar(fake);
  });

  $('#signOutButton')?.addEventListener('click',async()=>{
    if(!confirm('Sign out of this DOOMBOT account on this device? Your account data stays in the cloud.'))return;
    try{
      await window.DOOMBOT_CLOUD_SYNC?.();
      await client.auth.signOut();
      const exact=['doombot-watchlist-v1','salem-doomsday-intel-queue-v1','doombot-custom-theories-v1','doombot-seen-v13','doombot-last-visit'];
      exact.forEach(k=>localStorage.removeItem(k));
      const remove=[];
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(k&&(k.startsWith('salem-lock-')||k.startsWith('salem-note-')||k.startsWith('doombot-fav-')))remove.push(k);
      }
      remove.forEach(k=>localStorage.removeItem(k));
      localStorage.removeItem('doombot-cloud-local-updated-v14');
      localStorage.removeItem('doombot-auth-mode-v18');
      location.reload();
    }catch(err){message(err.message||String(err),'bad')}
  });

  try{await refresh()}catch(err){message(err.message||String(err),'bad')}
})();
