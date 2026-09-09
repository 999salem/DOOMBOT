(function(){
  const D=window.DOOMBOT_V18;
  function read(){
    try{const x=JSON.parse(localStorage.getItem('doombot-custom-theories-v1')||'[]');return Array.isArray(x)?x:[]}catch(e){return []}
  }
  function attach(){
    const list=read();
    document.querySelectorAll('.custom-theory[data-custom-id]').forEach(card=>{
      const id=String(card.dataset.customId||'');
      const actions=card.querySelector('.custom-theory-actions');
      if(!actions||actions.querySelector('[data-post-warroom]'))return;
      const btn=document.createElement('button');
      btn.type='button';btn.dataset.postWarroom=id;btn.textContent='POST TO WAR ROOM';
      actions.insertBefore(btn,actions.firstChild);
    });
  }
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-post-warroom]');if(!btn)return;
    const item=read().find(x=>String(x.id)===String(btn.dataset.postWarroom));if(!item)return;
    const draft={
      title:item.title||'My DOOMBOT theory',
      summary:item.summary||'',
      evidence:item.evidence||'',
      confidence:Number(item.confidence)||50
    };
    localStorage.setItem('doombot-warroom-theory-draft-v1',JSON.stringify(draft));
    location.href='./warroom.html?new=1';
  });
  attach();
})();
