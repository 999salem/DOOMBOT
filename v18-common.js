(function(){
  const D={};
  D.sleep=ms=>new Promise(r=>setTimeout(r,ms));
  D.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  D.attr=D.esc;
  D.cleanUrl=u=>{try{const x=new URL(String(u||''));return /^https?:$/.test(x.protocol)?x.href:''}catch(e){return ''}};
  D.roleLabel=r=>r==='admin'?'ARCHIVE CREATOR':r==='mod'?'MODERATOR':r==='supporter'?'SUPPORTER':'MEMBER';
  D.roleClass=r=>r==='admin'?'admin':r==='mod'?'mod':r==='supporter'?'supporter':'member';
  D.channelLabel=c=>({'general':'GENERAL','leaks':'LEAK ROOM','plot':'PLOT SPOILERS','theory':'THEORY LAB','secret-wars':'SECRET WARS'}[c]||'GENERAL');
  D.initials=p=>{
    const raw=(p?.display_name||p?.username||'?').trim();
    return raw.split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase().slice(0,2)||'?';
  };
  D.avatar=p=>{
    const url=D.cleanUrl(p?.avatar_url);
    return url?`<img src="${D.attr(url)}" alt="" loading="lazy" onerror="this.remove()">`:D.esc(D.initials(p));
  };
  D.relative=date=>{
    const ms=Date.now()-new Date(date).getTime();
    if(!Number.isFinite(ms))return '';
    const s=Math.max(0,Math.floor(ms/1000));
    if(s<60)return 'just now';
    const m=Math.floor(s/60);if(m<60)return m+'m ago';
    const h=Math.floor(m/60);if(h<24)return h+'h ago';
    const d=Math.floor(h/24);if(d<30)return d+'d ago';
    return new Date(date).toLocaleDateString(undefined,{month:'short',day:'numeric',year:new Date(date).getFullYear()!==new Date().getFullYear()?'numeric':undefined});
  };
  D.toast=msg=>{
    let el=document.getElementById('v18Toast');
    if(!el){el=document.createElement('div');el.id='v18Toast';el.className='v18-toast';document.body.appendChild(el)}
    el.textContent=msg;el.classList.add('show');clearTimeout(D._toast);D._toast=setTimeout(()=>el.classList.remove('show'),2200);
  };
  D.waitForClient=async(timeout=10000)=>{
    const start=Date.now();
    while(Date.now()-start<timeout){
      if(window.DOOMBOT_SUPABASE)return window.DOOMBOT_SUPABASE;
      await D.sleep(60);
    }
    throw new Error('Cloud client did not initialize.');
  };
  D.getUser=async client=>{
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    return data?.session?.user||null;
  };
  D.isPermanent=user=>!!user&&!user.is_anonymous;
  D.ensureProfile=async(client,user)=>{
    if(!D.isPermanent(user))return null;
    let {data,error}=await client.from('doombot_profiles').select('*').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    if(data)return data;
    const base=('member_'+user.id.replace(/-/g,'').slice(0,8)).slice(0,20);
    const payload={
      user_id:user.id,username:base,display_name:'',bio:'',favorite_character:'',
      hide_spoilers:true,show_online:true,last_seen_at:new Date().toISOString()
    };
    const ins=await client.from('doombot_profiles').insert(payload).select('*').single();
    if(ins.error)throw ins.error;
    return ins.data;
  };
  D.loadProfiles=async(client,ids)=>{
    const unique=[...new Set((ids||[]).filter(Boolean))];
    if(!unique.length)return new Map();
    const {data,error}=await client.from('doombot_profiles')
      .select('user_id,username,display_name,bio,avatar_url,favorite_character,role,hide_spoilers,show_online,joined_at,last_seen_at')
      .in('user_id',unique);
    if(error)throw error;
    return new Map((data||[]).map(p=>[p.user_id,p]));
  };
  D.isOnline=p=>!!p?.show_online && (Date.now()-new Date(p.last_seen_at).getTime())<5*60*1000;
  window.DOOMBOT_V18=D;
})();
