let token=localStorage.getItem('sociaudio_token')||'',me=null,posts=[],users=[],communities=[],notifications={items:[],unread:0},view='feed',postImage='',postMediaType='',postMediaName='',postMediaSize=0,pendingPostFile=null,postObjectUrl='',postGallery=[],profileGalleryNew=[],avatarImage='',coverImage='',editingPostId=null,imageChanged=false,openCommentPosts=new Set(),currentQuoteUser=null,lastHireMatches=[];

let chatPoll=null;
let chatConversationId=null;
const SOCIAUDIO_VERSION='v4.0.1 Public';

window.addEventListener('error',event=>{
  console.error('[Rede Sociaudio]',event.error||event.message);
});

window.addEventListener('unhandledrejection',event=>{
  console.error('[Rede Sociaudio] Falha assíncrona:',event.reason);
});

async function checkPlatformHealth(){
  try{
    const health=await api('/api/health');
    const indicator=document.getElementById('betaHealth');
    if(indicator){
      indicator.textContent=health.ok?'Sistema online':'Sistema instável';
      indicator.classList.toggle('ok',!!health.ok);
      indicator.classList.toggle('error',!health.ok);
      indicator.title=`${health.version} · ${health.database?.tables||0} tabelas`;
    }
  }catch(error){
    const indicator=document.getElementById('betaHealth');
    if(indicator){
      indicator.textContent='Sistema instável';
      indicator.classList.remove('ok');
      indicator.classList.add('error');
    }
  }
}

const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const ICONS={
brain:'<svg viewBox="0 0 24 24"><path d="M9 4.5a3.5 3.5 0 0 0-5 3.2 3.8 3.8 0 0 0 1.2 7.3A3.7 3.7 0 0 0 9 19.5M15 4.5a3.5 3.5 0 0 1 5 3.2 3.8 3.8 0 0 1-1.2 7.3 3.7 3.7 0 0 1-3.8 4.5M9 4.5v15M15 4.5v15M9 8h2.5M15 11h-2.5M9 15h2.5M15 7.5h-2"/></svg>',
store:'<svg viewBox="0 0 24 24"><path d="M4 9h16l-1-5H5zM5 9v11h14V9M9 20v-6h6v6"/><path d="M4 9c0 1.5 1 2.5 2.5 2.5S9 10.5 9 9c0 1.5 1 2.5 2.5 2.5S14 10.5 14 9c0 1.5 1 2.5 2.5 2.5S19 10.5 19 9"/></svg>',
company:'<svg viewBox="0 0 24 24"><path d="M4 21V7l8-4 8 4v15M8 21v-4h8v4M8 9h2m4 0h2m-8 4h2m4 0h2"/></svg>',
home:'<svg viewBox="0 0 24 24"><path d="M3.5 10.7 12 3.8l8.5 6.9v8.1a1.7 1.7 0 0 1-1.7 1.7h-4.3v-6h-5v6H5.2a1.7 1.7 0 0 1-1.7-1.7z"/></svg>',
professionals:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M3.5 19c.4-4 2.4-6 5.5-6s5.1 2 5.5 6M14 14.4c.8-.6 1.7-.9 2.8-.9 2.4 0 3.8 1.5 4.1 4.5"/></svg>',
communities:'<svg viewBox="0 0 24 24"><circle cx="12" cy="6.8" r="2.6"/><circle cx="5.8" cy="10" r="2.2"/><circle cx="18.3" cy="10" r="2.2"/><path d="M7.4 20c.4-3.7 2-5.5 4.6-5.5s4.2 1.8 4.6 5.5M1.8 19c.3-2.8 1.6-4.2 3.8-4.2 1 0 1.9.3 2.5.9M22.2 19c-.3-2.8-1.6-4.2-3.8-4.2-1 0-1.9.3-2.5.9"/></svg>',
saved:'<svg viewBox="0 0 24 24"><path d="M6 3.8h12v17.4L12 16l-6 4.2z"/></svg>',
bell:'<svg viewBox="0 0 24 24"><path d="M5.2 17.3h13.6l-1.8-2.5V10a5 5 0 0 0-10 0v4.8z"/><path d="M10 20h4"/></svg>',
profile:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M5 20c.6-4.2 2.9-6.3 7-6.3s6.4 2.1 7 6.3"/></svg>',
admin:'<svg viewBox="0 0 24 24"><path d="M12 3.3 19 6v5.1c0 4.7-2.3 7.8-7 9.6-4.7-1.8-7-4.9-7-9.6V6z"/><path d="m9.3 12 1.7 1.7 3.8-4"/></svg>',
plus:'<svg viewBox="0 0 24 24"><path d="M12 5v15M5 12h14"/></svg>',
search:'<svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4.2 4.2"/></svg>',
like:'<svg viewBox="0 0 24 24"><path d="M7.5 20H4V9.5h3.5M7.5 18.5l2.2 1.2h7.6c1.2 0 2.1-.8 2.4-1.9l1.2-5.6c.3-1.4-.8-2.7-2.2-2.7h-4.9l.7-3.1c.3-1.4-.7-2.7-2.1-2.7h-.8L7.5 9.5z"/></svg>',
comment:'<svg viewBox="0 0 24 24"><path d="M4 5.5h16v11H10l-5.5 3.5v-3.5H4z"/></svg>',
share:'<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.2"/><circle cx="6" cy="12" r="2.2"/><circle cx="18" cy="19" r="2.2"/><path d="m8 11 8-4.7M8 13l8 4.7"/></svg>',
edit:'<svg viewBox="0 0 24 24"><path d="m4 20 4.2-1 10.5-10.5-3.2-3.2L5 15.8zM14.8 6l3.2 3.2"/></svg>',
more:'<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
link:'<svg viewBox="0 0 24 24"><path d="M9.5 14.5 14.5 9M7.8 17.7l-1.5 1.5a3.5 3.5 0 0 1-5-5l4-4a3.5 3.5 0 0 1 5 0M16.2 6.3l1.5-1.5a3.5 3.5 0 1 1 5 5l-4 4a3.5 3.5 0 0 1-5 0"/></svg>',
photo:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.2" cy="9" r="1.7"/><path d="m5 18 5.2-5 3.2 3 2.6-2.4 3 4.4"/></svg>',
audio:'<svg viewBox="0 0 24 24"><path d="M4 13v-2M8 17V7M12 20V4M16 17V7M20 13v-2"/></svg>',
video:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-2v8l-4-2z"/></svg>',
file:'<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v15H6zM14 3v5h5M9 12h6M9 16h6"/></svg>',
location:'<svg viewBox="0 0 24 24"><path d="M12 21s6-5.6 6-11a6 6 0 1 0-12 0c0 5.4 6 11 6 11z"/><circle cx="12" cy="10" r="2"/></svg>',
target:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 3V1M21 12h2M12 21v2M3 12H1"/></svg>',
briefcase:'<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></svg>',
chat:'<svg viewBox="0 0 24 24"><path d="M4 5h16v12H9l-5 4v-4H4z"/><path d="M8 9h8M8 13h5"/></svg>',
book:'<svg viewBox="0 0 24 24"><path d="M4 4.5h6.5A3.5 3.5 0 0 1 14 8v12a3.5 3.5 0 0 0-3.5-3.5H4z"/><path d="M20 4.5h-6.5A3.5 3.5 0 0 0 10 8v12a3.5 3.5 0 0 1 3.5-3.5H20z"/></svg>'
};
function icon(name,cls=''){return `<span class="sa-icon ${cls}">${ICONS[name]||''}</span>`}
function hydrateIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=ICONS[el.dataset.icon]||'';el.classList.add('sa-icon')})}


async function applyPlatformSettings(){
  try{
    let settings=await api('/api/settings');
    if(settings.primary_color){
      document.documentElement.style.setProperty('--blue',settings.primary_color);
      document.documentElement.style.setProperty('--blue-600',settings.primary_color);
    }
  }catch{}
}

function toast(t,b=false){toastEl.textContent=t;toastEl.className=b?'show bad':'show';setTimeout(()=>toastEl.className='',2800)}

function sidebarPlanLabel(plan){
  const labels={free:'FREE',pro:'PRO',company:'EMPRESA',admin:'ADMIN'};
  return labels[String(plan||'free').toLowerCase()]||'FREE';
}

function setIdentityAvatar(container,user,header=false){
  if(!container||!user)return;
  const initial=(user.name||'U').trim().slice(0,1).toUpperCase();
  const cacheKey=`sociaudio_avatar_${user.id||'current'}`;
  let avatar=(user.avatar||'').trim();

  if(avatar){
    try{localStorage.setItem(cacheKey,avatar)}catch{}
  }else{
    try{avatar=localStorage.getItem(cacheKey)||''}catch{}
  }

  container.innerHTML='';
  if(avatar){
    container.className=header?'header-avatar-image':'sidebar-avatar sidebar-avatar-image';
    const img=document.createElement('img');
    img.src=avatar;
    img.alt='Foto de '+(user.name||'usuário');
    img.decoding='async';
    img.loading='eager';
    img.addEventListener('error',()=>{
      try{localStorage.removeItem(cacheKey)}catch{}
      container.className=header?'header-avatar-fallback':'sidebar-avatar sidebar-avatar-fallback';
      container.textContent=initial;
    },{once:true});
    container.appendChild(img);
  }else{
    container.className=header?'header-avatar-fallback':'sidebar-avatar sidebar-avatar-fallback';
    container.textContent=initial;
  }
}

function renderSidebarIdentity(){
  if(typeof me==='undefined'||!me)return;
  const name=document.getElementById('sidebarName');
  const role=document.getElementById('sidebarRole');
  const verified=document.getElementById('sidebarVerified');
  const plan=document.getElementById('sidebarPlan');

  if(name)name.textContent=me.name||'Usuário';
  if(role)role.textContent=me.professional_title||me.headline||me.role||'Ver perfil profissional';
  if(verified)verified.innerHTML=(typeof verifiedBadge==='function')?verifiedBadge(me):'';
  if(plan){
    const planClass=String(me.plan||'free').toLowerCase();
    plan.textContent=sidebarPlanLabel(planClass);
    plan.className='sidebar-plan '+planClass;
  }

  setIdentityAvatar(document.getElementById('sidebarAvatar'),me,false);
  setIdentityAvatar(document.getElementById('headerAvatar'),me,true);
  mountProfessionalSidebar();
}



/* Rede Sociaudio Beta 3.2.2 — componente definitivo da sidebar */
function setImportantStyle(element,property,value){
  if(element)element.style.setProperty(property,value,'important');
}

function mountProfessionalSidebar(){
  const sidebar=document.getElementById('mainSidebar');
  const brand=document.getElementById('sidebarBrandPanel');
  const userCard=document.getElementById('sidebarUserCard');
  if(!sidebar||!brand||!userCard)return;

  if(sidebar.firstElementChild!==brand)sidebar.prepend(brand);
  if(brand.nextElementSibling!==userCard)brand.after(userCard);

  if(brand.dataset.mounted!=='1'){
    brand.innerHTML=`
      <div class="sidebar-brand-row">
        <span class="beta-label">V4.0.1 PUBLIC</span>
        <span id="betaHealth" class="beta-health ok">Sistema online</span>
      </div>
      <strong>Marketplace Inteligente<br>de Áudio</strong>`;
    brand.dataset.mounted='1';
  }

  [
    ['display','flex'],['flex-direction','column'],['align-items','stretch'],
    ['align-content','initial'],['gap','4px'],['height','calc(100vh - 104px)'],
    ['padding','12px 8px 0'],['overflow-y','auto'],['overflow-x','hidden'],
    ['box-sizing','border-box'],['background','#f7f9fc']
  ].forEach(([p,v])=>setImportantStyle(sidebar,p,v));

  [
    ['position','relative'],['display','grid'],['grid-template-columns','1fr'],
    ['flex','0 0 auto'],['gap','17px'],['width','100%'],['min-width','0'],
    ['min-height','138px'],['height','138px'],['max-height','138px'],
    ['margin','0 0 14px'],['padding','17px 18px'],['overflow','hidden'],
    ['box-sizing','border-box'],['border','1px solid #173f76'],
    ['border-radius','15px'],['color','#ffffff'],
    ['background','radial-gradient(circle at 90% 15%,rgba(45,130,255,.28),transparent 34%),linear-gradient(145deg,#061a36 0%,#0a2b5b 58%,#123f83 100%)'],
    ['box-shadow','0 10px 25px rgba(15,45,92,.20)'],['transform','none'],
    ['inset','auto'],['float','none'],['z-index','2']
  ].forEach(([p,v])=>setImportantStyle(brand,p,v));

  const row=brand.querySelector('.sidebar-brand-row');
  [
    ['display','flex'],['align-items','center'],['justify-content','flex-start'],
    ['gap','10px'],['width','100%'],['min-height','26px'],['margin','0'],['padding','0']
  ].forEach(([p,v])=>setImportantStyle(row,p,v));

  const badge=brand.querySelector('.beta-label');
  [
    ['display','inline-flex'],['align-items','center'],['justify-content','center'],
    ['width','auto'],['height','25px'],['min-height','25px'],['padding','0 11px'],
    ['margin','0'],['border','1px solid rgba(255,255,255,.20)'],
    ['border-radius','999px'],['background','linear-gradient(180deg,#2b88ff,#1164d8)'],
    ['color','#fff'],['font-size','9px'],['font-weight','900'],['line-height','1'],
    ['letter-spacing','.06em'],['white-space','nowrap']
  ].forEach(([p,v])=>setImportantStyle(badge,p,v));

  const health=brand.querySelector('.beta-health');
  [
    ['display','inline-flex'],['align-items','center'],['gap','6px'],['width','auto'],
    ['margin','0'],['padding','0'],['color','#dceaff'],['font-size','10px'],
    ['font-weight','800'],['white-space','nowrap']
  ].forEach(([p,v])=>setImportantStyle(health,p,v));

  const title=brand.querySelector('strong');
  [
    ['display','block'],['width','100%'],['margin','0'],['padding','0'],
    ['color','#fff'],['font-size','17px'],['font-weight','850'],['line-height','1.28'],
    ['letter-spacing','-.02em'],['white-space','normal'],['word-break','normal']
  ].forEach(([p,v])=>setImportantStyle(title,p,v));

  [
    ['position','relative'],['display','grid'],['grid-template-columns','64px minmax(0,1fr)'],
    ['align-items','center'],['flex','0 0 auto'],['gap','13px'],['width','100%'],
    ['min-width','0'],['min-height','96px'],['height','auto'],['margin','0 0 16px'],
    ['padding','14px'],['overflow','hidden'],['box-sizing','border-box'],
    ['border','1px solid #dfe6ef'],['border-radius','14px'],['background','#fff'],
    ['box-shadow','0 7px 18px rgba(16,24,40,.06)'],['transform','none'],['inset','auto'],
    ['float','none'],['z-index','2']
  ].forEach(([p,v])=>setImportantStyle(userCard,p,v));

  const avatar=document.getElementById('sidebarAvatar');
  [
    ['width','64px'],['height','64px'],['min-width','64px'],['min-height','64px'],
    ['max-width','64px'],['max-height','64px'],['border-radius','50%'],['overflow','hidden'],
    ['display','grid'],['place-items','center'],['padding','0'],['margin','0'],
    ['border','4px solid #fff'],['box-shadow','0 0 0 1px #cdd9ea,0 8px 18px rgba(16,24,40,.18)'],
    ['background','#1769e0'],['box-sizing','border-box']
  ].forEach(([p,v])=>setImportantStyle(avatar,p,v));
  const avatarImg=avatar?.querySelector('img');
  if(avatarImg){
    [['width','100%'],['height','100%'],['object-fit','cover'],['object-position','center center'],
     ['display','block'],['border-radius','50%'],['margin','0'],['padding','0']]
      .forEach(([p,v])=>setImportantStyle(avatarImg,p,v));
  }

  const userInfo=userCard.querySelector('.sidebar-user-info');
  [['display','block'],['width','100%'],['min-width','0'],['overflow','hidden']]
    .forEach(([p,v])=>setImportantStyle(userInfo,p,v));
  bindViewNavigation();
}

window.addEventListener('DOMContentLoaded',()=>{
  mountProfessionalSidebar();
});

async function api(path,opt={}){opt.headers={'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(opt.headers||{})};let r;try{r=await fetch(path,opt)}catch{throw Error('Não foi possível conectar ao servidor. Mantenha a janela preta aberta.')}let d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Erro inesperado');return d}
function fileToData(file,max=1500){return new Promise((res,rej)=>{if(!file)return res('');if(file.size>5*1024*1024)return rej(Error('A imagem deve ter no máximo 5 MB.'));let fr=new FileReader();fr.onload=()=>{let i=new Image();i.onload=()=>{let sc=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=Math.round(i.width*sc);c.height=Math.round(i.height*sc);c.getContext('2d').drawImage(i,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.82))};i.src=fr.result};fr.onerror=rej;fr.readAsDataURL(file)})}
function currentVideoLimit(){return Number(me?.video_limit_bytes||250*1024*1024)}
function currentAudioLimit(){return Number(me?.audio_limit_bytes||100*1024*1024)}
function fileExt(name=''){let m=name.toLowerCase().match(/\.[^.]+$/);return m?m[0]:''}
const documentExts=new Set(['.pdf','.doc','.docx','.odt','.rtf','.txt','.md','.xls','.xlsx','.ods','.csv','.ppt','.pptx','.odp','.xml','.json','.yaml','.yml']);
const archiveExts=new Set(['.zip','.rar','.7z']);
const technicalExts=new Set(['.rew','.mdat','.trace','.frd','.zma','.cal','.mic','.ssn','.scn','.scene','.show','.preset','.fxp','.fxb','.vstpreset','.ir','.syx','.mid','.midi','.cue','.rider']);
function allowedGenericFile(f){let e=fileExt(f.name);return documentExts.has(e)||archiveExts.has(e)||technicalExts.has(e)}
function genericFileLimit(f){let e=fileExt(f.name);if(archiveExts.has(e))return Number(me?.archive_limit_label?.includes('GB')?parseFloat(me.archive_limit_label)*1024**3:parseFloat(me?.archive_limit_label||500)*1024**2);if(documentExts.has(e))return Number(me?.document_limit_label?.includes('GB')?parseFloat(me.document_limit_label)*1024**3:parseFloat(me?.document_limit_label||100)*1024**2);return Number(me?.technical_file_limit_label?.includes('GB')?parseFloat(me.technical_file_limit_label)*1024**3:parseFloat(me?.technical_file_limit_label||250)*1024**2)}
function humanSize(n){return n>=1024**3?`${Math.round(n/1024**3)} GB`:`${Math.round(n/1024**2)} MB`}
function fileToPostMedia(file){return new Promise(async(res,rej)=>{if(!file)return res({data:'',type:'',name:'',size:0,file:null});if(file.type.startsWith('image/')){try{return res({data:await fileToData(file,1800),type:'image/jpeg',name:file.name,size:file.size,file:null})}catch(e){return rej(e)}}if(['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/mp4','audio/aac','audio/flac','audio/x-flac'].includes(file.type)){let limit=currentAudioLimit();if(file.size>limit)return rej(Error(`Seu plano ${me?.plan_label||'Gratuito'} permite áudios de até ${humanSize(limit)}.`));return res({data:'',type:file.type,name:file.name,size:file.size,file})}if(['video/mp4','video/webm'].includes(file.type)){let limit=currentVideoLimit();if(file.size>limit)return rej(Error(`Seu plano ${me?.plan_label||'Gratuito'} permite vídeos de até ${humanSize(limit)}.`));let fr=new FileReader();fr.onload=()=>res({data:fr.result,type:file.type,name:file.name,size:file.size,file:null});fr.onerror=()=>rej(Error('Não foi possível ler o vídeo.'));fr.readAsDataURL(file);return}if(allowedGenericFile(file)){let limit=genericFileLimit(file);if(file.size>limit)return rej(Error(`Este arquivo ultrapassa o limite do seu plano (${humanSize(limit)}).`));return res({data:'',type:file.type||'application/octet-stream',name:file.name,size:file.size,file})}return rej(Error('Formato não permitido. Use documentos, planilhas, apresentações, ZIP/RAR/7Z ou arquivos técnicos de áudio.'))})}
function clearPostObjectUrl(){if(postObjectUrl){URL.revokeObjectURL(postObjectUrl);postObjectUrl=''}}

async function filesToGallery(files,maxFiles=6){
  let list=[...(files||[])].filter(f=>f.type.startsWith('image/')).slice(0,maxFiles);
  if(!list.length)return[];
  let output=[];
  for(let file of list){
    output.push({data:await fileToData(file,1800),name:file.name,size:file.size});
  }
  return output;
}
function openImageViewer(src,caption=''){
  let old=document.querySelector('#imageViewer');if(old)old.remove();
  let modal=document.createElement('div');modal.id='imageViewer';modal.className='image-viewer';
  modal.innerHTML=`<button class="image-viewer-close" aria-label="Fechar">✕</button><img src="${esc(src)}" alt="${esc(caption||'Imagem')}">${caption?`<p>${esc(caption)}</p>`:''}`;
  modal.onclick=e=>{if(e.target===modal||e.target.closest('.image-viewer-close'))modal.remove()};
  document.body.appendChild(modal);
}
function galleryMarkup(items=[],editable=false){
  if(!items.length)return '<div class="gallery-empty">Nenhuma foto adicionada.</div>';
  return `<div class="profile-gallery-grid">${items.map(x=>`<figure><img src="${esc(x.image_url||x.data||x.media_url||'')}" onclick="openImageViewer(this.src,'${esc(x.caption||'')}')" alt="Foto da galeria">${editable&&x.id?`<button type="button" onclick="deleteProfileGallery(${x.id})">Remover</button>`:''}${x.caption?`<figcaption>${esc(x.caption)}</figcaption>`:''}</figure>`).join('')}</div>`;
}
async function deleteProfileGallery(id){
  if(!confirm('Remover esta foto da galeria?'))return;
  try{await api(`/api/profile/gallery/${id}/delete`,{method:'POST'});me=(await api('/api/me')).user;try{if(me.avatar)localStorage.setItem(`sociaudio_avatar_${me.id}`,me.avatar)}catch{};renderSidebarIdentity();renderProfile();toast('Foto removida.')}catch(e){toast(e.message,true)}
}

function showPostMediaPreview(){
  let isVideo=postMediaType.startsWith('video/'),isAudio=postMediaType.startsWith('audio/'),isFile=!!postMediaType&&!isVideo&&!isAudio&&!postMediaType.startsWith('image/');
  postPreview.hidden=!postImage||isVideo||isAudio||isFile||postGallery.length>1;
  postVideoPreview.hidden=!postImage||!isVideo;
  postAudioPreview.hidden=!postImage||!isAudio;
  postFilePreview.hidden=!isFile;
  let grid=document.querySelector('#postGalleryPreview');
  if(grid){grid.hidden=!postGallery.length;grid.innerHTML=postGallery.map((x,i)=>`<div><img src="${x.data||x.media_url||x.image_url}" alt="Foto ${i+1}"><button type="button" onclick="postGallery.splice(${i},1);showPostMediaPreview()">✕</button></div>`).join('')}
  if(isFile)postFilePreview.innerHTML=`<b>${esc(postMediaName||'Arquivo')}</b><small>${humanSize(postMediaSize||pendingPostFile?.size||0)} · pronto para enviar</small>`;
  if(postImage){
    if(isVideo){postVideoPreview.src=postImage;postPreview.removeAttribute('src');postAudioPreview.pause();postAudioPreview.removeAttribute('src')}
    else if(isAudio){postAudioPreview.src=postImage;postPreview.removeAttribute('src');postVideoPreview.pause();postVideoPreview.removeAttribute('src')}
    else if(!isFile&&postGallery.length<=1){postPreview.src=postImage;postVideoPreview.pause();postVideoPreview.removeAttribute('src');postAudioPreview.pause();postAudioPreview.removeAttribute('src')}
  }else if(!isFile){postPreview.removeAttribute('src');postVideoPreview.pause();postVideoPreview.removeAttribute('src');postAudioPreview.pause();postAudioPreview.removeAttribute('src')}
  removePostImage.hidden=!postImage&&!pendingPostFile&&!postGallery.length
}
async function uploadPendingAudio(file){let r;try{r=await fetch('/api/media/audio',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name)},body:file})}catch{throw Error('Não foi possível enviar o áudio. Verifique se o servidor está aberto.')}let d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Falha no upload do áudio.');return d}
async function uploadPendingFile(file){let r=await fetch('/api/media/file',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name),'X-File-Type':file.type||'application/octet-stream','Content-Length':String(file.size)},body:file});let data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Falha ao enviar o arquivo.');return data}

function avatar(u,cls=''){return u.avatar?`<img class="avatar ${cls}" src="${u.avatar}" alt="">`:`<div class="avatar ${cls}">${esc(u.name).charAt(0)}</div>`}
function lines(v){return esc(v||'').split(/[,\n]/).filter(Boolean).map(x=>`<span class="skill">${x.trim()}</span>`).join('')}
function tab(w){login.hidden=w!=='login';register.hidden=w!=='register';msg.textContent=''}
async function boot(){await applyPlatformSettings();if(token){try{me=(await api('/api/me')).user;renderSidebarIdentity();showApp();return}catch{localStorage.removeItem('sociaudio_token');token=''}}auth.hidden=false;auth.style.display='grid';app.hidden=true}
function showApp(){mountProfessionalSidebar();auth.hidden=true;auth.style.display='none';app.hidden=false;app.style.display='block';headerName.textContent=me.name;renderSidebarIdentity();if(window.sidebarRole)sidebarRole.textContent=`${me.role} · ${me.plan_label||'Gratuito'}`;adminNav.hidden=!me.is_admin;hydrateIcons();loadAll()}
async function loadAll(){try{
  [posts,users,communities,notifications]=await Promise.all([
    api('/api/posts'),
    api('/api/users'),
    api('/api/communities'),
    api('/api/notifications')
  ]);
  notificationItems=notifications.items||[];
  notificationUnread=Number(notifications.unread||0);
  updateNotificationBadge();
  render();
}catch(e){toast(e.message,true)}}
loginTab.onclick=()=>{tab('login');loginTab.classList.add('active');registerTab.classList.remove('active')};registerTab.onclick=()=>{tab('register');registerTab.classList.add('active');loginTab.classList.remove('active')};
login.onsubmit=async e=>{e.preventDefault();try{token=(await api('/api/login',{method:'POST',body:JSON.stringify({email:le.value,password:lp.value})})).token;localStorage.setItem('sociaudio_token',token);me=(await api('/api/me')).user;renderSidebarIdentity();showApp()}catch(e){msg.textContent=e.message}};
register.onsubmit=async e=>{e.preventDefault();try{token=(await api('/api/register',{method:'POST',body:JSON.stringify({name:rn.value,email:re.value,password:rp.value,role:rr.value,city:rc.value})})).token;localStorage.setItem('sociaudio_token',token);me=(await api('/api/me')).user;renderSidebarIdentity();showApp()}catch(e){msg.textContent=e.message}};
logoutBtn.onclick=async()=>{try{await api('/api/logout',{method:'POST'})}catch{}localStorage.removeItem('sociaudio_token');location.reload()};
bindViewNavigation();bellBtn.onclick=async()=>{
  view='notifications';
  await loadNotifications(true);
};
newPostBtn.onclick=()=>openNewPost();closePost.onclick=()=>{postDlg.close();resetPostDialog()};
pimg.onchange=async()=>{try{
  let selected=[...pimg.files];
  if(selected.length>1){
    if(selected.some(f=>!f.type.startsWith('image/')))throw Error('Para várias mídias, selecione somente imagens.');
    postGallery=await filesToGallery(selected,6);postImage=postGallery[0]?.data||'';postMediaType='image/jpeg';postMediaName='Galeria de fotos';postMediaSize=selected.reduce((a,f)=>a+f.size,0);pendingPostFile=null;imageChanged=true;showPostMediaPreview();return;
  }
  let m=await fileToPostMedia(selected[0]);clearPostObjectUrl();pendingPostFile=m.file||null;postObjectUrl=pendingPostFile?URL.createObjectURL(pendingPostFile):'';postImage=postObjectUrl||m.data;postGallery=m.type.startsWith('image/')&&m.data?[{data:m.data,name:m.name,size:m.size}]:[];postMediaType=m.type;postMediaName=m.name;postMediaSize=m.size||0;imageChanged=true;showPostMediaPreview()
}catch(e){pimg.value='';toast(e.message,true)}};removePostImage.onclick=()=>{clearPostObjectUrl();pendingPostFile=null;postImage='';postGallery=[];postMediaType='';postMediaName='';postMediaSize=0;imageChanged=true;pimg.value='';showPostMediaPreview()};
function resetPostDialog(){editingPostId=null;imageChanged=false;clearPostObjectUrl();pendingPostFile=null;postImage='';postGallery=[];postMediaType='';postMediaName='';postMediaSize=0;postForm.reset();purl.value='';pimg.accept='image/*,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/flac,.pdf,.doc,.docx,.odt,.rtf,.txt,.md,.xls,.xlsx,.ods,.csv,.ppt,.pptx,.odp,.zip,.rar,.7z,.xml,.json,.yaml,.yml,.rew,.mdat,.trace,.frd,.zma,.cal,.mic,.ssn,.scn,.scene,.show,.preset,.fxp,.fxb,.vstpreset,.ir,.syx,.mid,.midi,.cue,.rider';postMediaLabel.textContent='Adicionar foto, vídeo, áudio ou arquivo';postMediaHelp.textContent='Escolha uma mídia para anexar à publicação.';showPostMediaPreview();postDialogTitle.textContent='Nova publicação';postSubmit.textContent='Publicar'}
function openNewPost(kind=''){resetPostDialog();pimg.multiple=false;if(kind==='video'){pimg.accept='video/mp4,video/webm';postMediaLabel.textContent='Escolher vídeo';postMediaHelp.textContent=`Plano ${me?.plan_label||'Gratuito'}: vídeos MP4/WebM de até ${me?.video_limit_label||'250 MB'}.`;pt.value='Experiência'}else if(kind==='audio'){pimg.accept='audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac,audio/flac';postMediaLabel.textContent='Escolher áudio';postMediaHelp.textContent=`Plano ${me?.plan_label||'Gratuito'}: áudios MP3, WAV, OGG, M4A/AAC ou FLAC de até ${me?.audio_limit_label||'100 MB'}.`;pt.value='Experiência'}else if(kind==='photo'){pimg.accept='image/*';pimg.multiple=true;postMediaLabel.textContent='Escolher até 6 fotos';postMediaHelp.textContent='Selecione uma ou várias imagens para criar uma galeria.'}else if(kind==='file'){pimg.accept='.pdf,.doc,.docx,.odt,.rtf,.txt,.md,.xls,.xlsx,.ods,.csv,.ppt,.pptx,.odp,.zip,.rar,.7z,.xml,.json,.yaml,.yml,.rew,.mdat,.trace,.frd,.zma,.cal,.mic,.ssn,.scn,.scene,.show,.preset,.fxp,.fxb,.vstpreset,.ir,.syx,.mid,.midi,.cue,.rider';postMediaLabel.textContent='Escolher arquivo';postMediaHelp.textContent=`Documentos até ${me?.document_limit_label||'100 MB'}; compactados até ${me?.archive_limit_label||'500 MB'}; arquivos técnicos até ${me?.technical_file_limit_label||'250 MB'}.`}postDlg.showModal()}
function editPost(id){let p=posts.find(x=>x.id===id);if(!p)return toast('Publicação não encontrada.',true);clearPostObjectUrl();pendingPostFile=null;editingPostId=id;imageChanged=false;pt.value=p.type;pc.value=p.category;pti.value=p.title;pb.value=p.body;purl.value=p.link_url||'';postImage=p.media_data||p.image_data||'';postMediaType=p.media_type||(postImage.startsWith('data:image/')?'image/jpeg':'');postMediaName=p.media_name||'';postMediaSize=Number(p.media_size||0);postGallery=(p.media_items||[]).map(x=>({media_url:x.media_url,name:x.media_name,size:x.media_size}));if(!postGallery.length&&postMediaType.startsWith('image/')&&postImage)postGallery=[{media_url:postImage,name:postMediaName,size:postMediaSize}];showPostMediaPreview();postDialogTitle.textContent='Editar publicação';postSubmit.textContent='Salvar alterações';postDlg.showModal()}
postForm.onsubmit=async e=>{e.preventDefault();let btn=postSubmit;btn.disabled=true;btn.textContent=postMediaType.startsWith('audio/')?'Enviando áudio...':postMediaType.startsWith('video/')?'Enviando vídeo...':'Salvando...';try{let uploaded=null;if(pendingPostFile&&postMediaType.startsWith('audio/'))uploaded=await uploadPendingAudio(pendingPostFile);else if(pendingPostFile&&!postMediaType.startsWith('image/')&&!postMediaType.startsWith('video/'))uploaded=await uploadPendingFile(pendingPostFile);let payload={type:pt.value,category:pc.value,title:pti.value,body:pb.value,link_url:purl.value.trim()};if(!editingPostId||imageChanged){payload.media_data=uploaded?.media_data??(postGallery.length>1?'':postImage);payload.media_type=uploaded?.media_type??postMediaType;payload.media_name=uploaded?.media_name??postMediaName;payload.media_size=uploaded?.size??postMediaSize;payload.gallery_images=postGallery}await api(editingPostId?`/api/posts/${editingPostId}/edit`:'/api/posts',{method:'POST',body:JSON.stringify(payload)});let edited=!!editingPostId;postDlg.close();resetPostDialog();toast(edited?'Publicação atualizada.':'Publicação criada.');loadAll()}catch(e){toast(e.message,true)}finally{btn.disabled=false;btn.textContent=editingPostId?'Salvar alterações':'Publicar'}};
async function like(id){await api(`/api/posts/${id}/like`,{method:'POST'});loadAll()} async function bookmark(id){await api(`/api/posts/${id}/bookmark`,{method:'POST'});loadAll()}
function toggleComments(id){openCommentPosts.has(id)?openCommentPosts.delete(id):openCommentPosts.add(id);render()} async function submitComment(id){let el=document.getElementById(`comment-${id}`),body=(el?.value||'').trim();if(!body)return toast('Digite um comentário.',true);try{await api(`/api/posts/${id}/comments`,{method:'POST',body:JSON.stringify({body})});openCommentPosts.add(id);toast('Comentário publicado.');await loadAll()}catch(e){toast(e.message,true)}}


async 
function fileToDataURL(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||''));
    reader.onerror=()=>reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

async function renderCompanies(){
  content.innerHTML=`<section class="companies-page">
    <div class="companies-loading card"><span></span><p>Carregando empresas...</p></div>
  </section>`;

  try{
    const companies=await api('/api/companies');
    const items=Array.isArray(companies)?companies:[];
    const mine=items.find(c=>Number(c.owner_id)===Number(me.id))||null;
    const cities=[...new Set(items.map(x=>x.city).filter(Boolean))].length;
    const verified=items.filter(x=>Number(x.verified)===1).length;

    content.innerHTML=`<section class="companies-page">
      <div class="companies-hero card">
        <div>
          <span class="companies-kicker">EMPRESAS SOCIAUDIO</span>
          <h1>Empresas que movimentam o mercado de áudio</h1>
          <p>Cadastre sua empresa ou encontre locadoras, estúdios, integradores, igrejas, assistências e prestadores de serviço.</p>
          <div class="companies-hero-actions">
            <button class="companies-create-button" onclick="openCompanyForm()">
              ${mine?'Editar minha empresa':'Cadastrar minha empresa'}
            </button>
            ${mine?`<button class="companies-view-button" onclick="openCompanyDetails(${mine.id})">Ver meu perfil empresarial</button>`:''}
          </div>
        </div>

        <div class="companies-summary">
          <div><b>${items.length}</b><span>Empresas</span></div>
          <div><b>${cities}</b><span>Cidades</span></div>
          <div><b>${verified}</b><span>Verificadas</span></div>
        </div>
      </div>

      <div class="companies-toolbar">
        <div>
          <h2>Empresas cadastradas</h2>
          <p>Pesquise por nome, cidade, serviço ou segmento.</p>
        </div>

        <label class="companies-search">
          <span>🔎</span>
          <input id="companySearchInput" type="search" placeholder="Pesquisar empresa">
        </label>
      </div>

      <div id="companiesGrid" class="companies-grid">
        ${items.length?items.map(companyCardMarkup).join(''):`<div class="card companies-empty">
          <div>🏢</div>
          <h2>Nenhuma empresa cadastrada</h2>
          <p>Seja a primeira empresa a criar um perfil profissional.</p>
          <button class="primary" onclick="openCompanyForm()">Cadastrar empresa</button>
        </div>`}
      </div>
    </section>`;

    const input=document.getElementById('companySearchInput');
    if(input){
      input.oninput=()=>{
        const term=input.value.trim().toLowerCase();
        const filtered=items.filter(c=>
          String(c.name||'').toLowerCase().includes(term)||
          String(c.category||'').toLowerCase().includes(term)||
          String(c.city||'').toLowerCase().includes(term)||
          String(c.description||'').toLowerCase().includes(term)||
          String(c.tagline||'').toLowerCase().includes(term)
        );
        const grid=document.getElementById('companiesGrid');
        if(grid){
          grid.innerHTML=filtered.length
            ?filtered.map(companyCardMarkup).join('')
            :`<div class="card companies-empty"><div>🔍</div><h2>Nenhuma empresa encontrada</h2><p>Tente outro nome, cidade ou serviço.</p></div>`;
        }
      };
    }
  }catch(e){
    content.innerHTML=`<div class="card companies-empty"><div>⚠️</div><h2>Não foi possível carregar Empresas</h2><p>${esc(e.message)}</p><button class="secondary" onclick="renderCompanies()">Tentar novamente</button></div>`;
  }
}

function companyCardMarkup(c){
  const verified=Number(c.verified)===1;
  const companyName=esc(c.name||'Empresa');
  const description=esc(c.tagline||c.description||'Empresa cadastrada na Rede Sociaudio.');
  const location=c.city||'Localização não informada';

  return `<article class="card company-card">
    <div class="company-card-cover" style="${c.cover?`background-image:url('${esc(c.cover)}')`:''}">
      <div class="company-card-cover-overlay"></div>
    </div>

    <div class="company-card-body">
      <div class="company-logo-wrap">
        ${c.logo?`<img class="company-logo" src="${esc(c.logo)}" alt="">`:`<span class="company-logo fallback">${esc(companyName.slice(0,1).toUpperCase())}</span>`}
        ${verified?'<span class="company-verified" title="Empresa verificada">✓</span>':''}
      </div>

      <div class="company-title-row">
        <div>
          <h2>${companyName}</h2>
          <p>${esc(c.category||'Empresa de áudio')}</p>
        </div>
        ${verified?'<span class="company-verified-label">Verificada</span>':''}
      </div>

      <p class="company-location">📍 ${esc(location)}</p>
      <p class="company-description">${description}</p>
    </div>

    <div class="company-card-footer">
      <button class="secondary" onclick="openCompanyDetails(${Number(c.id)})">Ver empresa</button>
      ${c.whatsapp?`<a class="primary btn" target="_blank" href="https://wa.me/${String(c.whatsapp).replace(/\D/g,'')}">WhatsApp</a>`:''}
    </div>
  </article>`;
}

async function getMyCompany(){
  const items=await api('/api/companies');
  return (Array.isArray(items)?items:[]).find(c=>Number(c.owner_id)===Number(me.id))||null;
}

async function openCompanyForm(){
  try{
    const company=await getMyCompany()||{};
    const details=company.id?await api(`/api/companies/${company.id}`):company;
    const serviceText=(details.services||[]).map(s=>s.title).join('\n');

    content.innerHTML=`<section class="company-form-page">
      <div class="company-form-header card">
        <div>
          <span class="companies-kicker">PERFIL EMPRESARIAL</span>
          <h1>${details.id?'Editar minha empresa':'Cadastrar minha empresa'}</h1>
          <p>Crie uma vitrine profissional com logo, capa, serviços e contatos.</p>
        </div>
        <button class="secondary" onclick="view='companies';renderCompanies()">Voltar para Empresas</button>
      </div>

      <form id="companyForm" class="company-form card">
        <section class="company-form-section">
          <div class="company-form-section-title">
            <span>1</span>
            <div><h2>Identidade da empresa</h2><p>Nome, categoria, logo e capa.</p></div>
          </div>

          <div class="company-media-editor">
            <div id="companyCoverPreview" class="company-cover-preview" style="${details.cover?`background-image:url('${esc(details.cover)}')`:''}">
              <label class="company-cover-button">Alterar capa<input id="companyCoverFile" type="file" accept="image/*" hidden></label>
            </div>

            <div class="company-logo-editor">
              <div id="companyLogoPreview" class="company-logo-preview">
                ${details.logo?`<img src="${esc(details.logo)}" alt="">`:`<span>${esc((details.name||'E').slice(0,1).toUpperCase())}</span>`}
              </div>
              <label class="secondary btn">Selecionar logo<input id="companyLogoFile" type="file" accept="image/*" hidden></label>
              <small>Recomendado: imagem quadrada.</small>
            </div>
          </div>

          <div class="company-form-grid">
            <label>Nome da empresa<input id="companyName" required value="${esc(details.name||'')}"></label>
            <label>Categoria
              <select id="companyCategory">
                ${['Empresa de áudio','Locadora de áudio','Igreja','Estúdio','Integradora audiovisual','Assistência técnica','Fabricante','Produtora de eventos','Escola ou curso','Empresa de iluminação','Outro'].map(x=>`<option ${details.category===x?'selected':''}>${esc(x)}</option>`).join('')}
              </select>
            </label>
            <label class="wide">Slogan<input id="companyTagline" value="${esc(details.tagline||'')}" placeholder="Uma frase curta sobre a empresa"></label>
          </div>
        </section>

        <section class="company-form-section">
          <div class="company-form-section-title">
            <span>2</span>
            <div><h2>Apresentação e serviços</h2><p>Explique o que a empresa faz.</p></div>
          </div>

          <label>Descrição da empresa<textarea id="companyDescription" rows="6">${esc(details.description||'')}</textarea></label>
          <label>Serviços oferecidos<textarea id="companyServices" rows="5" placeholder="Um serviço por linha">${esc(serviceText)}</textarea></label>
        </section>

        <section class="company-form-section">
          <div class="company-form-section-title">
            <span>3</span>
            <div><h2>Localização e atendimento</h2></div>
          </div>

          <div class="company-form-grid">
            <label>Cidade<input id="companyCity" value="${esc(details.city||'')}"></label>
            <label>Região de atendimento<input id="companyServiceRegion" value="${esc(details.service_region||'')}"></label>
          </div>
        </section>

        <section class="company-form-section">
          <div class="company-form-section-title">
            <span>4</span>
            <div><h2>Contatos</h2></div>
          </div>

          <div class="company-form-grid">
            <label>WhatsApp<input id="companyWhatsapp" value="${esc(details.whatsapp||'')}"></label>
            <label>Telefone<input id="companyPhone" value="${esc(details.phone||'')}"></label>
            <label>E-mail<input id="companyEmail" type="email" value="${esc(details.email||'')}"></label>
            <label>Site<input id="companyWebsite" value="${esc(details.website||'')}"></label>
            <label>Instagram<input id="companyInstagram" value="${esc(details.instagram||'')}"></label>
          </div>
        </section>

        <div class="company-form-actions">
          <button type="button" class="secondary" onclick="view='companies';renderCompanies()">Cancelar</button>
          <button type="submit" class="primary">${details.id?'Salvar alterações':'Cadastrar empresa'}</button>
        </div>
      </form>
    </section>`;

    let logoData=details.logo||'';
    let coverData=details.cover||'';

    companyLogoFile.onchange=async()=>{
      const file=companyLogoFile.files[0];
      if(!file)return;
      logoData=await fileToDataURL(file);
      companyLogoPreview.innerHTML=`<img src="${logoData}" alt="">`;
    };

    companyCoverFile.onchange=async()=>{
      const file=companyCoverFile.files[0];
      if(!file)return;
      coverData=await fileToDataURL(file);
      companyCoverPreview.style.backgroundImage=`url('${coverData}')`;
    };

    companyForm.onsubmit=async event=>{
      event.preventDefault();
      const button=companyForm.querySelector('button[type="submit"]');
      try{
        button.disabled=true;
        button.textContent='Salvando...';

        const services=companyServices.value
          .split(/\n/)
          .map(x=>x.trim())
          .filter(Boolean)
          .map(title=>({title,description:'',icon:'🎚️'}));

        const result=await api('/api/companies',{
          method:'POST',
          body:JSON.stringify({
            name:companyName.value,
            category:companyCategory.value,
            tagline:companyTagline.value,
            description:companyDescription.value,
            city:companyCity.value,
            service_region:companyServiceRegion.value,
            whatsapp:companyWhatsapp.value,
            phone:companyPhone.value,
            email:companyEmail.value,
            website:companyWebsite.value,
            instagram:companyInstagram.value,
            logo:logoData,
            cover:coverData,
            services,
            team:details.team||[],
            projects:details.projects||[]
          })
        });

        toast(details.id?'Empresa atualizada.':'Empresa cadastrada.');
        openCompanyDetails(result.id);
      }catch(e){
        toast(e.message,true);
        button.disabled=false;
        button.textContent=details.id?'Salvar alterações':'Cadastrar empresa';
      }
    };
  }catch(e){
    toast(e.message,true);
  }
}

async function openCompanyDetails(id){
  try{
    const c=await api(`/api/companies/${id}`);
    const services=Array.isArray(c.services)?c.services:[];

    content.innerHTML=`<section class="company-profile-page">
      <article class="company-profile-hero card">
        <div class="company-profile-cover" style="${c.cover?`background-image:url('${esc(c.cover)}')`:''}"></div>
        <div class="company-profile-main">
          <div class="company-profile-logo">
            ${c.logo?`<img src="${esc(c.logo)}" alt="">`:`<span>${esc((c.name||'E').slice(0,1).toUpperCase())}</span>`}
          </div>

          <div class="company-profile-info">
            <h1>${esc(c.name)}</h1>
            <h2>${esc(c.category||'Empresa de áudio')}</h2>
            <p>${esc(c.tagline||'')}</p>
            <p>📍 ${esc(c.city||'Localização não informada')}</p>
          </div>

          <div class="company-profile-actions">
            ${c.can_edit?`<button class="secondary" onclick="openCompanyForm()">Editar empresa</button>`:''}
            ${c.whatsapp?`<a class="primary btn" target="_blank" href="https://wa.me/${String(c.whatsapp).replace(/\D/g,'')}">Falar no WhatsApp</a>`:''}
          </div>
        </div>
      </article>

      <div class="company-profile-columns">
        <main>
          <section class="card company-profile-section">
            <h2>Sobre a empresa</h2>
            <p>${esc(c.description||'Esta empresa ainda não adicionou uma apresentação.')}</p>
          </section>

          <section class="card company-profile-section">
            <h2>Serviços oferecidos</h2>
            <div class="company-services-list">
              ${services.length?services.map(s=>`<article><span>${esc(s.icon||'🎚️')}</span><div><b>${esc(s.title)}</b>${s.description?`<p>${esc(s.description)}</p>`:''}</div></article>`).join(''):'<p>Nenhum serviço cadastrado.</p>'}
            </div>
          </section>
        </main>

        <aside>
          <section class="card company-profile-contact">
            <h2>Contato</h2>
            ${c.whatsapp?`<div><b>WhatsApp</b><span>${esc(c.whatsapp)}</span></div>`:''}
            ${c.phone?`<div><b>Telefone</b><span>${esc(c.phone)}</span></div>`:''}
            ${c.email?`<div><b>E-mail</b><span>${esc(c.email)}</span></div>`:''}
            ${c.website?`<a target="_blank" href="${esc(safeLink(c.website))}"><b>Site</b><span>${esc(c.website)}</span></a>`:''}
            ${c.instagram?`<a target="_blank" href="${esc(safeLink(c.instagram.startsWith('http')?c.instagram:'https://instagram.com/'+c.instagram.replace('@','')))}"><b>Instagram</b><span>${esc(c.instagram)}</span></a>`:''}
            ${c.service_region?`<div><b>Região atendida</b><span>${esc(c.service_region)}</span></div>`:''}
          </section>
        </aside>
      </div>
    </section>`;
  }catch(e){
    toast(e.message,true);
  }
}

function renderCommunities(){
  const items=Array.isArray(communities)?communities:[];
  const joinedCount=items.filter(c=>Number(c.joined)===1||c.joined===true).length;
  const totalMembers=items.reduce((sum,c)=>sum+Number(c.members||0),0);

  content.innerHTML=`<section class="communities-page">
    <div class="communities-hero card">
      <div>
        <span class="communities-kicker">COMUNIDADES SOCIAUDIO</span>
        <h1>Encontre sua comunidade no mercado de áudio</h1>
        <p>Participe de grupos de técnicos, operadores, empresas, igrejas, produtores e profissionais especializados.</p>
      </div>
      <div class="communities-summary">
        <div><b>${items.length}</b><span>Comunidades</span></div>
        <div><b>${joinedCount}</b><span>Participando</span></div>
        <div><b>${totalMembers}</b><span>Membros</span></div>
      </div>
    </div>

    <div class="communities-toolbar">
      <div>
        <h2>Comunidades disponíveis</h2>
        <p>Escolha uma comunidade para participar ou sair.</p>
      </div>
      <label class="communities-search">
        <span>🔎</span>
        <input id="communitySearchInput" type="search" placeholder="Pesquisar comunidade ou categoria">
      </label>
    </div>

    <div id="communitiesGrid" class="communities-grid">
      ${items.length?items.map(communityCardMarkup).join(''):`<div class="card communities-empty">
        <div>👥</div>
        <h2>Nenhuma comunidade disponível</h2>
        <p>As comunidades cadastradas aparecerão aqui.</p>
      </div>`}
    </div>
  </section>`;

  const input=document.getElementById('communitySearchInput');
  if(input){
    input.oninput=()=>{
      const term=input.value.trim().toLowerCase();
      const filtered=items.filter(c=>
        String(c.name||'').toLowerCase().includes(term)||
        String(c.category||'').toLowerCase().includes(term)||
        String(c.description||'').toLowerCase().includes(term)
      );
      const grid=document.getElementById('communitiesGrid');
      if(grid){
        grid.innerHTML=filtered.length
          ?filtered.map(communityCardMarkup).join('')
          :`<div class="card communities-empty"><div>🔍</div><h2>Nenhum resultado</h2><p>Tente pesquisar outro nome ou categoria.</p></div>`;
      }
    };
  }
}

function communityCardMarkup(c){
  const joined=Number(c.joined)===1||c.joined===true;
  const members=Number(c.members||0);
  const iconValue=esc(c.icon||'🎚️');

  return `<article class="card community-card ${joined?'joined':''}">
    <div class="community-card-top">
      <div class="community-icon">${iconValue}</div>
      ${joined?'<span class="community-joined-badge">Participando</span>':''}
    </div>

    <div class="community-card-body">
      <span class="community-category">${esc(c.category||'Geral')}</span>
      <h2>${esc(c.name||'Comunidade')}</h2>
      <p>${esc(c.description||'Comunidade profissional da Rede Sociaudio.')}</p>
    </div>

    <div class="community-card-footer">
      <span><b>${members}</b> membro${members===1?'':'s'}</span>
      <button
        id="joinCommunity-${Number(c.id)}"
        class="${joined?'secondary':'primary'}"
        onclick="joinCommunity(${Number(c.id)})">
        ${joined?'Sair da comunidade':'Participar'}
      </button>
    </div>
  </article>`;
}

async function joinCommunity(id){
  const btn=document.querySelector(`#joinCommunity-${id}`);
  try{
    if(btn){btn.disabled=true;btn.textContent='Aguarde...'}
    const result=await api(`/api/communities/${id}/join`,{method:'POST',body:'{}'});
    const community=communities.find(c=>Number(c.id)===Number(id));
    if(community){
      community.joined=!!result.joined;
      community.members=Number(result.members||0);
    }
    renderCommunities();
    toast(result.joined?'Você entrou na comunidade.':'Você saiu da comunidade.');
  }catch(e){
    toast(e.message,true);
    if(btn)btn.disabled=false;
  }
} async function followUser(id){await api(`/api/users/${id}/follow`,{method:'POST'});loadAll()}
async function featurePost(id){await api(`/api/admin/posts/${id}/feature`,{method:'POST'});loadAll()} async function removePost(id){if(!confirm('Deseja realmente excluir esta publicação? Esta ação não poderá ser desfeita.'))return;try{await api(`/api/posts/${id}`,{method:'DELETE'});toast('Publicação excluída.');await loadAll()}catch(e){toast(e.message,true)}}
function postGalleryCard(p){let items=(p.media_items||[]).filter(x=>x.media_type?.startsWith('image/'));if(!items.length)return'';let cls='count-'+Math.min(items.length,4);return `<div class="post-gallery ${cls}">${items.slice(0,6).map((x,i)=>`<button onclick="openImageViewer('${esc(x.media_url)}','${esc(p.title)}')"><img src="${esc(x.media_url)}" alt="Foto da publicação">${i===5&&items.length>6?`<span>+${items.length-6}</span>`:''}</button>`).join('')}</div>`}
function safeLink(url){try{let u=new URL(url);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}} function linkCard(url){let href=safeLink(url);if(!href)return '';let host='';try{host=new URL(href).hostname.replace(/^www\./,'')}catch{}return `<a class="post-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer"><span class="link-icon">${icon('link')}</span><span><b>${esc(host||'Abrir link')}</b><small>${esc(href)}</small></span><strong>Abrir</strong></a>`} function fileCard(md,mt,name,size){let ext=fileExt(name),pdf=ext==='.pdf';return `<div class="post-file-card"><span>${icon(ext==='.pdf'?'file':'file')}</span><div><b>${esc(name||'Arquivo')}</b><small>${esc(ext.replace('.','').toUpperCase()||'ARQUIVO')} · ${humanSize(Number(size||0))}</small></div>${pdf?`<a class="secondary btn" href="${esc(md)}" target="_blank" rel="noopener">Visualizar</a>`:''}<a class="primary btn" href="${esc(md)}" download="${esc(name||'arquivo')}">Baixar</a></div>`} function commentsBlock(p){if(!openCommentPosts.has(p.id))return '';return `<section class="comments-panel"><div class="comment-compose">${avatar(me)}<textarea id="comment-${p.id}" placeholder="Escreva um comentário..."></textarea><button class="primary" onclick="submitComment(${p.id})">Comentar</button></div>${p.answers.length?p.answers.map(a=>`<div class="answer"><b>${esc(a.name)}${a.is_admin?' ✓':''}</b><span class="meta"> ${esc(a.role)} · ${new Date(a.created_at).toLocaleString('pt-BR')}</span><p>${esc(a.body)}</p></div>`).join(''):'<p class="no-comments">Ainda não há comentários. Seja o primeiro a comentar.</p>'}</section>`} function postCard(p){let canEdit=p.user_id===me.id||me.is_admin;let edited=p.updated_at?` · <span class="edited">Editado em ${new Date(p.updated_at).toLocaleString('pt-BR')}</span>`:'';return `<article class="card post ${p.is_featured?'featured':''}"><div class="post-author">${avatar(p)}<div><button class="link-name" onclick="openProfile(${p.user_id})"><b>${esc(p.name)}${p.is_admin?' ✓':''}</b></button><div class="meta">${esc(p.role)} · ${new Date(p.created_at).toLocaleString('pt-BR')}${edited}</div></div>${p.is_featured?'<span class="featured-label">DESTAQUE</span>':''}</div><h2>${esc(p.title)}</h2><div><span class="tag">${esc(p.type)}</span><span class="tag muted">${esc(p.category)}</span></div><p class="post-body">${esc(p.body)}</p>${linkCard(p.link_url||'')}${postGalleryCard(p)||(()=>{let md=p.media_data||p.image_data||'',mt=p.media_type||(md.startsWith('data:image/')?'image/jpeg':'');if(!md)return '';return mt.startsWith('video/')?`<video class="post-video" src="${esc(md)}" controls preload="metadata" playsinline></video>`:mt.startsWith('audio/')?`<div class="post-audio-wrap"><div class="post-audio-head">${icon('audio')}<span><b>${esc(p.media_name||'Áudio')}</b><small>Publicação de áudio</small></span></div><audio class="post-audio" src="${esc(md)}" controls preload="metadata"></audio></div>`:mt.startsWith('image/')?`<img class="post-image" src="${md}" onclick="openImageViewer(this.src,'${esc(p.title)}')" alt="Mídia da publicação">`:fileCard(md,mt,p.media_name,p.media_size)})()}<div class="engagement-summary"><span>${p.likes} curtida(s)</span><span>${p.comments} comentário(s)</span></div><div class="actions"><button class="${p.liked?'active':''}" onclick="like(${p.id})">${icon('like')}<span>Curtir</span></button><button class="${openCommentPosts.has(p.id)?'active':''}" onclick="toggleComments(${p.id})">${icon('comment')}<span>Comentários</span></button><button onclick="navigator.clipboard?.writeText(location.href);toast('Link copiado.')">${icon('share')}<span>Compartilhar</span></button><button class="${p.bookmarked?'active':''}" onclick="bookmark(${p.id})">${icon('saved')}<span>${p.bookmarked?'Salvo':'Salvar'}</span></button>${canEdit?`<button onclick="editPost(${p.id})">${icon('edit')}<span>Editar</span></button><button class="danger-action" onclick="removePost(${p.id})">${icon('trash')}<span>Excluir</span></button>`:''}${me.is_admin?`<button class="post-more" onclick="featurePost(${p.id})" title="Destacar">${icon('more')}</button>`:''}</div>${commentsBlock(p)}</article>`}

let globalSearchTimer=null;

function normalizeSearchText(value){
  return String(value||'')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .trim();
}

function globalUserResult(user){
  return `<article class="search-result-card search-person">
    <button class="search-result-main" onclick="openProfile(${user.id})">
      ${avatar(user)}
      <span>
        <b>${esc(user.name)}</b>
        <small>${esc(user.professional_title||user.headline||user.role||'Usuário da Rede Sociaudio')}</small>
        <em>${esc(user.city||'Localização não informada')}</em>
      </span>
    </button>
    <div class="search-result-actions">
      <button class="primary" onclick="openProfile(${user.id})">Ver perfil</button>
      ${user.id!==me.id?`<button class="secondary" onclick="followUser(${user.id})">${user.is_following?'Deixar de seguir':'Seguir'}</button>`:''}
    </div>
  </article>`;
}

function globalPostResult(post){
  return `<article class="search-result-card">
    <button class="search-result-main" onclick="view='feed';search.value='${esc(post.title)}';renderFeed()">
      ${avatar({name:post.name||'U',avatar:post.avatar||''})}
      <span>
        <b>${esc(post.title)}</b>
        <small>Publicação de ${esc(post.name||'Usuário')}</small>
        <em>${esc(post.category||'Geral')}</em>
      </span>
    </button>
  </article>`;
}

function globalCommunityResult(community){
  return `<article class="search-result-card">
    <button class="search-result-main" onclick="view='communities';renderCommunities()">
      <span class="search-result-icon">${esc(community.icon||'🎚️')}</span>
      <span>
        <b>${esc(community.name)}</b>
        <small>${esc(community.description||'Comunidade da Rede Sociaudio')}</small>
        <em>${Number(community.members||0)} membro(s)</em>
      </span>
    </button>
  </article>`;
}

function globalCompanyResult(company){
  return `<article class="search-result-card">
    <button class="search-result-main" onclick="openCompany(${company.id})">
      ${company.logo?`<img class="avatar" src="${esc(company.logo)}" alt="">`:`<span class="search-result-icon">${esc((company.name||'E').slice(0,1))}</span>`}
      <span>
        <b>${esc(company.name)}</b>
        <small>${esc(company.category||'Empresa')}</small>
        <em>${esc(company.city||'Localização não informada')}</em>
      </span>
    </button>
    <div class="search-result-actions"><button class="primary" onclick="openCompany(${company.id})">Ver empresa</button></div>
  </article>`;
}

async function performGlobalSearch(force=false){
  const query=String(search?.value||'').trim();
  if(!query){
    if(force){view='feed';render()}
    return;
  }
  if(query.length<2){
    content.innerHTML='<div class="card empty">Digite pelo menos 2 letras para pesquisar.</div>';
    return;
  }

  view='search';
  const normalized=normalizeSearchText(query);
  content.innerHTML=`<div class="page-title"><h1>Resultados da pesquisa</h1><p>Buscando por “${esc(query)}”...</p></div><div class="card search-loading">Pesquisando usuários, publicações, comunidades e empresas...</div>`;

  let companies=[];
  try{companies=await api('/api/companies')}catch{}

  const foundUsers=(users||[]).filter(u=>
    normalizeSearchText([u.name,u.role,u.professional_title,u.headline,u.company,u.city,u.specialties].join(' ')).includes(normalized)
  );

  const foundPosts=(posts||[]).filter(p=>
    normalizeSearchText([p.title,p.body,p.category,p.name].join(' ')).includes(normalized)
  ).slice(0,20);

  const foundCommunities=(communities||[]).filter(c=>
    normalizeSearchText([c.name,c.description,c.category].join(' ')).includes(normalized)
  );

  const foundCompanies=(companies||[]).filter(c=>
    normalizeSearchText([c.name,c.category,c.tagline,c.description,c.city].join(' ')).includes(normalized)
  );

  const total=foundUsers.length+foundPosts.length+foundCommunities.length+foundCompanies.length;

  content.innerHTML=`<div class="page-title search-page-title">
    <div><h1>Resultados da pesquisa</h1><p>${total} resultado(s) para “${esc(query)}”.</p></div>
    <button class="secondary" onclick="search.value='';view='feed';render()">Limpar pesquisa</button>
  </div>
  ${foundUsers.length?`<section class="search-section"><h2>Profissionais e usuários <span>${foundUsers.length}</span></h2><div class="search-results">${foundUsers.map(globalUserResult).join('')}</div></section>`:''}
  ${foundCompanies.length?`<section class="search-section"><h2>Empresas <span>${foundCompanies.length}</span></h2><div class="search-results">${foundCompanies.map(globalCompanyResult).join('')}</div></section>`:''}
  ${foundCommunities.length?`<section class="search-section"><h2>Comunidades <span>${foundCommunities.length}</span></h2><div class="search-results">${foundCommunities.map(globalCommunityResult).join('')}</div></section>`:''}
  ${foundPosts.length?`<section class="search-section"><h2>Publicações <span>${foundPosts.length}</span></h2><div class="search-results">${foundPosts.map(globalPostResult).join('')}</div></section>`:''}
  ${!total?`<div class="card empty search-empty"><h2>Nenhum resultado encontrado</h2><p>Confira a escrita do nome. Se a conta foi apagada após um deploy no Render gratuito, ela precisará ser cadastrada novamente.</p></div>`:''}`;

  hydrateIcons(content);
}

function scheduleGlobalSearch(){
  clearTimeout(globalSearchTimer);
  const query=String(search?.value||'').trim();
  if(!query){
    if(view==='search'){view='feed';render()}
    return;
  }
  globalSearchTimer=setTimeout(()=>performGlobalSearch(),300);
}



(function hideNotificationCountersInitially(){
  const oldCounter=document.getElementById('bellCount');
  if(oldCounter){
    oldCounter.textContent='';
    oldCounter.hidden=true;
    oldCounter.style.display='none';
  }
  document.querySelectorAll('#notificationBadge,.notification-badge').forEach(b=>{
    b.textContent='0';
    b.style.display='none';
  });
})();

let notificationPoll=null;
let notificationItems=[];
let notificationUnread=0;

function notificationIcon(type){
  return ({follow:'👤',like:'❤️',comment:'💬',message:'✉️',community:'👥',quote:'💼',system:'🔔'})[type]||'🔔';
}

function relativeTime(value){
  const d=new Date(value), diff=Math.max(0,Date.now()-d.getTime());
  const m=Math.floor(diff/60000);
  if(m<1)return 'agora';
  if(m<60)return `há ${m} min`;
  const h=Math.floor(m/60);
  if(h<24)return `há ${h} h`;
  const days=Math.floor(h/24);
  if(days<7)return `há ${days} dia${days>1?'s':''}`;
  return d.toLocaleDateString('pt-BR');
}

async function loadNotifications(renderPage=false){
  if(renderPage&&view==='notifications'){
    content.innerHTML=`<section class="notifications-page">
      <div class="notifications-loading card">
        <span></span>
        <p>Carregando notificações...</p>
      </div>
    </section>`;
  }

  try{
    const data=await Promise.race([
      api('/api/notifications'),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('O carregamento das notificações demorou demais.')),12000))
    ]);

    const items=Array.isArray(data?.items)?data.items:[];
    notificationItems=items.map(n=>({
      ...n,
      title:n.title||safeNotificationTitle(n.type),
      message:n.message||n.description||'Nova atividade na sua conta.',
      is_read:Number(n.is_read||0),
      actor_avatar:n.actor_avatar||''
    }));

    notificationUnread=Number(data?.unread||notificationItems.filter(n=>!n.is_read).length);
    updateNotificationBadge();

    if(renderPage&&view==='notifications'){
      renderNotificationsSafe(false);
    }
  }catch(error){
    console.error('Erro ao carregar notificações:',error);
    notificationItems=[];
    notificationUnread=0;
    updateNotificationBadge();

    if(renderPage&&view==='notifications'){
      content.innerHTML=`<section class="notifications-page">
        <div class="card notifications-error">
          <div>⚠️</div>
          <h2>Não foi possível carregar as notificações</h2>
          <p>${esc(error.message||'Tente novamente.')}</p>
          <button class="secondary" onclick="loadNotifications(true)">Tentar novamente</button>
        </div>
      </section>`;
    }
  }
}

function safeNotificationTitle(type){
  return ({
    follow:'Novo seguidor',
    like:'Nova curtida',
    comment:'Novo comentário',
    message:'Nova mensagem',
    community:'Comunidade',
    quote:'Orçamento',
    review:'Nova avaliação',
    job_apply:'Nova candidatura',
    job_status:'Atualização de candidatura'
  })[type]||'Nova notificação';
}

function safeNotificationIcon(type){
  return ({
    follow:'👤',
    like:'👍',
    comment:'💬',
    message:'✉️',
    community:'👥',
    quote:'💼',
    review:'⭐',
    job_apply:'📄',
    job_status:'📌'
  })[type]||'🔔';
}

function safeRelativeTime(value){
  try{
    if(typeof relativeTime==='function')return relativeTime(value);
    return new Date(value).toLocaleString('pt-BR');
  }catch{
    return '';
  }
}

function renderNotificationsSafe(unreadOnly=false){
  const list=unreadOnly?notificationItems.filter(n=>!Number(n.is_read)):notificationItems;
  const unread=notificationItems.filter(n=>!Number(n.is_read)).length;

  content.innerHTML=`<section class="notifications-page">
    <div class="page-title notification-title">
      <div>
        <h1>${unreadOnly?'Notificações não lidas':'Notificações'}</h1>
        <p>${unreadOnly?`${unread} pendente(s).`:'Acompanhe as atividades da sua conta.'}</p>
      </div>
      ${notificationItems.length?`<button class="secondary" onclick="markAllNotificationsRead()" ${!unread?'disabled':''}>Marcar todas como lidas</button>`:''}
    </div>

    <div class="notification-filter-row">
      <button class="${!unreadOnly?'active':''}" onclick="renderNotificationsSafe(false)">
        Todas <span>${notificationItems.length}</span>
      </button>
      <button class="${unreadOnly?'active':''}" onclick="renderNotificationsSafe(true)">
        Não lidas <span>${unread}</span>
      </button>
    </div>

    <div class="notification-list">
      ${list.length
        ?list.map(safeNotificationCard).join('')
        :`<div class="card empty notification-empty">
            <div>${unreadOnly?'✅':'🔔'}</div>
            <h2>${unreadOnly?'Tudo em dia':'Nenhuma notificação'}</h2>
            <p>${unreadOnly?'Você não tem notificações não lidas.':'As novas atividades aparecerão aqui.'}</p>
          </div>`}
    </div>
  </section>`;
}

function safeNotificationCard(n){
  const title=n.title||safeNotificationTitle(n.type);
  const message=n.message||'Nova atividade na sua conta.';
  const initial=esc((n.actor_name||'S').slice(0,1).toUpperCase());

  return `<article class="notification-card ${Number(n.is_read)?'read':'unread'}" onclick="openNotification(${Number(n.id)})">
    <div class="notification-avatar-wrap">
      ${n.actor_avatar
        ?`<img class="notification-avatar" src="${esc(n.actor_avatar)}" alt="">`
        :`<span class="notification-avatar fallback">${initial}</span>`}
      <span class="notification-type-icon">${safeNotificationIcon(n.type)}</span>
    </div>

    <div class="notification-content">
      <div class="notification-card-head">
        <b>${esc(title)}</b>
        ${!Number(n.is_read)?'<span class="notification-dot"></span>':''}
      </div>
      <p>${esc(message)}</p>
      <small>${safeRelativeTime(n.created_at)}</small>
    </div>

    <button class="notification-delete" aria-label="Excluir notificação" onclick="deleteNotification(${Number(n.id)},event)">×</button>
  </article>`;
}

function updateNotificationBadge(){
  notificationUnread=Math.max(0,Number(notificationUnread||0));
  const text=notificationUnread>99?'99+':String(notificationUnread);
  const visible=notificationUnread>0;

  document.querySelectorAll('.notification-badge').forEach(badge=>{
    badge.textContent=text;
    badge.hidden=!visible;
    badge.style.display=visible?'grid':'none';
  });

  const headerCounter=document.getElementById('bellCount');
  if(headerCounter){
    headerCounter.textContent=visible?text:'';
    headerCounter.hidden=!visible;
    headerCounter.style.display=visible?'grid':'none';
  }

  const bell=document.getElementById('bellBtn');
  if(bell){
    bell.classList.toggle('has-unread',visible);
    bell.setAttribute('aria-label',visible
      ?`${notificationUnread} notificação(ões) não lida(s)`
      :'Nenhuma notificação não lida');
  }
}

async function markNotificationRead(id){
  const result=await api(`/api/notifications/${id}/read`,{method:'POST',body:'{}'});
  const item=notificationItems.find(n=>Number(n.id)===Number(id));
  if(item)item.is_read=1;
  notificationUnread=Number(result.unread||0);
  updateNotificationBadge();
}

async function markAllNotificationsRead(){
  const button=document.querySelector('.notification-title button');
  try{
    if(button){
      button.disabled=true;
      button.textContent='Marcando...';
    }
    const result=await api('/api/notifications/read-all',{method:'POST',body:'{}'});
    notificationItems.forEach(n=>n.is_read=1);
    notificationUnread=Number(result.unread||0);
    updateNotificationBadge();
    toast('Todas as notificações foram marcadas como lidas.');
    renderNotifications();
  }catch(e){
    toast(e.message,true);
    if(button){
      button.disabled=false;
      button.textContent='Marcar todas como lidas';
    }
  }
}

async function deleteNotification(id,event){
  if(event)event.stopPropagation();
  try{
    await api(`/api/notifications/${id}/delete`,{method:'POST',body:'{}'});
    notificationItems=notificationItems.filter(n=>Number(n.id)!==Number(id));
    notificationUnread=notificationItems.filter(n=>!n.is_read).length;
    updateNotificationBadge();
    renderNotifications();
  }catch(e){toast(e.message,true)}
}

async function openNotification(id){
  const n=notificationItems.find(x=>Number(x.id)===Number(id));
  if(!n)return;
  if(!n.is_read)await markNotificationRead(id);

  if(n.target_type==='profile'&&n.target_id)return openProfile(n.target_id);
  if(n.target_type==='message'){
    view='messages';render();
    return;
  }
  if(n.target_type==='quote'){
    view='requests';render();
    return;
  }
  if(n.target_type==='community'){
    view='communities';renderCommunities();
    return;
  }
  if(n.target_type==='post'){
    view='feed';renderFeed();
    const card=document.querySelector(`[data-post-id="${n.target_id}"]`);
    if(card)card.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
}

function renderNotifications(){return renderNotificationsSafe(false)}
function renderUnreadNotifications(){return renderNotificationsSafe(true)}

function notificationCard(n){return safeNotificationCard(n)}

function renderAbout(){
  content.innerHTML=`<section class="about-page">
    <article class="about-hero card">
      <span class="about-kicker">REDE SOCIAUDIO · BETA 3.0</span>
      <h1>O marketplace inteligente do mercado de áudio</h1>
      <p>Uma plataforma criada para conectar técnicos, engenheiros, empresas, igrejas, produtores e profissionais do áudio em um só lugar.</p>
      <div class="about-actions">
        <button class="primary" onclick="view='professionals';render()">Encontrar profissionais</button>
        <button class="secondary" onclick="view='profile';render()">Completar meu perfil</button>
      </div>
    </article>

    <div class="about-grid">
      <article class="card about-feature">
        <div>🎚️</div>
        <h2>Profissionais especializados</h2>
        <p>Encontre técnicos por cidade, especialidade, experiência, equipamentos e disponibilidade.</p>
      </article>
      <article class="card about-feature">
        <div>📅</div>
        <h2>Agenda e contratação</h2>
        <p>Consulte datas disponíveis, solicite orçamento e converse diretamente com o profissional.</p>
      </article>
      <article class="card about-feature">
        <div>⭐</div>
        <h2>Reputação e portfólio</h2>
        <p>Veja avaliações, trabalhos realizados, certificações, equipamentos e vídeos de apresentação.</p>
      </article>
      <article class="card about-feature">
        <div>🤖</div>
        <h2>Inteligência para o áudio</h2>
        <p>A Beta 3.0 prepara a plataforma para recomendações inteligentes e assistência técnica especializada.</p>
      </article>
    </div>

    <article class="card about-roadmap">
      <h2>O que vem na Beta 3.0</h2>
      <div class="roadmap-list">
        <div><b>1</b><span><strong>Cadastro técnico avançado</strong><small>Equipamentos, especialidades, valores e experiência.</small></span></div>
        <div><b>2</b><span><strong>Busca inteligente</strong><small>Pesquisa por cidade, equipamento, especialidade e disponibilidade.</small></span></div>
        <div><b>3</b><span><strong>Empresas</strong><small>Perfis de locadoras, igrejas, estúdios, integradores e assistências.</small></span></div>
        <div><b>4</b><span><strong>IA Sociaudio</strong><small>Recomendação de profissionais e suporte técnico especializado.</small></span></div>
      </div>
    </article>
  </section>`;
}

function renderFeed(saved=false){let list=posts.filter(p=>(!saved||p.bookmarked));content.innerHTML=`<section class="card composer"><div class="composer-main">${avatar(me)}<button onclick="openNewPost()">No que você está pensando, ${esc(me.name.split(' ')[0])}?</button></div><div class="composer-tools"><button onclick="openNewPost('video')">${icon('video')}<span>Vídeo</span></button><button onclick="openNewPost('photo')">${icon('photo')}<span>Foto</span></button><button onclick="openNewPost('audio')">${icon('audio')}<span>Áudio</span></button><button onclick="openNewPost('file')">${icon('file')}<span>Arquivo</span></button></div></section><section class="story-strip"><button class="story create-story" onclick="openNewPost()"><span class="story-plus">${icon('plus')}</span><b>Criar story</b></button><div class="story story-console"><span>${avatar(me)}</span><b>Seu conteúdo</b></div><div class="story story-stage"><span>${icon('audio')}</span><b>Dicas de áudio</b></div><div class="story story-mic"><span>${icon('professionals')}</span><b>Profissionais</b></div></section>${list.length?list.map(postCard).join(''):'<div class="empty">Nenhuma publicação encontrada.</div>'}`}
function renderExperts(){content.innerHTML=`<div class="page-title"><h1>Profissionais</h1><p>Encontre especialistas, conheça seus serviços e faça contatos.</p></div><div class="people-grid">${users.map(u=>`<article class="card person"><div class="mini-cover" style="${u.cover?`background-image:url('${u.cover}')`:''}"></div>${avatar(u,'big')}<h3>${esc(u.name)}${u.is_admin?' ✓':''}</h3><b>${esc(u.role)}</b><p class="availability">● ${esc(u.availability||'Disponível para trabalhos')}</p><p class="meta">${icon('location')} ${esc(u.city||'Cidade não informada')}</p><div class="skills">${lines(u.specialties)}</div><div class="follow-stats"><span><b>${u.followers}</b> seguidores</span><span><b>${u.following}</b> seguindo</span></div><button class="secondary" onclick="openProfile(${u.id})">Ver perfil</button>${u.id!==me.id?`<button class="${u.is_following?'secondary':'primary'}" onclick="followUser(${u.id})">${u.is_following?'Deixar de seguir':'Seguir'}</button>`:''}</article>`).join('')}</div>`}


function availabilityStatusLabel(status){
  return ({available:'Disponível',busy:'Indisponível',tentative:'A confirmar'})[status]||'Disponível';
}

function availabilityCard(item,editable=false){
  const date=new Date(`${item.available_date}T12:00:00`);
  const period=[item.start_time,item.end_time].filter(Boolean).join(' às ');
  return `<article class="availability-item ${esc(item.status)}">
    <div class="availability-date">
      <b>${date.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</b>
      <small>${date.toLocaleDateString('pt-BR',{weekday:'short'})}</small>
    </div>
    <div class="availability-info">
      <b>${availabilityStatusLabel(item.status)}</b>
      ${period?`<span>${esc(period)}</span>`:''}
      ${item.note?`<small>${esc(item.note)}</small>`:''}
    </div>
    ${editable?`<button class="availability-delete" onclick="deleteAvailability(${item.id})">×</button>`:''}
  </article>`;
}

async function loadAvailabilityManager(){
  const box=document.getElementById('availabilityManagerList');
  if(!box)return;
  try{
    const items=await api('/api/profile/availability');
    box.innerHTML=items.length?items.map(x=>availabilityCard(x,true)).join(''):'<p class="muted">Nenhuma data cadastrada.</p>';
  }catch(e){
    box.innerHTML='<p class="muted">Não foi possível carregar a agenda.</p>';
  }
}

async function addAvailability(){
  const date=document.getElementById('availabilityDate')?.value||'';
  const start=document.getElementById('availabilityStart')?.value||'';
  const end=document.getElementById('availabilityEnd')?.value||'';
  const status=document.getElementById('availabilityStatus')?.value||'available';
  const note=document.getElementById('availabilityNote')?.value||'';
  try{
    await api('/api/profile/availability',{
      method:'POST',
      body:JSON.stringify({available_date:date,start_time:start,end_time:end,status,note})
    });
    toast('Data adicionada à agenda.');
    await loadAvailabilityManager();
  }catch(e){toast(e.message,true)}
}

async function deleteAvailability(id){
  if(!confirm('Remover esta data da agenda?'))return;
  try{
    await api(`/api/profile/availability/${id}/delete`,{method:'POST',body:'{}'});
    await loadAvailabilityManager();
  }catch(e){toast(e.message,true)}
}

function starRating(value){
  const rating=Math.max(0,Math.min(5,Number(value||0)));
  return `<span class="profile-stars" aria-label="${rating} de 5 estrelas">${[1,2,3,4,5].map(n=>`<span class="${n<=Math.round(rating)?'filled':''}">★</span>`).join('')}</span>`;
}

function profileCompleteness(u){
  const fields=[
    u.avatar,u.cover,u.professional_title,u.headline,u.city,u.state,u.bio,
    u.specialties,u.services,u.equipment,u.experience,u.certifications,
    u.whatsapp,u.portfolio_links,u.portfolio_pdf
  ];
  return Math.round(fields.filter(Boolean).length/fields.length*100);
}

function shareProfessionalProfile(id,name){
  const url=`${location.origin}${location.pathname}#profile-${id}`;
  const data={title:`Perfil de ${name} na Rede Sociaudio`,text:`Conheça o perfil profissional de ${name} na Rede Sociaudio.`,url};
  if(navigator.share){
    navigator.share(data).catch(()=>{});
  }else{
    navigator.clipboard?.writeText(url);
    toast('Link do perfil copiado.');
  }
}

function profileReviewCard(r){
  return `<article class="profile-review-card">
    <div class="profile-review-author">
      ${r.reviewer_avatar?`<img src="${esc(r.reviewer_avatar)}" alt="">`:`<span>${esc((r.reviewer_name||'U').slice(0,1).toUpperCase())}</span>`}
      <div><b>${esc(r.reviewer_name)}</b>${starRating(r.rating)}</div>
      <small>${new Date(r.updated_at||r.created_at).toLocaleDateString('pt-BR')}</small>
    </div>
    ${r.comment?`<p>${esc(r.comment)}</p>`:''}
  </article>`;
}

function reviewProfessional(id,current){
  const rating=Number(document.querySelector('input[name="profileRating"]:checked')?.value||0);
  const comment=document.getElementById('profileReviewComment')?.value||'';
  api(`/api/users/${id}/review`,{
    method:'POST',
    body:JSON.stringify({rating,comment})
  }).then(()=>{
    toast(current?'Avaliação atualizada.':'Avaliação publicada.');
    openProfile(id);
  }).catch(e=>toast(e.message,true));
}

async function openProfile(id){
  try{
    let u=await api(`/api/users/${id}/profile`);
    let portfolio=(u.portfolio_links||'').split(/\n/).map(x=>x.trim()).filter(Boolean);
    let history=(u.work_history||'').split(/\n/).map(x=>x.trim()).filter(Boolean);
    let specialties=(u.specialties||'').split(/[,;\n]/).map(x=>x.trim()).filter(Boolean);
    let equipment=(u.equipment||'').split(/[,;\n]/).map(x=>x.trim()).filter(Boolean);
    const completion=profileCompleteness(u);
    const verified=u.verified_badge||u.verification_status==='verified'||u.is_admin;
    const location=[u.city,u.state].filter(Boolean).join(' - ')||'Localização não informada';

    content.innerHTML=`<article class="professional-profile-v2">
      <section class="professional-hero card">
        <div class="professional-cover" style="${u.cover?`background-image:url('${esc(u.cover)}')`:''}">
          <div class="professional-cover-overlay"></div>
        </div>
        <div class="professional-hero-body">
          <div class="professional-avatar-wrap">${avatar(u,'huge')}${verified?'<span class="professional-verified" title="Perfil verificado">✓</span>':''}</div>
          <div class="professional-main-info">
            <div class="professional-name-row">
              <h1>${esc(u.name)}</h1>
              ${verified?'<span class="verified-label">Verificado</span>':''}
            </div>
            <h2>${esc(u.professional_title||u.headline||u.role)}</h2>
            ${u.company?`<p class="professional-company">${esc(u.company)}</p>`:''}
            <p class="professional-location">${icon('location')} ${esc(location)}${Number(u.service_radius_km)>0?` · Atende em um raio de ${Number(u.service_radius_km)} km`:u.service_region?` · ${esc(u.service_region)}`:''}</p>
            <div class="professional-rating-line">${starRating(u.rating_average)} <b>${Number(u.rating_average||0).toFixed(1)}</b><span>${u.review_count||0} avaliação(ões)</span></div>
            <p class="professional-availability">● ${esc(u.availability||'Disponível para trabalhos')}</p>
          </div>
          <div class="professional-actions">
            ${u.id!==me.id?`
              <button class="${u.is_following?'secondary':'primary'}" onclick="followUser(${u.id});openProfile(${u.id})">${u.is_following?'Deixar de seguir':'Seguir'}</button>
              ${Number(u.hire_enabled)!==0?`<button class="primary" onclick="openQuote(${u.id})">Solicitar orçamento</button>`:''}
            `:`<button class="primary" onclick="view='profile';render()">Editar meu perfil</button>`}
            ${u.whatsapp?`<a class="secondary btn" target="_blank" href="https://wa.me/${u.whatsapp.replace(/\D/g,'')}">WhatsApp</a>`:''}
            <button class="secondary" onclick="shareProfessionalProfile(${u.id},'${esc(u.name).replace(/'/g,"\\'")}')">Compartilhar</button>
          </div>
        </div>
      </section>

      ${u.id===me.id?`<section class="profile-completeness card">
        <div><b>Perfil ${completion}% completo</b><span>Perfis completos têm mais chances de receber orçamentos.</span></div>
        <div class="profile-progress"><i style="width:${completion}%"></i></div>
      </section>`:''}

      <section class="professional-stats card">
        <div><b>${u.followers||0}</b><span>Seguidores</span></div>
        <div><b>${u.following||0}</b><span>Seguindo</span></div>
        <div><b>${u.posts||0}</b><span>Publicações</span></div>
        <div><b>${esc(u.completed_projects||'0')}</b><span>Serviços realizados</span></div>
        <div><b>${u.review_count||0}</b><span>Avaliações</span></div>
      </section>

      <div class="professional-profile-columns">
        <main>
          <section class="card professional-section">
            <h2>Sobre o profissional</h2>
            <p>${esc(u.bio||'Este profissional ainda não adicionou uma apresentação.')}</p>
            <div class="professional-detail-grid">
              <div><span>Experiência</span><b>${esc(u.experience||'Não informada')}</b></div>
              <div><span>Tempo de resposta</span><b>${esc(u.response_time||'Até 24 horas')}</b></div>
              <div><span>Valor de referência</span><b>${esc(u.hourly_rate||'Sob consulta')}</b></div>
              <div><span>Idiomas</span><b>${esc(u.languages||'Não informado')}</b></div>
            </div>
          </section>

          <section class="card professional-section">
            <h2>Especialidades</h2>
            <div class="professional-tags">${specialties.length?specialties.map(x=>`<span>${esc(x)}</span>`).join(''):'<p>Nenhuma especialidade cadastrada.</p>'}</div>
          </section>

          <section class="card professional-section">
            <h2>Serviços oferecidos</h2>
            <p>${esc(u.services||'Não informado.')}</p>
          </section>

          <section class="card professional-section">
            <h2>Equipamentos e tecnologias</h2>
            <div class="professional-tags equipment-tags">${equipment.length?equipment.map(x=>`<span>${esc(x)}</span>`).join(''):'<p>Nenhum equipamento cadastrado.</p>'}</div>
          </section>

          <section class="card professional-section">
            <h2>Experiência profissional</h2>
            ${history.length?`<div class="timeline">${history.map(x=>`<div><i></i><p>${esc(x)}</p></div>`).join('')}</div>`:`<p>${esc(u.experience||'Não informada.')}</p>`}
          </section>

          <section class="card professional-section">
            <div class="section-title-row"><h2>Portfólio profissional</h2></div>
            ${(u.portfolio_pdf||u.video_reel)?`<div class="portfolio-featured-links">
              ${u.portfolio_pdf?`<a class="portfolio-featured-card" href="${esc(safeLink(u.portfolio_pdf))}" target="_blank"><b>📄 Portfólio em PDF</b><span>Abrir apresentação profissional</span></a>`:''}
              ${u.video_reel?`<a class="portfolio-featured-card" href="${esc(safeLink(u.video_reel))}" target="_blank"><b>▶ Vídeo de apresentação</b><span>Assistir demonstração</span></a>`:''}
            </div>`:''}
            ${portfolio.length?`<div class="portfolio-grid">${portfolio.map((x,i)=>`<a href="${esc(safeLink(x))}" target="_blank" rel="noopener"><b>Projeto ${i+1}</b><small>${esc(x)}</small></a>`).join('')}</div>`:'<p>Nenhum link de portfólio cadastrado.</p>'}
          </section>

          <section class="card professional-section">
            <h2>Galeria de trabalhos</h2>
            ${galleryMarkup(u.gallery||[])}
          </section>

          <section class="card professional-section">
            <h2>Certificações e formação</h2>
            <p>${esc(u.certifications||'Não informadas.')}</p>
          </section>

          <section class="card professional-section">
            <div class="section-title-row">
              <div><h2>Agenda de disponibilidade</h2><p>Próximas datas informadas pelo profissional.</p></div>
            </div>
            <div class="availability-public-list">
              ${(u.availability_dates||[]).length?(u.availability_dates||[]).map(x=>availabilityCard(x,false)).join(''):'<div class="empty-review"><p>Nenhuma disponibilidade futura cadastrada.</p></div>'}
            </div>
          </section>

          <section class="card professional-section profile-reviews-section">
            <div class="section-title-row">
              <div><h2>Avaliações</h2><p>${u.review_count||0} avaliação(ões) · média ${Number(u.rating_average||0).toFixed(1)}</p></div>
              <div class="rating-summary">${starRating(u.rating_average)}</div>
            </div>

            ${u.id!==me.id?`<form class="profile-review-form" onsubmit="event.preventDefault();reviewProfessional(${u.id},${u.my_review?'true':'false'})">
              <h3>${u.my_review?'Atualize sua avaliação':'Avalie este profissional'}</h3>
              <div class="interactive-stars">
                ${[5,4,3,2,1].map(n=>`<input type="radio" id="rating${n}" name="profileRating" value="${n}" ${Number(u.my_review?.rating)===n?'checked':''}><label for="rating${n}">★</label>`).join('')}
              </div>
              <textarea id="profileReviewComment" maxlength="700" placeholder="Conte como foi sua experiência com este profissional.">${esc(u.my_review?.comment||'')}</textarea>
              <button class="primary">${u.my_review?'Atualizar avaliação':'Publicar avaliação'}</button>
            </form>`:''}

            <div class="profile-reviews-list">
              ${(u.reviews||[]).length?(u.reviews||[]).map(profileReviewCard).join(''):'<div class="empty-review"><p>Este profissional ainda não recebeu avaliações.</p></div>'}
            </div>
          </section>
        </main>

        <aside>
          <section class="card professional-contact-card">
            <h2>Contato profissional</h2>
            ${u.whatsapp?`<a target="_blank" href="https://wa.me/${u.whatsapp.replace(/\D/g,'')}"><b>WhatsApp</b><span>${esc(u.whatsapp)}</span></a>`:''}
            ${u.instagram?`<a target="_blank" href="${esc(safeLink(u.instagram.startsWith('http')?u.instagram:'https://instagram.com/'+u.instagram.replace('@','')))}"><b>Instagram</b><span>${esc(u.instagram)}</span></a>`:''}
            ${u.website?`<a target="_blank" href="${esc(safeLink(u.website))}"><b>Site</b><span>${esc(u.website)}</span></a>`:''}
            ${Number(u.remote_service)?'<div class="remote-service-badge">✓ Atendimento remoto disponível</div>':''}
          </section>
        </aside>
      </div>
    </article>`;
    hydrateIcons(content);
  }catch(e){toast(e.message,true)}
}

function removeProfileAvatarPreview(){
  avatarImage='';
  const wrap=document.querySelector('#profileAvatarWrap');
  if(wrap){
    const initial=((me?.name||'U').slice(0,1).toUpperCase())||'U';
    wrap.innerHTML=`<span id="profileAvatarPreview" class="avatar huge">${esc(initial)}</span>`;
  }
  const input=document.querySelector('#pav');
  if(input)input.value='';
  toast('A foto será removida ao salvar.');
}

function renderProfile(){
  avatarImage=me.avatar||'';coverImage=me.cover||'';profileGalleryNew=[];
  content.innerHTML=`<div class="page-title"><h1>Meu perfil profissional</h1><p>Personalize sua apresentação e mostre seus melhores trabalhos.</p></div>
  <form class="card profile-grid profile-v11" onsubmit="saveProfile(event)">
    <div class="wide cover-editor" id="coverEditor" style="${me.cover?`background-image:url('${me.cover}')`:''}"><label>Alterar capa<input id="pcov" type="file" accept="image/*"></label></div>
    <div class="wide avatar-editor"><div id="profileAvatarWrap">${me.avatar?`<img id="profileAvatarPreview" class="avatar huge" src="${esc(me.avatar)}" alt="Foto do perfil">`:`<span id="profileAvatarPreview" class="avatar huge">${esc((me.name||'U').slice(0,1).toUpperCase())}</span>`}</div><div><label>Alterar foto<input id="pav" type="file" accept="image/*"></label><button type="button" class="text-button" onclick="removeProfileAvatarPreview()">Remover foto</button></div></div>
    <label>Nome<input id="pn" value="${esc(me.name)}" required></label><label>Profissão<input id="pr" value="${esc(me.role)}" required></label>
    <label class="wide">Título profissional<input id="ppt" value="${esc(me.professional_title||'')}" placeholder="Ex.: Engenheiro de Áudio e Especialista em Sistemas"></label><label class="wide">Frase de apresentação<input id="phl" value="${esc(me.headline||'')}"></label><label>Tipo de perfil<select id="ptype"><option value="professional" ${me.profile_type==='professional'?'selected':''}>Profissional</option><option value="company" ${me.profile_type==='company'?'selected':''}>Empresa</option><option value="church" ${me.profile_type==='church'?'selected':''}>Igreja</option><option value="musician" ${me.profile_type==='musician'?'selected':''}>Músico</option><option value="manufacturer" ${me.profile_type==='manufacturer'?'selected':''}>Fabricante</option></select></label><label>Valor de referência<input id="prate" value="${esc(me.hourly_rate||'')}" placeholder="Ex.: R$ 150/h ou Sob consulta"></label><label>Idiomas<input id="plang" value="${esc(me.languages||'')}"></label><label class="check-label"><input id="premote" type="checkbox" ${Number(me.remote_service)?'checked':''}> Atendimento remoto</label><label class="check-label"><input id="phire" type="checkbox" ${Number(me.hire_enabled)!==0?'checked':''}> Exibir botão Contratar</label><label>Empresa<input id="pco" value="${esc(me.company||'')}"></label><label>Cidade<input id="pcy" value="${esc(me.city||'')}"></label>
    <label>Estado<input id="pstate" value="${esc(me.state||'')}" placeholder="Ex.: SC"></label><label>Raio de atendimento (km)<input id="pradius" type="number" min="0" max="2000" value="${Number(me.service_radius_km||0)}"></label>
    <label class="wide">Região de atendimento<input id="preg" value="${esc(me.service_region||'')}"></label><label>Tempo de experiência<input id="pex" value="${esc(me.experience||'')}"></label><label>Projetos concluídos<input id="ppj" value="${esc(me.completed_projects||'')}"></label>
    <label>Tempo de resposta<input id="prt" value="${esc(me.response_time||'')}"></label><label>Disponibilidade<select id="pavl"><option ${me.availability==='Disponível para trabalhos'?'selected':''}>Disponível para trabalhos</option><option ${me.availability==='Disponível apenas para consultorias'?'selected':''}>Disponível apenas para consultorias</option><option ${me.availability==='Indisponível no momento'?'selected':''}>Indisponível no momento</option></select></label>
    <label class="wide">Especialidades<input id="psp" value="${esc(me.specialties||'')}"></label><label class="wide">Serviços oferecidos<textarea id="psv">${esc(me.services||'')}</textarea></label>
    <label class="wide">Equipamentos que domina<input id="peq" value="${esc(me.equipment||'')}"></label><label class="wide">Histórico profissional<textarea id="pwh">${esc(me.work_history||'')}</textarea></label>
    <label class="wide">Links do portfólio<textarea id="ppl">${esc(me.portfolio_links||'')}</textarea></label>
    <label class="wide">Link do portfólio em PDF<input id="ppdf" value="${esc(me.portfolio_pdf||'')}" placeholder="Cole o link do Google Drive, site ou PDF"></label>
    <label class="wide">Link do vídeo de apresentação<input id="preel" value="${esc(me.video_reel||'')}" placeholder="YouTube, Vimeo ou outro link"></label>
    <label class="wide">Certificações<textarea id="pce">${esc(me.certifications||'')}</textarea></label>
    <section class="profile-agenda-manager wide">
      <div class="section-title-row"><div><h3>Agenda profissional</h3><p>Informe datas em que você está disponível ou ocupado.</p></div></div>
      <div class="agenda-form-grid">
        <label>Data<input id="availabilityDate" type="date"></label>
        <label>Início<input id="availabilityStart" type="time"></label>
        <label>Fim<input id="availabilityEnd" type="time"></label>
        <label>Status<select id="availabilityStatus"><option value="available">Disponível</option><option value="tentative">A confirmar</option><option value="busy">Indisponível</option></select></label>
        <label class="wide">Observação<input id="availabilityNote" maxlength="250" placeholder="Ex.: Disponível para cultos, eventos e montagem"></label>
        <button type="button" class="secondary" onclick="addAvailability()">Adicionar data</button>
      </div>
      <div id="availabilityManagerList" class="availability-manager-list"></div>
    </section>
    <label>WhatsApp profissional<input id="pwa" value="${esc(me.whatsapp||'')}"></label><label>Instagram<input id="pig" value="${esc(me.instagram||'')}"></label><label class="wide">Site<input id="pweb" value="${esc(me.website||'')}"></label><label class="wide">Biografia<textarea id="pbi">${esc(me.bio||'')}</textarea></label>
    <section class="wide profile-gallery-editor"><div><h2>Galeria profissional</h2><p>Adicione fotos de eventos, instalações, equipamentos e bastidores.</p></div><label class="file-label">Adicionar até 12 fotos<input id="pgallery" type="file" accept="image/*" multiple></label><div id="newGalleryPreview"></div>${galleryMarkup(me.gallery||[],true)}</section>
    <button class="primary">Salvar perfil profissional</button>
  </form>`;
  pav.onchange=async()=>{try{
  const file=pav.files[0];
  if(!file)return;
  avatarImage=await fileToData(file,700);
  const current=document.querySelector('#profileAvatarPreview');
  if(current){
    current.outerHTML=`<img id="profileAvatarPreview" class="avatar huge" src="${avatarImage}" alt="Pré-visualização da foto">`;
  }else{
    const wrap=document.querySelector('.avatar-editor>div:first-child');
    if(wrap)wrap.innerHTML=`<img id="profileAvatarPreview" class="avatar huge" src="${avatarImage}" alt="Pré-visualização da foto">`;
  }
  toast('Foto pronta para salvar.');
}catch(e){toast(e.message,true)}};
  pcov.onchange=async()=>{coverImage=await fileToData(pcov.files[0],1900);coverEditor.style.backgroundImage=`url('${coverImage}')`;toast('Capa pronta para salvar.')};
  pgallery.onchange=async()=>{try{profileGalleryNew=await filesToGallery(pgallery.files,12);newGalleryPreview.innerHTML=galleryMarkup(profileGalleryNew);toast(`${profileGalleryNew.length} foto(s) pronta(s) para salvar.`)}catch(e){toast(e.message,true)}};
}
async function saveProfile(e){
  e.preventDefault();
  try{
    await api('/api/profile',{method:'POST',body:JSON.stringify({name:pn.value,role:pr.value,professional_title:ppt.value,profile_type:ptype.value,hourly_rate:prate.value,languages:plang.value,remote_service:premote.checked,hire_enabled:phire.checked,headline:phl.value,company:pco.value,city:pcy.value,state:pstate.value,service_radius_km:pradius.value,service_region:preg.value,experience:pex.value,completed_projects:ppj.value,response_time:prt.value,availability:pavl.value,specialties:psp.value,services:psv.value,equipment:peq.value,work_history:pwh.value,portfolio_links:ppl.value,portfolio_pdf:ppdf.value,video_reel:preel.value,certifications:pce.value,whatsapp:pwa.value,instagram:pig.value,website:pweb.value,bio:pbi.value,avatar:avatarImage,cover:coverImage,gallery_images:profileGalleryNew})});
    me=(await api('/api/me')).user;renderSidebarIdentity();headerName.textContent=me.name;if(window.sidebarName)sidebarName.textContent=me.name;toast('Perfil e galeria atualizados.');loadAll()
  }catch(e){toast(e.message,true)}
}
function openQuote(id){
  const professional=(users||[]).find(u=>Number(u.id)===Number(id));
  const name=professional?.name||'este profissional';
  currentQuoteUser=Number(id);
  quoteTitle.textContent=`Solicitar orçamento para ${name}`;
  quoteForm.reset();
  quoteName.value=me?.name||'';
  quotePhone.value=me?.whatsapp||'';
  quoteCity.value=me?.city||'';
  if(typeof quoteDlg.showModal==='function')quoteDlg.showModal();
  else quoteDlg.setAttribute('open','');
  setTimeout(()=>quoteType.focus(),100);
}
quoteClose.onclick=()=>quoteDlg.close();
quoteForm.onsubmit=async e=>{
  e.preventDefault();
  const submit=quoteForm.querySelector('button[type="submit"]');
  try{
    if(!currentQuoteUser)throw Error('Profissional não selecionado.');
    if(submit){submit.disabled=true;submit.textContent='Enviando...'}
    await api(`/api/users/${currentQuoteUser}/quote`,{
      method:'POST',
      body:JSON.stringify({
        requester_name:quoteName.value.trim(),
        requester_phone:quotePhone.value.trim(),
        city:quoteCity.value.trim(),
        event_date:quoteDate.value,
        event_type:quoteType.value.trim(),
        audience:quoteAudience.value.trim(),
        budget:quoteBudget.value.trim(),
        message:quoteMessage.value.trim()
      })
    });
    quoteDlg.close();
    toast('Solicitação de orçamento enviada ao profissional.');
  }catch(err){
    toast(err.message,true);
  }finally{
    if(submit){submit.disabled=false;submit.textContent='Enviar solicitação'}
  }
}
function openHire(){hireForm.reset();hireName.value=me.name||'';hireCity.value=me.city||'';hireDlg.showModal()}
hireClose.onclick=()=>hireDlg.close();
hireForm.onsubmit=async e=>{e.preventDefault();try{let result=await api('/api/hire-requests',{method:'POST',body:JSON.stringify({requester_name:hireName.value,requester_phone:hirePhone.value,city:hireCity.value,event_date:hireDate.value,event_type:hireType.value,audience:hireAudience.value,budget:hireBudget.value,equipment:hireEquipment.value,message:hireMessage.value})});lastHireMatches=result.matches||[];hireDlg.close();view='hire';toast('Especialistas encontrados.');renderHire(lastHireMatches,result.request_id)}catch(e){toast(e.message,true)}};
function matchCard(u){return `<article class="card match-card"><div class="match-score"><b>${u.score}%</b><span>compatibilidade</span></div>${avatar(u,'big')}<div class="match-main"><h3>${esc(u.name)}</h3><p class="match-headline">${esc(u.headline||u.role)}</p>${u.company?`<small>${esc(u.company)}</small>`:''}<p class="meta">${icon('location')} ${esc(u.city||'Cidade não informada')}</p><div class="skills">${lines(u.specialties)}</div><div class="match-facts"><span><b>${esc(u.experience||'—')}</b> experiência</span><span><b>${esc(u.completed_projects||'—')}</b> projetos</span><span><b>${esc(u.response_time||'Até 24h')}</b></span></div></div><div class="match-actions"><button class="secondary" onclick="openProfile(${u.id})">Ver perfil</button><button class="primary" onclick="openQuote(${u.id})">Solicitar orçamento</button></div></article>`}
async function renderHire(matches=null,requestId=null){let requests=[];try{requests=await api('/api/hire-requests')}catch{};let latest=matches||(requests[0]?.matches||[]);content.innerHTML=`<section class="hire-hero card"><div><span class="eyebrow">REDE SOCIAUDIO MATCH</span><h1>Contrate o especialista certo para o seu projeto</h1><p>Descreva sua necessidade e receba recomendações baseadas em cidade, especialidade, equipamentos e disponibilidade.</p><div class="hire-benefits"><span>✓ Profissionais por compatibilidade</span><span>✓ Perfis e experiência verificados</span><span>✓ Contato e orçamento direto</span></div><button class="primary hire-cta" onclick="openHire()">${icon('target')} Encontrar especialista</button></div><div class="hire-visual"><div class="pulse-ring">${icon('target')}</div><b>Busca inteligente</b><small>Conectando sua necessidade aos melhores profissionais da comunidade.</small></div></section>${latest.length?`<div class="section-heading"><div><h2>Profissionais recomendados</h2><p>${latest.length} perfis compatíveis com sua solicitação.</p></div><span class="request-number">Solicitação #${requestId||requests[0]?.id||''}</span></div><div class="matches-list">${latest.map(matchCard).join('')}</div>`:`<section class="card hire-empty"><div>${icon('professionals')}</div><h2>Pronto para encontrar um especialista?</h2><p>Crie sua primeira solicitação. As recomendações aparecerão aqui.</p><button class="primary" onclick="openHire()">Começar agora</button></section>`}${requests.length?`<section class="request-history"><div class="section-heading"><div><h2>Minhas solicitações</h2><p>Acompanhe os pedidos já criados.</p></div></div>${requests.map(r=>`<article class="card request-row"><div><span class="tag">${esc(r.status)}</span><h3>${esc(r.event_type||'Serviço de áudio')}</h3><p>${esc(r.city)}${r.event_date?` · ${esc(r.event_date)}`:''}${r.budget?` · ${esc(r.budget)}`:''}</p><small>${r.match_count} profissional(is) recomendado(s) · ${new Date(r.created_at).toLocaleString('pt-BR')}</small></div><button class="secondary" onclick='renderHire(${JSON.stringify(r.matches)},${r.id})'>Ver recomendações</button></article>`).join('')}</section>`:''}`;hydrateIcons(content)}
async function renderOpportunities(){
  return renderJobs();
}
function quoteStatusClass(status){
  return ({novo:'quote-new',negociacao:'quote-negotiation',concluido:'quote-completed',arquivado:'quote-archived'})[status]||'';
}
function setQuoteRequestFilter(status){
  quoteRequestFilter=status;
  renderRequests();
}
async function updateQuoteRequestStatus(id,status){
  let closed_value='';
  if(status==='concluido')closed_value=prompt('Informe o valor fechado (opcional):','')||'';
  try{
    await api(`/api/quote-requests/${id}/status`,{
      method:'POST',
      body:JSON.stringify({status,closed_value})
    });
    toast(`Solicitação movida para ${quoteStatusLabel(status)}.`);
    renderRequests();
  }catch(e){toast(e.message,true)}
}
async function deleteQuoteRequest(id){
  if(!confirm('Excluir definitivamente esta solicitação? Esta ação não poderá ser desfeita.'))return;
  try{
    await api(`/api/quote-requests/${id}/delete`,{method:'POST',body:'{}'});
    toast('Solicitação excluída definitivamente.');
    renderRequests();
  }catch(e){toast(e.message,true)}
}
function quoteRequestActions(q){
  if(q.status==='concluido'){
    return `<button class="secondary" onclick="updateQuoteRequestStatus(${q.id},'novo')">Reabrir solicitação</button>
            <button class="danger" onclick="deleteQuoteRequest(${q.id})">Excluir definitivamente</button>`;
  }
  return `<button class="primary quote-attended-button" onclick="markQuoteAsAttended(${q.id})">Marcar como atendido</button>`;
}

async function markQuoteAsAttended(id){
  const button=document.querySelector(`button[onclick="markQuoteAsAttended(${id})"]`);
  try{
    if(button){
      button.disabled=true;
      button.textContent='Marcando...';
    }
    await api(`/api/quote-requests/${id}/status`,{
      method:'POST',
      body:JSON.stringify({status:'concluido'})
    });
    quoteRequestFilter='concluido';
    toast('Solicitação marcada como atendida e movida para Orçamentos concluídos.');
    await renderRequests();
  }catch(e){
    toast(e.message,true);
    if(button){
      button.disabled=false;
      button.textContent='Marcar como atendido';
    }
  }
}

async function renderRequests(){
  const items=await api('/api/quote-requests');
  const counts={novo:0,negociacao:0,concluido:0,arquivado:0};
  items.forEach(q=>{if(counts[q.status]!==undefined)counts[q.status]++});
  const list=items.filter(q=>{
    if(quoteRequestFilter==='concluido')return q.status==='concluido';
    return q.status!=='concluido';
  });

  content.innerHTML=`<div class="page-title"><h1>Solicitações de orçamento</h1><p>Gerencie cada oportunidade do primeiro contato até a conclusão.</p></div>
  <div class="quote-stats">
    <button class="${quoteRequestFilter==='novo'?'active':''}" onclick="setQuoteRequestFilter('novo')"><b>${counts.novo}</b><span>Solicitações pendentes</span></button>
    <button class="${quoteRequestFilter==='concluido'?'active':''}" onclick="setQuoteRequestFilter('concluido')"><b>${counts.concluido}</b><span>Orçamentos concluídos</span></button>
  </div>
  <section class="quote-list">
  ${list.length?list.map(q=>`<article class="card quote-card ${quoteStatusClass(q.status)}">
    <div class="quote-card-head">
      <div class="quote-client">
        ${avatar({name:q.requester_name||q.requester_account||'C',avatar:q.requester_avatar||''})}
        <div class="quote-client-info">
          <div class="quote-client-name-row">
            <b>${esc(q.requester_name||q.requester_account||'Cliente')}</b>
            <span class="quote-status ${quoteStatusClass(q.status)}">${quoteStatusLabel(q.status)}</span>
          </div>
          <small>${esc(q.city||'Cidade não informada')}</small>
        </div>
      </div>
      <small class="quote-received">Recebido em ${new Date(q.created_at).toLocaleString('pt-BR')}</small>
    </div>

    <div class="quote-info-grid">
      <div><span>Tipo de serviço</span><b>${esc(q.event_type||'Não informado')}</b></div>
      <div><span>Data</span><b>${esc(q.event_date||'Não informada')}</b></div>
      <div><span>Público</span><b>${esc(q.audience||'Não informado')}</b></div>
      <div><span>Faixa de orçamento</span><b>${esc(q.budget||'Não informada')}</b></div>
      ${q.closed_value?`<div><span>Valor fechado</span><b>${esc(q.closed_value)}</b></div>`:''}
    </div>

    <div class="quote-message-box">
      <span>Solicitação</span>
      <p>${esc(q.message||'')}</p>
    </div>

    <div class="quote-actions">
      ${q.requester_phone?`<a class="secondary action-link quote-whatsapp" target="_blank" href="https://wa.me/${q.requester_phone.replace(/\D/g,'')}">Responder no WhatsApp</a>`:''}
      ${quoteRequestActions(q)}
    </div>
  </article>`).join(''):`<div class="card empty quote-empty"><h2>${quoteRequestFilter==='concluido'?'Nenhum orçamento concluído':'Nenhuma solicitação pendente'}</h2><p>Quando houver solicitações nesta etapa, elas aparecerão aqui.</p></div>`}
  </section>`;
}

async function askAdminAssistant(){
  let input=document.querySelector('#adminAssistantInput');
  let button=document.querySelector('#adminAssistantSend');
  let prompt=input?.value.trim();
  if(!prompt)return;
  adminAssistantMessage('user',prompt);
  input.value='';
  try{
    button.disabled=true;
    button.textContent='Analisando...';
    let result=await api('/api/admin/assistant',{method:'POST',body:JSON.stringify({prompt})});
    adminAssistantMessage('assistant',result.reply,result.action,result.log_id);
  }catch(e){
    adminAssistantMessage('assistant',e.message);
  }finally{
    button.disabled=false;
    button.textContent='Enviar';
  }
}

async function confirmAdminAssistantAction(){
  if(!adminAssistantPending)return;
  try{
    let result=await api('/api/admin/assistant/execute',{
      method:'POST',
      body:JSON.stringify(adminAssistantPending)
    });
    adminAssistantPending=null;
    adminAssistantMessage('assistant',result.message);
    await applyPlatformSettings();
    await loadAll();
    setTimeout(()=>renderAdmin(),250);
  }catch(e){
    adminAssistantMessage('assistant',e.message);
  }
}

function cancelAdminAssistantAction(){
  adminAssistantPending=null;
  adminAssistantMessage('assistant','A alteração foi cancelada.');
}

function adminAssistantKeydown(event){
  if(event.key==='Enter'&&!event.shiftKey){
    event.preventDefault();
    askAdminAssistant();
  }
}

async function setUserPlan(id,plan){try{await api(`/api/admin/users/${id}/plan`,{method:'POST',body:JSON.stringify({plan})});toast('Plano atualizado.');await loadAll();renderAdmin()}catch(e){toast(e.message,true)}}

async function downloadAdminBackup(){if(!me?.is_admin)return toast('Acesso restrito ao administrador.',true);if(!confirm('Gerar e baixar agora um backup completo do banco, usuários, mensagens e uploads?'))return;let btn=document.querySelector('#adminBackupBtn');try{if(btn){btn.disabled=true;btn.textContent='Gerando backup...'}let r=await fetch('/api/admin/backup',{headers:{Authorization:'Bearer '+token}});if(!r.ok){let d=await r.json().catch(()=>({}));throw Error(d.error||'Não foi possível gerar o backup.')}let blob=await r.blob(),disposition=r.headers.get('Content-Disposition')||'',match=disposition.match(/filename="?([^";]+)"?/i),filename=match?.[1]||`redesociaudio-backup-${new Date().toISOString().slice(0,10)}.zip`,url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Backup baixado. Guarde o arquivo em local seguro.')}catch(e){toast(e.message,true)}finally{if(btn){btn.disabled=false;btn.textContent='Baixar backup completo'}}}
async function renderAdmin(){
  let s=await api('/api/admin/stats');
  content.innerHTML=`<div class="page-title"><h1>Painel administrativo</h1><p>Gerencie a plataforma com segurança e apoio do Assistente Administrativo.</p></div>
  <section class="card admin-ai-card">
    <div class="admin-ai-head">
      <div><span class="admin-ai-badge">ASSISTENTE</span><h2>Assistente Administrativo</h2><p>Descreva o que deseja fazer. Nenhuma alteração é executada sem sua confirmação.</p></div>
      <div class="admin-ai-status"><i></i> Online</div>
    </div>
    <div id="adminAssistantMessages" class="admin-ai-messages">
      <div class="admin-ai-message assistant"><span>Assistente</span><p>Olá, Edson. Posso mostrar estatísticas, criar comunidades, publicar comunicados, alterar a cor principal e mudar planos de usuários.</p></div>
    </div>
    <div class="admin-ai-examples">
      <button onclick="adminAssistantInput.value='Mostre as estatísticas da plataforma';askAdminAssistant()">Ver estatísticas</button>
      <button onclick="adminAssistantInput.value='Crie uma comunidade chamada Técnicos de PA categoria Sistemas';askAdminAssistant()">Criar comunidade</button>
      <button onclick="adminAssistantInput.value='Altere a cor principal para #1769e0';askAdminAssistant()">Alterar cor</button>
    </div>
    <div class="admin-ai-compose">
      <textarea id="adminAssistantInput" rows="2" onkeydown="adminAssistantKeydown(event)" placeholder="Exemplo: Crie uma comunidade chamada Operadores de Igrejas categoria Áudio para Igrejas"></textarea>
      <button id="adminAssistantSend" class="primary" onclick="askAdminAssistant()">Enviar</button>
    </div>
  </section>
  <section class="card plan-admin"><h2>Backup administrativo</h2><p>Baixe uma cópia completa do banco de dados, contas, publicações, mensagens e arquivos enviados.</p><button id="adminBackupBtn" class="primary" onclick="downloadAdminBackup()">Baixar backup completo</button><small>O arquivo ZIP contém informações privadas. Guarde-o em local seguro.</small></section>
  <div class="stats"><div><b>${s.users}</b><span>Usuários</span></div><div><b>${s.posts}</b><span>Publicações</span></div><div><b>${s.comments}</b><span>Respostas</span></div><div><b>${s.communities}</b><span>Comunidades</span></div></div>
  <section class="card plan-admin"><h2>Planos dos usuários</h2>${users.map(x=>`<div class="plan-row"><span>${avatar(x)}<b>${esc(x.name)}</b><small>${esc(x.email||'')}</small></span><select onchange="setUserPlan(${x.id},this.value)"><option value="free" ${x.plan==='free'?'selected':''}>Gratuito · 250 MB</option><option value="pro" ${x.plan==='pro'?'selected':''}>PRO · 2 GB</option><option value="company" ${x.plan==='company'?'selected':''}>Empresa · 5 GB</option><option value="admin" ${x.plan==='admin'?'selected':''}>Administrador · 5 GB</option></select><select onchange="setUserBadge(${x.id},this.value)"><option value="" ${!x.verified_badge?'selected':''}>Sem selo</option><option value="professional" ${x.verified_badge==='professional'?'selected':''}>Profissional verificado</option><option value="company" ${x.verified_badge==='company'?'selected':''}>Empresa verificada</option><option value="manufacturer" ${x.verified_badge==='manufacturer'?'selected':''}>Fabricante oficial</option><option value="school" ${x.verified_badge==='school'?'selected':''}>Escola parceira</option><option value="specialist" ${x.verified_badge==='specialist'?'selected':''}>Especialista certificado</option></select></div>`).join('')}</section>
  ${posts.map(postCard).join('')}`;
}
let chatTypingTimer=null,chatTypingLastSent=0;
function chatAvatar(x){return x.other_avatar?`<img class="avatar" src="${x.other_avatar}">`:`<span class="avatar fallback">${esc((x.other_name||x.name||'?')[0])}</span>`}
async function renderChat(){
  if(chatPoll){clearInterval(chatPoll);chatPoll=null;}

  content.innerHTML=`<section class="chat-safe-loading card">
    <span></span>
    <h2>Carregando mensagens...</h2>
  </section>`;

  try{
    const convs=await Promise.race([
      api('/api/chat/conversations'),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('O carregamento das mensagens demorou demais.')),12000))
    ]);

    const conversations=Array.isArray(convs)?convs:[];

    content.innerHTML=`<section class="chat-shell card">
      <aside class="chat-list">
        <div class="chat-list-head">
          <div>
            <span class="eyebrow">CHAT PROFISSIONAL</span>
            <h1>Mensagens</h1>
          </div>
          <button class="primary icon-only" id="newChatButton" title="Nova conversa">${icon('plus')}</button>
        </div>

        <input id="chatSearchInput" class="chat-search" placeholder="Buscar conversas...">

        <div id="chatConversationList">
          ${conversations.length
            ?conversations.map(chatConversationCard).join('')
            :'<div class="chat-empty-small">Nenhuma conversa. Clique em + para iniciar.</div>'}
        </div>
      </aside>

      <main id="chatMain" class="chat-main">
        <div class="chat-welcome">
          ${icon('chat')}
          <h2>Converse com profissionais</h2>
          <p>Envie mensagens, documentos, áudios e arquivos técnicos sem sair da Rede Sociaudio.</p>
          <button class="primary" id="startChatButton">Iniciar conversa</button>
        </div>
      </main>
    </section>`;

    hydrateIcons(content);

    const newButton=document.getElementById('newChatButton');
    const startButton=document.getElementById('startChatButton');
    const searchInput=document.getElementById('chatSearchInput');

    if(newButton)newButton.onclick=()=>openNewChat();
    if(startButton)startButton.onclick=()=>openNewChat();

    if(searchInput){
      searchInput.oninput=()=>{
        const q=searchInput.value.toLowerCase();
        document.querySelectorAll('.chat-conversation').forEach(item=>{
          item.hidden=!item.textContent.toLowerCase().includes(q);
        });
      };
    }

    if(chatConversationId){
      await openConversation(chatConversationId,false);
    }
  }catch(error){
    console.error('Erro ao abrir mensagens:',error);
    content.innerHTML=`<section class="card chat-safe-error">
      <div>💬</div>
      <h2>Não foi possível abrir as mensagens</h2>
      <p>${esc(error.message||'Tente novamente.')}</p>
      <button class="secondary" onclick="renderChat()">Tentar novamente</button>
    </section>`;
  }
}

function chatConversationCard(c){
  const unread=Number(c.unread||0);
  return `<button class="chat-conversation ${chatConversationId===c.id?'active':''} ${unread?'has-unread':''}" onclick="openConversation(${c.id})">
    ${chatAvatar(c)}
    <span>
      <b>${esc(c.other_name)}</b>
      <small>${esc(c.last_body||c.last_attachment||'Nova conversa')}</small>
    </span>
    ${unread?`<em class="chat-unread-count">${unread>99?'99+':unread}</em>`:''}
  </button>`;
}
function contactRow(x){let detail=[x.role,x.company,x.city].filter(Boolean).map(esc).join(' · '),tags=(x.specialties||'').split(',').map(s=>s.trim()).filter(Boolean).slice(0,3);return `<button class="contact-row" onclick="startChat(${x.id})">${x.avatar?`<img class="avatar" src="${x.avatar}">`:`<span class="avatar fallback">${esc((x.name||'?')[0])}</span>`}<span class="contact-info"><b>${esc(x.name)}</b><small>${detail||'Membro da comunidade'}</small>${tags.length?`<em>${tags.map(t=>`<i>${esc(t)}</i>`).join('')}</em>`:''}</span><span class="contact-action">Conversar</span></button>`}
function emptyContactsHtml(q=''){return `<div class="chat-no-contacts">${icon('users')}<h3>${q?'Nenhum resultado encontrado':'Ainda não há outro usuário disponível'}</h3><p>${q?'Tente pesquisar por outro nome, profissão, empresa, especialidade ou cidade.':'Para iniciar uma conversa, é necessário existir pelo menos mais uma conta cadastrada.'}</p>${me?.is_admin&&!q?'<button class="primary" onclick="createDemoChatUser()">Criar conta de teste</button>':''}</div>`}
async function openNewChat(){let contacts=await api('/api/chat/contacts');let main=content.querySelector('#chatMain');main.innerHTML=`<div class="chat-contact-picker"><div class="chat-panel-head"><div><h2>Nova conversa</h2><p>Encontre profissionais por nome, profissão, empresa, especialidade ou cidade.</p></div></div><div class="contact-search-wrap">${icon('search')}<input id="contactSearch" autocomplete="off" placeholder="Buscar profissionais..."></div><div class="contact-filter-note">${contacts.length?`${contacts.length} profissional(is) disponível(is)`:''}</div><div id="contactList">${contacts.length?contacts.map(contactRow).join(''):emptyContactsHtml()}</div></div>`;hydrateIcons(main);let timer;contactSearch.oninput=()=>{clearTimeout(timer);timer=setTimeout(async()=>{let q=contactSearch.value.trim();contactList.innerHTML='<div class="chat-searching">Buscando profissionais...</div>';try{let xs=await api('/api/chat/contacts?q='+encodeURIComponent(q));contactList.innerHTML=xs.length?xs.map(contactRow).join(''):emptyContactsHtml(q);hydrateIcons(contactList)}catch(e){contactList.innerHTML=`<div class="chat-no-contacts"><h3>Não foi possível buscar</h3><p>${esc(e.message)}</p></div>`}},250)}}
async function createDemoChatUser(){try{let r=await api('/api/chat/demo-user',{method:'POST',body:'{}'});toast('Conta de teste criada. Senha: '+r.password);await openNewChat()}catch(e){toast(e.message,true)}}
async function startChat(uid){let r=await api('/api/chat/conversations',{method:'POST',body:JSON.stringify({user_id:uid})});chatConversationId=r.id;await renderChat();openConversation(r.id)}
async function openConversation(id,reload=true){
  chatConversationId=id;
  let convs=await api('/api/chat/conversations');
  let c=convs.find(x=>x.id===id);
  if(!c){
    chatConversationId=null;
    return renderChat();
  }

  let msgs=await api(`/api/chat/conversations/${id}/messages`);
  let main=content.querySelector('#chatMain');
  if(!main)return;

  main.innerHTML=`<div class="chat-header">
    ${chatAvatar(c)}
    <div class="chat-header-person">
      <b>${esc(c.other_name)}</b>
      <small id="chatPresence">${esc(c.other_role)}${c.other_city?' · '+esc(c.other_city):''}</small>
    </div>
    <button class="secondary" onclick="openProfile(${c.other_user_id})">Ver perfil</button>
  </div>
  <div id="chatMessages" class="chat-messages">${msgs.map(chatMessage).join('')||'<div class="chat-day">Inicie a conversa com uma mensagem.</div>'}</div>
  <div id="chatTypingIndicator" class="chat-typing-indicator" hidden>
    <span></span><span></span><span></span><b>${esc(c.other_name)} está digitando...</b>
  </div>
  <form id="chatForm" class="chat-compose">
    <label class="chat-attach" title="Anexar arquivo">${icon('file')}<input id="chatFile" type="file" hidden></label>
    <div id="chatFileBadge" class="chat-file-badge" hidden></div>
    <textarea id="chatBody" placeholder="Digite uma mensagem..." rows="1"></textarea>
    <button class="primary">Enviar</button>
  </form>`;

  hydrateIcons(main);
  chatMessages.scrollTop=chatMessages.scrollHeight;

  chatFile.onchange=()=>{
    let f=chatFile.files[0];
    chatFileBadge.hidden=!f;
    chatFileBadge.textContent=f?`${f.name} · ${humanSize(f.size)}`:'';
  };

  chatBody.addEventListener('input',sendTypingSignal);
  chatBody.addEventListener('blur',()=>stopTypingSignal());
  chatForm.onsubmit=sendChatMessage;

  document.querySelectorAll('.chat-conversation').forEach(x=>{
    const current=Number(x.getAttribute('onclick').match(/\d+/)?.[0])===id;
    x.classList.toggle('active',current);
    if(current){
      x.classList.remove('has-unread');
      x.querySelector('.chat-unread-count')?.remove();
    }
  });

  clearInterval(chatPoll);
  chatPoll=setInterval(()=>refreshChatMessages(id),3000);
  await refreshTypingStatus(id);
}
function chatMessage(m){
  let mine=m.sender_id===me.id;
  let att=m.attachment_url?`<a class="chat-attachment" href="${esc(m.attachment_url)}" target="_blank" ${m.attachment_type?.startsWith('audio/')?'':'download'}>${icon(m.attachment_type?.startsWith('audio/')?'audio':'file')}<span><b>${esc(m.attachment_name||'Arquivo')}</b><small>${humanSize(m.attachment_size||0)}</small></span></a>${m.attachment_type?.startsWith('audio/')?`<audio controls src="${esc(m.attachment_url)}"></audio>`:''}`:'';
  let receipt=mine?`<span class="chat-receipt ${m.read_at?'seen':'sent'}">${m.read_at?'✓✓ Visto':'✓ Enviado'}</span>`:'';
  return `<div class="chat-message ${mine?'mine':''}">
    <div>
      ${m.body?`<p>${esc(m.body)}</p>`:''}
      ${att}
      <small class="chat-message-meta">${new Date(m.created_at).toLocaleString('pt-BR')} ${receipt}</small>
    </div>
  </div>`;
}

async function sendTypingSignal(){
  if(!chatConversationId)return;
  const nowMs=Date.now();
  if(nowMs-chatTypingLastSent>1800){
    chatTypingLastSent=nowMs;
    api(`/api/chat/conversations/${chatConversationId}/typing`,{
      method:'POST',
      body:JSON.stringify({active:true})
    }).catch(()=>{});
  }
  clearTimeout(chatTypingTimer);
  chatTypingTimer=setTimeout(()=>stopTypingSignal(),2600);
}

async function stopTypingSignal(){
  clearTimeout(chatTypingTimer);
  if(!chatConversationId)return;
  api(`/api/chat/conversations/${chatConversationId}/typing`,{
    method:'POST',
    body:JSON.stringify({active:false})
  }).catch(()=>{});
}

async function refreshTypingStatus(id){
  if(view!=='chat'||chatConversationId!==id)return;
  try{
    const state=await api(`/api/chat/conversations/${id}/typing`);
    const indicator=document.getElementById('chatTypingIndicator');
    if(indicator)indicator.hidden=!state.typing;
  }catch{}
}

async function uploadChatFile(f){if(!allowedGenericFile(f)&&!f.type.startsWith('audio/'))throw Error('Use documentos, arquivos técnicos ou áudio no chat.');let endpoint=f.type.startsWith('audio/')?'/api/media/audio':'/api/media/file';let r=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':f.type||'application/octet-stream','X-File-Type':f.type||'application/octet-stream','X-File-Name':encodeURIComponent(f.name)},body:f});let d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Falha no envio.');return d}
async function sendChatMessage(e){e.preventDefault();let body=chatBody.value.trim(),f=chatFile.files[0],att={};try{let btn=chatForm.querySelector('button');btn.disabled=true;btn.textContent=f?'Enviando...':'Enviar';if(f)att=await uploadChatFile(f);await api(`/api/chat/conversations/${chatConversationId}/messages`,{method:'POST',body:JSON.stringify({body,attachment_url:att.media_data||'',attachment_name:att.media_name||'',attachment_type:att.media_type||'',attachment_size:att.size||0})});chatBody.value='';chatFile.value='';await stopTypingSignal();await openConversation(chatConversationId)}catch(err){toast(err.message,true)}finally{let btn=chatForm?.querySelector('button');if(btn){btn.disabled=false;btn.textContent='Enviar'}}}
async function refreshChatMessages(id){
  if(view!=='chat'||chatConversationId!==id)return;
  try{
    let msgs=await api(`/api/chat/conversations/${id}/messages`);
    let box=$('#chatMessages');
    if(box){
      let near=box.scrollHeight-box.scrollTop-box.clientHeight<100;
      box.innerHTML=msgs.map(chatMessage).join('');
      hydrateIcons(box);
      if(near)box.scrollTop=box.scrollHeight;
    }
    await refreshTypingStatus(id);
  }catch{}
}



// ================================================================
// REDE SOCIAUDIO v4.0.1 — CENTRAL DE NOTIFICAÇÕES ISOLADA
// ================================================================
var publicNotificationState = {
  items: [],
  unread: 0,
  filter: 'all',
  loading: false
};

function publicNotificationTitle(type){
  var titles={
    follow:'Novo seguidor',
    like:'Nova curtida',
    comment:'Novo comentário',
    message:'Nova mensagem',
    community:'Comunidade',
    quote:'Solicitação de orçamento',
    review:'Nova avaliação',
    job_apply:'Nova candidatura',
    job_status:'Atualização de candidatura',
    system:'Rede Sociaudio'
  };
  return titles[type]||'Nova notificação';
}

function publicNotificationIcon(type){
  var icons={
    follow:'👤',
    like:'👍',
    comment:'💬',
    message:'✉️',
    community:'👥',
    quote:'💼',
    review:'⭐',
    job_apply:'📄',
    job_status:'📌',
    system:'🔔'
  };
  return icons[type]||'🔔';
}

function publicNotificationTime(value){
  if(!value)return '';
  try{
    var date=new Date(value);
    var diff=Math.max(0,Date.now()-date.getTime());
    var minutes=Math.floor(diff/60000);
    if(minutes<1)return 'agora';
    if(minutes<60)return 'há '+minutes+' min';
    var hours=Math.floor(minutes/60);
    if(hours<24)return 'há '+hours+' h';
    var days=Math.floor(hours/24);
    if(days<7)return 'há '+days+' dia'+(days>1?'s':'');
    return date.toLocaleDateString('pt-BR');
  }catch(error){
    return '';
  }
}

function publicNotificationCard(item){
  var id=Number(item.id||0);
  var read=Number(item.is_read||0)===1;
  var title=item.title||publicNotificationTitle(item.type);
  var message=item.message||item.description||'Nova atividade na sua conta.';
  var actor=item.actor_name||'Rede Sociaudio';
  var initial=esc(String(actor).slice(0,1).toUpperCase());

  return '<article class="public-notification-card '+(read?'is-read':'is-unread')+'" data-notification-id="'+id+'">'+
    '<button class="public-notification-main" type="button" onclick="openPublicNotification('+id+')">'+
      '<span class="public-notification-avatar">'+
        (item.actor_avatar
          ?'<img src="'+esc(item.actor_avatar)+'" alt="">'
          :'<b>'+initial+'</b>')+
        '<i>'+publicNotificationIcon(item.type)+'</i>'+
      '</span>'+
      '<span class="public-notification-copy">'+
        '<span class="public-notification-heading">'+
          '<strong>'+esc(title)+'</strong>'+
          (!read?'<em></em>':'')+
        '</span>'+
        '<span class="public-notification-message">'+esc(message)+'</span>'+
        '<small>'+publicNotificationTime(item.created_at)+'</small>'+
      '</span>'+
    '</button>'+
    '<button class="public-notification-remove" type="button" title="Excluir" onclick="removePublicNotification('+id+',event)">×</button>'+
  '</article>';
}

function drawPublicNotifications(){
  var all=publicNotificationState.items||[];
  var unread=all.filter(function(item){return Number(item.is_read||0)!==1;});
  var list=publicNotificationState.filter==='unread'?unread:all;

  content.innerHTML=
    '<section class="public-notifications-page">'+
      '<header class="public-notifications-header">'+
        '<div>'+
          '<span class="public-notifications-kicker">CENTRAL DE ATIVIDADES</span>'+
          '<h1>Notificações</h1>'+
          '<p>Acompanhe mensagens, conexões e atividades da sua conta.</p>'+
        '</div>'+
        (all.length
          ?'<button class="secondary" type="button" onclick="markAllPublicNotificationsRead()" '+(unread.length?'':'disabled')+'>Marcar todas como lidas</button>'
          :'')+
      '</header>'+

      '<div class="public-notification-filters">'+
        '<button class="'+(publicNotificationState.filter==='all'?'active':'')+'" type="button" onclick="setPublicNotificationFilter(\'all\')">Todas <span>'+all.length+'</span></button>'+
        '<button class="'+(publicNotificationState.filter==='unread'?'active':'')+'" type="button" onclick="setPublicNotificationFilter(\'unread\')">Não lidas <span>'+unread.length+'</span></button>'+
      '</div>'+

      '<div class="public-notification-list">'+
        (list.length
          ?list.map(publicNotificationCard).join('')
          :'<div class="public-notification-empty">'+
              '<span>'+(publicNotificationState.filter==='unread'?'✅':'🔔')+'</span>'+
              '<h2>'+(publicNotificationState.filter==='unread'?'Tudo em dia':'Nenhuma notificação')+'</h2>'+
              '<p>'+(publicNotificationState.filter==='unread'
                    ?'Você não possui notificações não lidas.'
                    :'As novas atividades aparecerão aqui.')+'</p>'+
            '</div>')+
      '</div>'+
    '</section>';
}

function setPublicNotificationFilter(filter){
  publicNotificationState.filter=filter==='unread'?'unread':'all';
  drawPublicNotifications();
}

async function renderPublicNotifications(){
  view='notifications';
  publicNotificationState.loading=true;

  content.innerHTML=
    '<section class="public-notifications-page">'+
      '<div class="public-notification-loading">'+
        '<span></span>'+
        '<h2>Carregando notificações...</h2>'+
      '</div>'+
    '</section>';

  try{
    var result=await Promise.race([
      api('/api/notifications'),
      new Promise(function(_,reject){
        setTimeout(function(){
          reject(new Error('O servidor demorou para responder.'));
        },12000);
      })
    ]);

    var items=result&&Array.isArray(result.items)?result.items:[];
    publicNotificationState.items=items;
    publicNotificationState.unread=Number(
      result&&result.unread!==undefined
        ?result.unread
        :items.filter(function(item){return Number(item.is_read||0)!==1;}).length
    );
    publicNotificationState.loading=false;

    notificationItems=items;
    notificationUnread=publicNotificationState.unread;
    updateNotificationBadge();
    drawPublicNotifications();
  }catch(error){
    publicNotificationState.loading=false;
    console.error('[Rede Sociaudio] Falha em Notificações:',error);

    content.innerHTML=
      '<section class="public-notifications-page">'+
        '<div class="public-notification-error">'+
          '<span>⚠️</span>'+
          '<h2>Não foi possível carregar as notificações</h2>'+
          '<p>'+esc(error&&error.message?error.message:'Tente novamente.')+'</p>'+
          '<button class="primary" type="button" onclick="renderPublicNotifications()">Tentar novamente</button>'+
        '</div>'+
      '</section>';
  }
}

async function markAllPublicNotificationsRead(){
  try{
    await api('/api/notifications/read-all',{method:'POST',body:'{}'});
    publicNotificationState.items.forEach(function(item){item.is_read=1;});
    publicNotificationState.unread=0;
    notificationItems=publicNotificationState.items;
    notificationUnread=0;
    updateNotificationBadge();
    drawPublicNotifications();
    toast('Todas as notificações foram marcadas como lidas.');
  }catch(error){
    toast(error.message||'Não foi possível atualizar.',true);
  }
}

async function removePublicNotification(id,event){
  if(event){
    event.preventDefault();
    event.stopPropagation();
  }
  try{
    await api('/api/notifications/'+id+'/delete',{method:'POST',body:'{}'});
    publicNotificationState.items=publicNotificationState.items.filter(function(item){
      return Number(item.id)!==Number(id);
    });
    publicNotificationState.unread=publicNotificationState.items.filter(function(item){
      return Number(item.is_read||0)!==1;
    }).length;
    notificationItems=publicNotificationState.items;
    notificationUnread=publicNotificationState.unread;
    updateNotificationBadge();
    drawPublicNotifications();
  }catch(error){
    toast(error.message||'Não foi possível excluir.',true);
  }
}

async function openPublicNotification(id){
  var item=publicNotificationState.items.find(function(entry){
    return Number(entry.id)===Number(id);
  });
  if(!item)return;

  if(Number(item.is_read||0)!==1){
    try{
      await api('/api/notifications/'+id+'/read',{method:'POST',body:'{}'});
      item.is_read=1;
      publicNotificationState.unread=Math.max(0,publicNotificationState.unread-1);
      notificationUnread=publicNotificationState.unread;
      updateNotificationBadge();
    }catch(error){}
  }

  if(item.target_type==='message'||item.type==='message'){
    view='messages';
    render();
    return;
  }
  if(item.target_type==='quote'){
    view='requests';
    render();
    return;
  }
  if(item.target_type==='community'){
    view='communities';
    render();
    return;
  }
  if(item.target_type==='profile'&&item.target_id){
    openProfile(item.target_id);
    return;
  }
  if(item.target_type==='post'){
    view='feed';
    render();
    return;
  }

  drawPublicNotifications();
}


function bindViewNavigation(){
  document.querySelectorAll('[data-view]').forEach(button=>{
    button.onclick=()=>{
      view=button.dataset.view;
      render();
    };
  });
}

function render(){
  const isChat=view==='chat'||view==='messages';
  document.body.classList.toggle('chat-page',isChat);
  document.querySelectorAll('[data-view]').forEach(b=>{
    const selected=b.dataset.view===view ||
      (isChat&&['chat','messages'].includes(b.dataset.view)) ||
      (view==='opportunities'&&['opportunities','jobs'].includes(b.dataset.view));
    b.classList.toggle('selected',selected);
  });

  if(view==='experts')return renderExperts();
  if(view==='companies')return renderCompanies();
  if(view==='jobs'||view==='opportunities')return renderJobs();
  if(view==='marketplace')return renderMarketplace();
  if(view==='knowledge')return renderKnowledge();
  if(view==='audioai')return renderAudioAI();
  if(view==='chat'||view==='messages')return renderChat();
  if(view==='communities')return renderCommunities();
  if(view==='profile')return renderProfile();
  if(view==='notifications')return renderPublicNotifications();
  if(view==='about')return renderAbout();
  if(view==='hire')return renderHire();
  if(view==='requests')return renderRequests();
  if(view==='admin')return renderAdmin();
  return renderFeed(view==='saved');
}
search.oninput=scheduleGlobalSearch;
search.onkeydown=e=>{
  if(e.key==='Enter'){
    e.preventDefault();
    clearTimeout(globalSearchTimer);
    performGlobalSearch(true);
  }
};const toastEl=$('#toast');hydrateIcons();boot();


// V13 — Vagas e oportunidades
let currentJobId=null;
if(window.jobClose)jobClose.onclick=()=>jobDlg.close();
if(window.applyClose)applyClose.onclick=()=>applyDlg.close();
function openJobDialog(){jobForm.reset();jobCity.value=me.city||'';jobPhone.value=me.whatsapp||'';jobDlg.showModal()}
jobForm.onsubmit=async e=>{e.preventDefault();try{await api('/api/jobs',{method:'POST',body:JSON.stringify({title:jobTitle.value,category:jobCategory.value,city:jobCity.value,work_mode:jobMode.value,contract_type:jobContract.value,event_date:jobDate.value,compensation:jobCompensation.value,contact_phone:jobPhone.value,description:jobDescription.value,requirements:jobRequirements.value,use_company:true})});jobDlg.close();toast('Vaga publicada com sucesso.');renderJobs()}catch(err){toast(err.message,true)}};
function openApply(id,title){currentJobId=id;applyTitle.textContent='Candidatar-se: '+title;applyPhone.value=me.whatsapp||'';applyMessage.value='';applyDlg.showModal()}
applyForm.onsubmit=async e=>{e.preventDefault();try{await api(`/api/jobs/${currentJobId}/apply`,{method:'POST',body:JSON.stringify({phone:applyPhone.value,message:applyMessage.value})});applyDlg.close();toast('Candidatura enviada.');renderJobs()}catch(err){toast(err.message,true)}};
function jobCard(j){let date=j.event_date?new Date(j.event_date+'T12:00:00').toLocaleDateString('pt-BR'):'Data a combinar';return `<article class="card job-card"><div class="job-card-top"><div class="job-company-mark">${j.company_logo?`<img src="${j.company_logo}">`:(esc((j.company_name||j.creator_name||'R').slice(0,1)))}</div><div><span class="tag">${esc(j.category)}</span><h2>${esc(j.title)}</h2><p>${esc(j.company_name||j.creator_name)}</p></div><span class="job-status">Aberta</span></div><div class="job-meta"><span>${icon('location')} ${esc(j.city||'Local a combinar')}</span><span>${icon('briefcase')} ${esc(j.contract_type)}</span><span>◷ ${date}</span><span>◉ ${esc(j.work_mode)}</span></div>${j.compensation?`<div class="job-pay">${esc(j.compensation)}</div>`:''}<p class="job-description">${esc(j.description)}</p>${j.requirements?`<div class="job-requirements"><b>Requisitos</b><p>${esc(j.requirements)}</p></div>`:''}<div class="job-footer"><span><b>${j.applicants_count}</b> candidatura(s)</span><div>${j.can_manage?`<button class="secondary" onclick="viewApplicants(${j.id})">Ver candidatos</button><button class="danger-light" onclick="closeJob(${j.id})">Encerrar</button>`:j.applied?'<button class="secondary" disabled>Candidatura enviada</button>':`<button class="primary" onclick="openApply(${j.id},'${esc(j.title).replace(/'/g,"&#39;")}')">Candidatar-se</button>`}</div></div></article>`}
async function renderJobs(){let jobs=await api('/api/jobs');content.innerHTML=`<section class="jobs-hero card"><div><span class="eyebrow">CARREIRA NO ÁUDIO</span><h1>Vagas e oportunidades</h1><p>Conecte empresas, igrejas e produtores aos profissionais certos para cada projeto.</p><button class="primary" onclick="openJobDialog()">${icon('plus')} Publicar vaga</button></div><div class="jobs-hero-stat"><b>${jobs.length}</b><span>oportunidade(s) aberta(s)</span></div></section><div class="jobs-toolbar"><div><h2>Oportunidades recentes</h2><p>Trabalhos, eventos, vagas fixas e projetos da comunidade.</p></div></div><div class="jobs-list">${jobs.length?jobs.map(jobCard).join(''):'<div class="card empty">Nenhuma vaga publicada ainda. Seja o primeiro a criar uma oportunidade.</div>'}</div>`;hydrateIcons(content)}
async function viewApplicants(id){try{let d=await api(`/api/jobs/${id}/applications`);content.innerHTML=`<div class="page-title"><div><h1>Candidatos</h1><p>${esc(d.job_title)}</p></div><button class="secondary" onclick="renderJobs()">Voltar às vagas</button></div><div class="applicant-list">${d.applications.length?d.applications.map(a=>`<article class="card applicant-card">${avatar(a)}<div><h3>${esc(a.name)}</h3><p>${esc(a.headline||a.role)} · ${esc(a.city||'Cidade não informada')}</p><div class="skills">${lines(a.specialties)}</div><blockquote>${esc(a.message)}</blockquote><small>Status: <b>${esc(a.status)}</b></small></div><div class="applicant-actions">${a.phone?`<a class="secondary btn" target="_blank" href="https://wa.me/${a.phone.replace(/\D/g,'')}">WhatsApp</a>`:''}<button class="primary" onclick="setApplicationStatus(${a.id},'em análise',${id})">Em análise</button><button class="success-light" onclick="setApplicationStatus(${a.id},'aprovada',${id})">Aprovar</button><button class="danger-light" onclick="setApplicationStatus(${a.id},'recusada',${id})">Recusar</button></div></article>`).join(''):'<div class="card empty">Ainda não há candidatos para esta vaga.</div>'}</div>`;hydrateIcons(content)}catch(e){toast(e.message,true)}}
async function setApplicationStatus(id,status,jobId){try{await api(`/api/job-applications/${id}/status`,{method:'POST',body:JSON.stringify({status})});toast('Status atualizado.');viewApplicants(jobId)}catch(e){toast(e.message,true)}}
async function closeJob(id){if(!confirm('Encerrar esta vaga?'))return;try{await api(`/api/jobs/${id}/close`,{method:'POST'});toast('Vaga encerrada.');renderJobs()}catch(e){toast(e.message,true)}}


// V15 — Marketplace especializado em áudio
let marketImageData='';
if(window.marketClose)marketClose.onclick=()=>marketDlg.close();
if(window.marketImage)marketImage.onchange=async()=>{let f=marketImage.files[0];marketImageData=f?await fileToData(f,1400):'';marketPreview.hidden=!marketImageData;marketPreview.src=marketImageData||''};
function openMarketDialog(){marketForm.reset();marketCity.value=me.city||'';marketPhone.value=me.whatsapp||'';marketImageData='';marketPreview.hidden=true;marketDlg.showModal()}
marketForm.onsubmit=async e=>{e.preventDefault();try{await api('/api/marketplace',{method:'POST',body:JSON.stringify({title:marketTitle.value,listing_type:marketType.value,category:marketCategory.value,price:marketPrice.value,item_condition:marketCondition.value,city:marketCity.value,contact_phone:marketPhone.value,description:marketDescription.value,image_data:marketImageData})});marketDlg.close();toast('Anúncio publicado com sucesso.');renderMarketplace()}catch(err){toast(err.message,true)}};
function marketCard(m){let phone=(m.contact_phone||'').replace(/\D/g,'');return `<article class="card market-card">${m.image_data?`<div class="market-image"><img src="${m.image_data}" alt="${esc(m.title)}"></div>`:`<div class="market-image placeholder">${icon('store')}</div>`}<div class="market-card-body"><div class="market-badges"><span class="tag">${esc(m.listing_type)}</span><span class="tag muted">${esc(m.category)}</span><span class="market-condition">${esc(m.item_condition)}</span></div><h2>${esc(m.title)}</h2><div class="market-price">${esc(m.price||'Valor a combinar')}</div><p>${esc(m.description)}</p><div class="market-location">${icon('location')} ${esc(m.city||m.seller_city||'Local não informado')}</div><div class="market-seller">${avatar({avatar:m.seller_avatar,name:m.seller_name})}<div><b>${esc(m.seller_name)}</b><small>Anunciante</small></div></div><div class="market-actions">${phone?`<a class="primary btn" target="_blank" rel="noopener" href="https://wa.me/${phone}?text=${encodeURIComponent('Olá! Vi seu anúncio na Rede Sociaudio: '+m.title)}">Falar no WhatsApp</a>`:''}${m.can_manage?`<button class="danger-light" onclick="closeMarket(${m.id})">Encerrar anúncio</button>`:''}</div></div></article>`}
async function renderMarketplace(){let items=await api('/api/marketplace');content.innerHTML=`<section class="market-hero card"><div><span class="eyebrow">NEGÓCIOS ENTRE PROFISSIONAIS</span><h1>Marketplace do áudio</h1><p>Compre, venda, troque ou alugue equipamentos dentro da comunidade especializada.</p><button class="primary" onclick="openMarketDialog()">${icon('plus')} Publicar anúncio</button></div><div class="market-hero-icon">${icon('store')}</div></section><div class="market-toolbar"><input id="marketSearch" placeholder="Buscar equipamentos, marcas ou cidades..."><select id="marketFilter"><option value="">Todas as categorias</option>${['Mesas digitais','Microfones','Caixas e PA','Monitores e In-ear','Interfaces e estúdio','Cabos e conectores','Cases e acessórios','Iluminação','Instrumentos','Outros'].map(x=>`<option>${x}</option>`).join('')}</select><select id="marketTypeFilter"><option value="">Venda, troca ou locação</option><option>Venda</option><option>Troca</option><option>Locação</option></select></div><div id="marketGrid" class="market-grid"></div>`;let draw=()=>{let q=marketSearch.value.toLowerCase(),cat=marketFilter.value,typ=marketTypeFilter.value;let filtered=items.filter(x=>(!q||[x.title,x.description,x.city,x.seller_name].join(' ').toLowerCase().includes(q))&&(!cat||x.category===cat)&&(!typ||x.listing_type===typ));marketGrid.innerHTML=filtered.length?filtered.map(marketCard).join(''):'<div class="card empty market-empty">Nenhum anúncio encontrado.</div>';hydrateIcons(marketGrid)};marketSearch.oninput=draw;marketFilter.onchange=draw;marketTypeFilter.onchange=draw;draw();hydrateIcons(content)}
async function closeMarket(id){if(!confirm('Encerrar este anúncio?'))return;try{await api(`/api/marketplace/${id}/close`,{method:'POST'});toast('Anúncio encerrado.');renderMarketplace()}catch(e){toast(e.message,true)}}


// V15 — Centro de Conhecimento
let articleCoverData='';
articleCover.onchange=async()=>{try{articleCoverData=await fileToData(articleCover.files[0],1800);articlePreview.src=articleCoverData;articlePreview.hidden=!articleCoverData}catch(e){toast(e.message,true)}};
articleClose.onclick=()=>articleDlg.close();
function openArticleDialog(){articleForm.reset();articleCoverData='';articlePreview.hidden=true;articlePreview.removeAttribute('src');articleFeatured.closest('label').hidden=!me.is_admin;articleDlg.showModal()}
articleForm.onsubmit=async e=>{e.preventDefault();try{await api('/api/knowledge',{method:'POST',body:JSON.stringify({title:articleTitle.value,category:articleCategory.value,difficulty:articleDifficulty.value,summary:articleSummary.value,body:articleBody.value,link_url:articleLink.value,cover_data:articleCoverData,is_featured:articleFeatured.checked})});articleDlg.close();toast('Artigo publicado no Centro de Conhecimento.');renderKnowledge()}catch(err){toast(err.message,true)}};
function articleCard(a){return `<article class="knowledge-card card ${a.is_featured?'knowledge-featured':''}">${a.cover_data?`<div class="knowledge-cover" style="background-image:url('${a.cover_data}')"></div>`:`<div class="knowledge-cover knowledge-cover-empty">${icon('book')}</div>`}<div class="knowledge-card-body"><div class="knowledge-meta"><span class="tag">${esc(a.category)}</span><span>${esc(a.difficulty)}</span>${a.is_featured?'<b>DESTAQUE</b>':''}</div><h2>${esc(a.title)}</h2><p>${esc(a.summary||a.body.slice(0,180))}</p><div class="knowledge-author">${a.author_avatar?`<img src="${a.author_avatar}" alt="">`:`<span>${esc(a.author_name).charAt(0)}</span>`}<div><b>${esc(a.author_name)}</b><small>${esc(a.author_role||'Profissional de áudio')}</small></div></div><div class="knowledge-actions"><button class="primary" onclick="openArticle(${a.id})">Ler artigo</button><small>${a.views||0} leitura(s)</small>${a.can_manage?`<button class="danger-link" onclick="deleteArticle(${a.id})">Remover</button>`:''}</div></div></article>`}
async function renderKnowledge(){let items=await api('/api/knowledge');let featured=items.filter(x=>x.is_featured),cats=[...new Set(items.map(x=>x.category))];content.innerHTML=`<section class="knowledge-hero card"><div><span class="eyebrow">BIBLIOTECA TÉCNICA VIVA</span><h1>Centro de Conhecimento</h1><p>Guias, artigos e soluções práticas de áudio profissional, organizados para não se perderem no feed.</p><button class="primary" onclick="openArticleDialog()">${icon('plus')} Publicar artigo</button></div><div class="knowledge-hero-icon">${icon('book')}</div></section><div class="knowledge-toolbar"><input id="knowledgeSearch" placeholder="Pesquisar microfonia, Ui24R, acústica..."><select id="knowledgeCategory"><option value="">Todas as categorias</option>${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select><select id="knowledgeLevel"><option value="">Todos os níveis</option><option>Iniciante</option><option>Intermediário</option><option>Avançado</option></select></div>${featured.length?`<section><div class="section-heading"><div><h2>Conteúdos em destaque</h2><p>Materiais selecionados pela comunidade.</p></div></div><div class="knowledge-grid featured-grid">${featured.slice(0,3).map(articleCard).join('')}</div></section>`:''}<section><div class="section-heading"><div><h2>Biblioteca completa</h2><p>${items.length} conteúdo(s) disponível(is).</p></div></div><div id="knowledgeGrid" class="knowledge-grid"></div></section>`;let draw=()=>{let q=knowledgeSearch.value.toLowerCase(),cat=knowledgeCategory.value,lvl=knowledgeLevel.value;let filtered=items.filter(a=>(!q||[a.title,a.summary,a.body,a.category,a.author_name].join(' ').toLowerCase().includes(q))&&(!cat||a.category===cat)&&(!lvl||a.difficulty===lvl));knowledgeGrid.innerHTML=filtered.length?filtered.map(articleCard).join(''):'<div class="card empty">Nenhum conteúdo encontrado.</div>';hydrateIcons(knowledgeGrid)};knowledgeSearch.oninput=draw;knowledgeCategory.onchange=draw;knowledgeLevel.onchange=draw;draw();hydrateIcons(content)}
async function openArticle(id){try{let a=await api(`/api/knowledge/${id}`);content.innerHTML=`<article class="article-reader card"><button class="text-button" onclick="renderKnowledge()">← Voltar ao Centro de Conhecimento</button>${a.cover_data?`<img class="article-hero-image" src="${a.cover_data}">`:''}<div class="article-reader-head"><div class="knowledge-meta"><span class="tag">${esc(a.category)}</span><span>${esc(a.difficulty)}</span>${a.is_featured?'<b>DESTAQUE</b>':''}</div><h1>${esc(a.title)}</h1><p>${esc(a.summary||'')}</p><div class="knowledge-author">${a.author_avatar?`<img src="${a.author_avatar}">`:`<span>${esc(a.author_name).charAt(0)}</span>`}<div><b>${esc(a.author_name)}</b><small>${esc(a.author_role||'Profissional de áudio')} · ${a.views||0} leitura(s)</small></div></div></div><div class="article-body">${esc(a.body).replace(/\n/g,'<br>')}</div>${a.link_url?`<a class="article-link" href="${a.link_url}" target="_blank" rel="noopener">${icon('link')} Abrir material complementar</a>`:''}</article>`;hydrateIcons(content)}catch(e){toast(e.message,true)}}
async function deleteArticle(id){if(!confirm('Remover este artigo?'))return;try{await api(`/api/knowledge/${id}/delete`,{method:'POST'});toast('Artigo removido.');renderKnowledge()}catch(e){toast(e.message,true)}}


// V17 — Audio IA (assistente técnico offline)
let aiSessionId=null,aiAttachment=null;
function aiAnswerHtml(ans){return `<div class="ai-answer"><div class="ai-answer-title"><span class="ai-badge">AI</span><div><small>ORIENTAÇÃO TÉCNICA</small><h3>${esc(ans.title)}</h3></div></div><section><h4>Causas prováveis</h4><ul>${(ans.likely||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section><h4>Ações recomendadas</h4><ol>${(ans.actions||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ol></section><section><h4>Verificações para confirmar</h4><ul>${(ans.checks||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>${(ans.related_articles||[]).length?`<section class="ai-related"><h4>Na biblioteca da Rede Sociaudio</h4>${ans.related_articles.map(x=>`<button onclick="view='knowledge';openArticle(${x.id})">${icon('book')} ${esc(x.title)}</button>`).join('')}</section>`:''}<p class="ai-notice">${esc(ans.notice||'')}</p></div>`}
function aiWelcome(){return `<div class="ai-welcome"><div class="ai-orb">${icon('brain')}</div><span class="eyebrow">ASSISTENTE TÉCNICO</span><h2>Como posso ajudar no seu áudio?</h2><p>Descreva o problema com o máximo de contexto: equipamento, ambiente, fonte e o que você já testou.</p><div class="ai-starters">${['Como eliminar microfonia?','Minha voz está abafada','O canal está clipando','Configuração inicial de compressor','Problema no retorno de palco','Como interpretar um RTA?'].map(x=>`<button onclick="useAiStarter('${x.replace(/'/g,"\\'")}')">${esc(x)}</button>`).join('')}</div></div>`}
async function renderAudioAI(){let hist=[];try{hist=await api('/api/audio-ai/history')}catch{}content.innerHTML=`<section class="ai-shell"><aside class="ai-history card"><div class="ai-history-head"><div><span class="eyebrow">AUDIO IA</span><h3>Conversas</h3></div><button class="icon-button" onclick="newAiChat()">${icon('plus')}</button></div><div class="ai-history-list">${hist.length?hist.map(s=>`<button class="${s.id===aiSessionId?'active':''}" onclick="loadAiSession(${s.id})"><span>${icon('comment')}</span><div><b>${esc(s.title)}</b><small>${esc(s.mode)} · ${s.message_count} msg</small></div></button>`).join(''):'<p>Nenhuma conversa ainda.</p>'}</div><div class="ai-offline-note"><b>Versão local</b><span>Assistente técnico baseado em regras. Análise avançada de imagem e áudio exigirá integração online futura.</span></div></aside><main class="ai-main card"><header class="ai-main-head"><div class="ai-brand-mark">${icon('brain')}</div><div><h1>Audio IA</h1><p>Seu copiloto técnico para diagnóstico e configuração.</p></div><span class="ai-status">● Disponível</span></header><div id="aiMessages" class="ai-messages">${aiWelcome()}</div><form id="aiComposer" class="ai-composer"><div class="ai-mode-row"><select id="aiMode"><option>Pergunta técnica</option><option>Diagnóstico guiado</option><option>Configuração inicial</option><option>Análise de RTA</option><option>Sound check</option></select><select id="aiSymptom"><option value="">Selecionar sintoma (opcional)</option><option>Microfonia</option><option>Voz abafada</option><option>Voz estridente</option><option>Clipping</option><option>Ruído ou zumbido</option><option>Retorno / monitor</option><option>Problema em mesa digital</option></select></div><textarea id="aiQuestion" placeholder="Ex.: Estou usando uma Ui24R em uma igreja e o vocal começa a microfonar quando aumento o retorno..." rows="3"></textarea><input id="aiContext" placeholder="Equipamentos e contexto (opcional)"><div id="aiAttachmentInfo" class="ai-attachment-info" hidden></div><div class="ai-composer-actions"><label class="ai-file-btn">${icon('file')} Anexar referência<input id="aiFile" type="file" accept="image/*,audio/*,.pdf,.txt"></label><button class="primary" type="submit">Analisar ${icon('share')}</button></div></form></main></section>`;hydrateIcons(content);aiFile.onchange=()=>{aiAttachment=aiFile.files[0]||null;aiAttachmentInfo.hidden=!aiAttachment;aiAttachmentInfo.textContent=aiAttachment?`${aiAttachment.name} · ${Math.round(aiAttachment.size/1024)} KB`:''};aiComposer.onsubmit=askAudioAI;if(aiSessionId)loadAiSession(aiSessionId,false)}
function newAiChat(){aiSessionId=null;renderAudioAI()}
function useAiStarter(text){aiQuestion.value=text;aiQuestion.focus()}
async function askAudioAI(e){e.preventDefault();let q=aiQuestion.value.trim(),sym=aiSymptom.value;if(!q&&!sym)return toast('Descreva a dúvida ou selecione um sintoma.',true);let btn=aiComposer.querySelector('button[type=submit]');btn.disabled=true;btn.textContent='Analisando...';let messages=aiMessages;if(messages.querySelector('.ai-welcome'))messages.innerHTML='';messages.insertAdjacentHTML('beforeend',`<div class="ai-message user"><div><b>Você</b><p>${esc(q||sym)}</p>${aiAttachment?`<small>📎 ${esc(aiAttachment.name)}</small>`:''}</div></div><div class="ai-thinking"><span></span><span></span><span></span> Analisando o cenário...</div>`);messages.scrollTop=messages.scrollHeight;try{let r=await api('/api/audio-ai/ask',{method:'POST',body:JSON.stringify({session_id:aiSessionId,question:q,mode:aiMode.value,symptom:sym,context:aiContext.value,attachment_name:aiAttachment?.name||'',attachment_type:aiAttachment?.type||'',attachment_size:aiAttachment?.size||0})});aiSessionId=r.session_id;messages.querySelector('.ai-thinking')?.remove();messages.insertAdjacentHTML('beforeend',`<div class="ai-message assistant">${aiAnswerHtml(r.answer)}</div>`);aiQuestion.value='';aiContext.value='';aiFile.value='';aiAttachment=null;aiAttachmentInfo.hidden=true;messages.scrollTop=messages.scrollHeight;toast('Análise concluída.')}catch(err){messages.querySelector('.ai-thinking')?.remove();toast(err.message,true)}finally{btn.disabled=false;btn.innerHTML='Analisar '+icon('share');hydrateIcons(btn)}}
async function loadAiSession(id,rerender=true){aiSessionId=id;if(rerender){renderAudioAI();return}try{let d=await api(`/api/audio-ai/session/${id}`),box=aiMessages;box.innerHTML=d.messages.map(m=>{if(m.role==='user')return `<div class="ai-message user"><div><b>Você</b><p>${esc(m.body)}</p></div></div>`;let ans;try{ans=JSON.parse(m.body)}catch{ans={title:'Resposta',actions:[m.body],likely:[],checks:[]}}return `<div class="ai-message assistant">${aiAnswerHtml(ans)}</div>`}).join('')||aiWelcome();box.scrollTop=box.scrollHeight;hydrateIcons(box)}catch(e){toast(e.message,true)}}


document.querySelectorAll('[data-view="notifications"],#notificationBtn,.notification-button').forEach(function(el){
  el.onclick=function(){
    renderPublicNotifications();
  };
});
loadNotifications();
notificationPoll=setInterval(()=>loadNotifications(view==='notifications'),5000);

checkPlatformHealth();
setInterval(checkPlatformHealth,120000);


function showBetaNotice(){
  if(sessionStorage.getItem('sociaudio_beta_notice'))return;
  sessionStorage.setItem('sociaudio_beta_notice','1');
  setTimeout(()=>{
    toast('Rede Sociaudio Beta 3.2.3: estabilidade da sidebar corrigida.');
  },900);
}
showBetaNotice();


document.querySelectorAll('[data-view="about"]').forEach(el=>{
  el.onclick=()=>{view='about';render()};
});


// Versão pública: abre a aba de cadastro quando solicitado pela landing page.
try{
  const publicParams=new URLSearchParams(location.search);
  if(publicParams.get('cadastro')==='1'){
    window.addEventListener('DOMContentLoaded',()=>{
      setTimeout(()=>{
        const tab=document.getElementById('registerTab');
        if(tab)tab.click();
      },80);
    });
  }
}catch(_){}
