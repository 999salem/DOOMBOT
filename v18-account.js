(async function(){
  const D=window.DOOMBOT_V18;
  const $=s=>document.querySelector(s);
  const authView=$('#accountAuthView'),memberView=$('#accountMemberView'),msg=$('#accountMessage');
  let client,user,profile;
  const PENDING='doombot-pending-upgrade-email-v18';

  function message(text,type='good'){
    if(!msg)return;
    msg.textContent=text;msg.className='v18-auth-message show '+type;
    msg.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function clearMessage(){if(msg){msg.className='v18-auth-message';msg.textContent=''}}
  function diag(id,text,state=''){
    const el=$(id);if(!el)return;el.textContent=text;el.className=state;
  }
  function pendingEmail(){
    try{return localStorage.getItem(PENDING)||''}catch(e){return ''}
  }
  function setPending(email){
    try{email?localStorage.setItem(PENDING,email):localStorage.removeItem(PENDING)}catch(e){}
  }
  function showPending(email){
    const panel=$('#upgradePendingPanel');
    if(!panel)return;
    panel.hidden=!email;
    $('#upgradePendingEmail').textContent=email||'Check your email';
    if(email)$('#upgradeGuestEmail').value=email;
  }
  function authErrorText(err){
    const raw=String(err?.message||err||'Account upgrade failed.');
    const l=raw.toLowerCase();
    if(l.includes('manual')||l.includes('link')||l.includes('identity')){
      diag('#diagUpgrade','MANUAL LINKING OFF','bad');
      return 'Supabase blocked identity linking. Open Supabase → Authentication → Sign In / Providers and turn “Allow manual linking” ON, then try again.';
    }
    if(l.includes('rate limit')){
      diag('#diagUpgrade','EMAIL RATE LIMITED','bad');
      return 'Supabase hit its email rate limit. Wait a bit and try again. The default Supabase mail service is intentionally limited.';
    }
    if(l.includes('already')||l.includes('registered')||l.includes('exists')){
      return 'That email already belongs to a DOOMBOT account. Use “Sign in to existing identity” instead.';
    }
    return raw;
  }

  function renderGuest(){
    authView.hidden=false;memberView.hidden=true;
    $('#accountStatus').innerHTML='<span class="v18-status guest">GUEST CLOUD SAVE ACTIVE</span>';
    $('#accountStatusCopy').textContent='Your private DOOMBOT data is safe. Link an email to convert this exact guest identity into a permanent member.';
    diag('#diagGuest','ANONYMOUS USER','good');
    diag('#diagCloud','CONNECTED','good');
    diag('#diagUpgrade','READY','good');
    showPending(pendingEmail());
  }

  function renderMember(){
    authView.hidden=true;memberView.hidden=false;
    $('#accountStatus').innerHTML='<span class="v18-status online">PERMANENT ACCOUNT LINKED</span>';
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
    setPending('');
    try{localStorage.removeItem('doombot-auth-mode-v18')}catch(e){}
  }

  async function refresh(forceSession=false){
    client=client||await D.waitForClient();
    diag('#diagCloud','CONNECTED','good');
    if(forceSession){
      try{await client.auth.refreshSession()}catch(e){}
    }
    user=await D.getUser(client);
    if(!user)throw new Error('No DOOMBOT session.');
    if(!D.isPermanent(user)){renderGuest();return false}
    profile=await D.ensureProfile(client,user);
    try{
      const now=new Date().toISOString();
      await client.from('doombot_profiles').update({last_seen_at:now}).eq('user_id',user.id);
      profile.last_seen_at=now;
    }catch(e){}
    renderMember();return true;
  }

  async function sendUpgrade(email,resend=false){
    clearMessage();
    client=client||await D.waitForClient();
    user=await D.getUser(client);
    if(!user?.is_anonymous){
      await refresh(true);
      message('This DOOMBOT identity is already permanent.');
      return;
    }
    const btn=$('#upgradeGuestButton');if(btn)btn.disabled=true;
    try{
      const redirect=new URL('./account.html',location.href).href;
      localStorage.setItem('doombot-auth-mode-v18','upgrade');
      setPending(email);
      const {data,error}=await client.auth.updateUser(
        {email},
        {emailRedirectTo:redirect}
      );
      if(error)throw error;
      showPending(email);
      diag('#diagUpgrade','EMAIL SENT','good');
      message((resend?'Verification resent to ':'Verification sent to ')+email+'. Open the email and confirm it. Your DOOMBOT user ID will stay the same.');
    }catch(err){
      if(!pendingEmail())try{localStorage.removeItem('doombot-auth-mode-v18')}catch(e){}
      message(authErrorText(err),'bad');
    }finally{
      if(btn)btn.disabled=false;
    }
  }

  $('#upgradeGuestForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const email=$('#upgradeGuestEmail').value.trim().toLowerCase();
    if(email)await sendUpgrade(email,false);
  });

  $('#upgradeResendButton')?.addEventListener('click',async()=>{
    const email=pendingEmail()||$('#upgradeGuestEmail').value.trim().toLowerCase();
    if(email)await sendUpgrade(email,true);
  });

  $('#upgradeCheckButton')?.addEventListener('click',async()=>{
    clearMessage();
    try{
      const permanent=await refresh(true);
      if(permanent)message('Account linked. Welcome to the War Room.');
      else message('The email is not confirmed yet. Tap the confirmation link in your inbox, then press this again.','bad');
    }catch(err){message(authErrorText(err),'bad')}
  });

  $('#upgradeOtpForm')?.addEventListener('submit',async e=>{
    e.preventDefault();clearMessage();
    const email=pendingEmail()||$('#upgradeGuestEmail').value.trim().toLowerCase();
    const token=$('#upgradeOtpCode').value.trim().replace(/\s+/g,'');
    if(!email||!token)return;
    try{
      client=client||await D.waitForClient();
      const {error}=await client.auth.verifyOtp({email,token,type:'email_change'});
      if(error)throw error;
      await refresh(true);
      message('Email verified. Your guest identity is now a permanent DOOMBOT account.');
    }catch(err){message(authErrorText(err),'bad')}
  });

  $('#existingAccountForm')?.addEventListener('submit',async e=>{
    e.preventDefault();clearMessage();
    const email=$('#existingAccountEmail').value.trim().toLowerCase();
    if(!email)return;
    try{
      client=client||await D.waitForClient();
      localStorage.setItem('doombot-auth-mode-v18','existing');
      const redirect=new URL('./account.html',location.href).href;
      const {error}=await client.auth.signInWithOtp({
        email,
        options:{emailRedirectTo:redirect,shouldCreateUser:false}
      });
      if(error)throw error;
      message('Magic link sent if that DOOMBOT account exists. Open it on this device to restore the account cloud state.');
    }catch(err){
      try{localStorage.removeItem('doombot-auth-mode-v18')}catch(e){}
      message(authErrorText(err),'bad');
    }
  });

  $('#profileForm')?.addEventListener('submit',async e=>{
    e.preventDefault();clearMessage();
    const username=$('#profileUsername').value.trim().toLowerCase();
    if(!/^[a-z0-9_]{3,20}$/.test(username)){
      message('Username must be 3–20 characters using lowercase letters, numbers or underscores.','bad');return;
    }
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
      message(text.toLowerCase().includes('duplicate')||text.toLowerCase().includes('unique')?'That @username is already taken.':text,'bad');
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
      setPending('');
      location.reload();
    }catch(err){message(err.message||String(err),'bad')}
  });

  try{
    client=await D.waitForClient();
    diag('#diagCloud','CONNECTED','good');

    client.auth.onAuthStateChange((event,session)=>{
      if(session?.user && !session.user.is_anonymous){
        setTimeout(()=>refresh(true).then(ok=>{if(ok)message('Identity confirmed. Permanent account is active.');}).catch(()=>{}),100);
      }
    });

    await refresh(false);
  }catch(err){
    diag('#diagCloud','ERROR','bad');
    diag('#diagGuest','UNKNOWN','bad');
    message(authErrorText(err),'bad');
  }
})();