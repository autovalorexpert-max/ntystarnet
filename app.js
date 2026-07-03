const SB_URL = 'https://bpeliducuuagffwlsjal.supabase.co';
const SB_KEY = 'sb_publishable_3HKOfxQfItpFE8VYDIEULg_j550L4Hi';

async function sb(table,method='GET',body=null,query=''){
  const url=SB_URL+'/rest/v1/'+table+(query?'?'+query:'');
  const headers={'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json','Prefer':'return=representation'};
  const res=await fetch(url,{method,headers,body:body?JSON.stringify(body):null});
  if(!res.ok){const e=await res.text();throw new Error(e);}
  const txt=await res.text();
  return txt?JSON.parse(txt):[];
}
async function sbGet(t,q=''){return sb(t,'GET',null,q);}
async function sbPost(t,d){return sb(t,'POST',d);}
async function sbPatch(t,q,d){return sb(t,'PATCH',d,q);}
async function sbDelete(t,q){return sb(t,'DELETE',null,q);}

let me=null,selPlanName='100 Go',photoData=null,curChatId=null,curDetailId=null,curPayId=null;
// Statut coupure électrique global (stocké localement pour l'admin)
let coupureActive=localStorage.getItem('nty_coupure')==='true';
let coupureMsg=localStorage.getItem('nty_coupure_msg')||'⚡ Coupure électrique en cours — La connexion WiFi est temporairement indisponible. Nous travaillons à rétablir le service.';

function showPage(id){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById(id).classList.add('active');}
function now(){return new Date().toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'});}
function today(){return new Date().toISOString().split('T')[0];}
function fmtDate(d){if(!d)return'—';try{return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'});}catch{return d;}}
function fmtDateFull(d){if(!d)return'—';try{return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});}catch{return d;}}
function daysLeft(exp){if(!exp)return null;return Math.ceil((new Date(exp)-new Date())/(1000*60*60*24));}
function addDays(date,days){const d=new Date(date);d.setDate(d.getDate()+days);return d.toISOString().split('T')[0];}
function showModal(html){document.getElementById('modal-content').innerHTML=html;document.getElementById('modal').style.display='flex';}
function closeModal(){document.getElementById('modal').style.display='none';}
function togglePass(){const i=document.getElementById('login-pass');i.type=i.type==='password'?'text':'password';}
function initials(n){return(n||'??').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();}
function loading(el){if(el)el.innerHTML='<div class="loading"><div class="spinner"></div><p>Chargement en cours...</p></div>';}
function toast(msg,type='success'){
  const t=document.createElement('div');t.className='toast toast-'+type;t.innerHTML=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},3500);
}

function initStars(){
  const s=document.getElementById('stars');if(!s)return;
  for(let i=0;i<100;i++){
    const el=document.createElement('div');el.className='star';
    const sz=Math.random()*2+0.5;
    el.style.cssText='width:'+sz+'px;height:'+sz+'px;top:'+Math.random()*100+'%;left:'+Math.random()*100+'%;--d:'+(2+Math.random()*5)+'s;--delay:'+Math.random()*5+'s;--op:'+(0.2+Math.random()*0.7);
    s.appendChild(el);
  }
}

async function doLogin(){
  const btn=document.getElementById('login-btn');
  const u=document.getElementById('login-user').value.trim().toLowerCase();
  const p=document.getElementById('login-pass').value;
  const err=document.getElementById('login-err');
  if(!u||!p){err.style.display='flex';err.querySelector('.err-msg').textContent='Remplissez tous les champs';return;}
  btn.innerHTML='<div class="btn-spinner"></div> Connexion...';btn.disabled=true;
  try{
    const admins=await sbGet('admins','username=eq.'+u+'&password=eq.'+p);
    if(admins.length>0){me={...admins[0],role:'admin'};err.style.display='none';showPage('page-admin');aPage('dashboard',null);btn.innerHTML='Se connecter <span>→</span>';btn.disabled=false;return;}
    const clients=await sbGet('clients','username=eq.'+u+'&password=eq.'+p);
    if(clients.length>0){me={...clients[0],role:'client'};err.style.display='none';showPage('page-client');cPage('home',null);btn.innerHTML='Se connecter <span>→</span>';btn.disabled=false;return;}
    err.style.display='flex';err.querySelector('.err-msg').textContent='Identifiants incorrects';
  }catch(e){err.style.display='flex';err.querySelector('.err-msg').textContent='Erreur de connexion. Réessayez.';}
  btn.innerHTML='Se connecter <span>→</span>';btn.disabled=false;
}

function logout(){me=null;document.getElementById('login-user').value='';document.getElementById('login-pass').value='';document.getElementById('login-err').style.display='none';showPage('page-login');}

function cPage(page,btn){
  document.querySelectorAll('#page-client .nav-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  else{const b=document.getElementById('cnav-'+page);if(b)b.classList.add('active');}
  const c=document.getElementById('c-content');loading(c);
  requestAnimationFrame(()=>{
    if(page==='home')renderClientHome();
    else if(page==='paiement')renderClientPaiement();
    else if(page==='messages')renderClientMessages();
    else if(page==='profil')renderClientProfil();
  });
}

async function renderClientHome(){
  const c=document.getElementById('c-content');
  try{
    const [cd,pays,tix]=await Promise.all([
      sbGet('clients','id=eq.'+me.id),
      sbGet('payments','client_id=eq.'+me.id+'&order=created_at.desc&limit=5'),
      sbGet('tickets','client_id=eq.'+me.id)
    ]);
    const u=cd[0]||me;me={...me,...u};
    const dl=daysLeft(u.expiry_date);
    const freeT=tix.filter(t=>!t.is_used);
    const h=new Date().getHours();
    const greetMorning=['Prêt à conquérir Internet ? 🚀','Bonjour, votre WiFi vous attend ! 📶','Belle journée connectée à venir ☀️'];
    const greetAfternoon=['Bon après-midi connecté ! 🌤','La connexion ne s\'arrête jamais 💪','Tout roule de votre côté ? 📡'];
    const greetEvening=['Bonsoir, profitez de votre soirée 🌆','Le réseau veille sur vous 🛡️','Une bonne connexion pour bien finir 🌟'];
    const greetNight=['Bonne nuit, on reste connectés 🌙','Le WiFi ne dort jamais 😴','Repos bien mérité ⭐'];
    const greetPool=h<5?greetNight:h<12?greetMorning:h<18?greetAfternoon:greetEvening;
    const greet=greetPool[Math.floor(Math.random()*greetPool.length)];
    const pct=dl!==null&&dl>0?Math.min(100,Math.round(dl/30*100)):0;
    const fillColor=pct>60?'var(--success)':pct>25?'var(--warning)':'var(--danger)';
    const statusMap={active:'✅ Actif',expired:'❌ Expiré',pending:'⏳ En attente'};
    const startFmt=fmtDateFull(u.start_date);
    const endFmt=fmtDateFull(u.expiry_date);

    let html='<div class="fade-up">';
    html+='<div class="greeting"><div class="greeting-text">'+greet+'</div><div class="greeting-name">'+u.name+'</div></div>';

    // ═══ COUPURE ÉLECTRIQUE CIBLÉE PAR ZONE ═══
    const clientZone=u.zone||'';
    const coupureZones=JSON.parse(localStorage.getItem('nty_coupure_zones')||'{}');
    const zoneHasCoupure=clientZone&&coupureZones[clientZone]===true;
    if(zoneHasCoupure){
      const zoneKey='nty_coupure_msg_'+clientZone;
      const zoneMsg=localStorage.getItem(zoneKey)||'⚡ Coupure électrique en cours dans votre zone ('+clientZone+') — La connexion WiFi sera rétablie dès le retour du courant.';
      html+='<div class="notif-card notif-danger" style="border-width:2px"><div class="notif-icon">🔴</div><div class="notif-body"><div class="notif-title">Coupure en cours — '+clientZone+'</div><div class="notif-msg">'+zoneMsg+'</div></div></div>';
    }

    // ═══ ABONNEMENT NON PAYÉ ═══
    if(u.status==='expired'||dl!==null&&dl<0){
      html+='<div class="notif-card notif-danger" style="border-width:2px"><div class="notif-icon">🚫</div><div class="notif-body"><div class="notif-title">Connexion coupée automatiquement</div><div class="notif-msg">Votre abonnement a expiré le <strong>'+endFmt+'</strong>. Votre accès WiFi a été automatiquement suspendu. Renouvelez votre abonnement pour rétablir la connexion.</div></div></div>';
    }

    // ═══ EXPIRATION PROCHE ═══
    if(dl!==null&&dl<=5&&dl>0){
      html+='<div class="notif-card notif-warning"><div class="notif-icon">⏰</div><div class="notif-body"><div class="notif-title">Renouvellement urgent !</div><div class="notif-msg">Votre abonnement expire le <strong>'+endFmt+' à 23h59</strong> dans <strong>'+dl+' jour'+(dl>1?'s':'')+'</strong>. Sans renouvellement, votre connexion WiFi sera automatiquement coupée à cette date.</div></div></div>';
    }

    // ═══ EXPIRE AUJOURD'HUI ═══
    if(dl===0){
      html+='<div class="notif-card notif-danger"><div class="notif-icon">🔴</div><div class="notif-body"><div class="notif-title">Expire aujourd\'hui à 23h59 !</div><div class="notif-msg">Renouvelez immédiatement pour éviter la coupure automatique de votre connexion WiFi ce soir à 23h59.</div></div></div>';
    }

    // ═══ PAIEMENT EN ATTENTE ═══
    if(pays.some(p=>p.status==='pending')){
      html+='<div class="notif-card notif-info"><div class="notif-icon">💳</div><div class="notif-body"><div class="notif-title">Paiement en cours de validation</div><div class="notif-msg">Votre paiement est en cours de validation par l\'administrateur. Vous recevrez votre ticket Mikrotik dès que c\'est traité.</div></div></div>';
    }

    // ═══ DATES D\'ABONNEMENT ═══
    if(u.start_date&&u.expiry_date&&u.status==='active'){
      html+='<div class="notif-card notif-info"><div class="notif-icon">📅</div><div class="notif-body"><div class="notif-title">Période d\'abonnement</div><div class="notif-msg">Du <strong>'+startFmt+'</strong> au <strong>'+endFmt+' à 23h59</strong>.</div></div></div>';
    }

    // ═══ AVERTISSEMENT COUPURE AUTOMATIQUE ═══
    if(u.status==='active'&&dl!==null&&dl>5){
      html+='<div class="notif-card notif-subtle"><div class="notif-icon">ℹ️</div><div class="notif-body"><div class="notif-title">Information importante</div><div class="notif-msg">En cas de non-renouvellement, votre connexion WiFi sera <strong>automatiquement suspendue</strong> à l\'expiration de votre abonnement le <strong>'+endFmt+' à 23h59</strong>. Pensez à renouveler à temps !</div></div></div>';
    }

    // ═══ HERO CARD ═══
    html+='<div class="hero-card"><div class="hero-top"><div><div class="hero-label">ABONNEMENT</div><span class="badge badge-'+(u.status||'pending')+'">'+(statusMap[u.status||'pending'])+'</span></div><div class="hero-right"><div class="hero-label">PLAN</div><div class="hero-plan">'+(u.plan||'—')+'</div><div class="hero-price">'+(u.plan_price||'—')+' Ar/mois</div></div></div>';
    html+='<div class="hero-mid"><div><div class="hero-label">EXPIRATION</div><div class="hero-exp">'+(u.expiry_date?endFmt+' à 23h59':'—')+'</div></div><div class="hero-days-wrap"><div class="hero-label">JOURS RESTANTS</div><div class="hero-days" style="color:'+fillColor+'">'+(dl!==null&&dl>=0?dl:'—')+'</div></div></div>';
    if(dl!==null&&dl>=0)html+='<div class="expiry-track"><div class="expiry-fill" style="width:'+pct+'%;background:'+fillColor+'"></div></div>';
    html+='<button class="btn btn-primary btn-full" onclick="cPage(\'paiement\',document.getElementById(\'cnav-paiement\'))">🔄 Renouveler l\'abonnement</button></div>';

    // ═══ TICKET ═══
    if(u.current_ticket){
      html+='<div class="ticket-card"><div class="ticket-label">🎫 VOTRE TICKET MIKROTIK ACTIF</div><div class="ticket-code">'+u.current_ticket+'</div><div class="ticket-valid">Valable du '+startFmt+' au '+endFmt+' à 23h59</div></div>';
    }

    // ═══ CONSOMMATION DATA — design premium (uniquement 100 Go / 200 Go) ═══
    const isLimitedPlan=u.plan==='100 Go'||u.plan==='200 Go';
    if(isLimitedPlan&&u.consumption_pct&&parseInt(u.consumption_pct)>0&&u.status==='active'){
      const cp=parseInt(u.consumption_pct);
      const remaining=100-cp;
      let theme,icon,headline;
      if(cp>=90){theme='critical';icon='🔴';headline='Quota presque épuisé !';}
      else if(cp>=70){theme='warning';icon='🟠';headline='Quota en surveillance';}
      else if(cp>=50){theme='mid';icon='🟡';headline='Mi-parcours atteint';}
      else{theme='good';icon='🟢';headline='Tout va bien';}
      html+='<div class="data-orb-card data-orb-'+theme+'"><div class="data-orb-glow"></div><div class="data-orb-top"><div><div class="data-orb-eyebrow">'+icon+' Suivi de consommation</div><div class="data-orb-headline">'+headline+'</div></div><div class="data-orb-ring-wrap"><svg class="data-orb-ring" viewBox="0 0 100 100"><circle class="data-orb-track" cx="50" cy="50" r="42"/><circle class="data-orb-progress data-orb-progress-'+theme+'" cx="50" cy="50" r="42" style="stroke-dasharray:'+(2*Math.PI*42)+';stroke-dashoffset:'+(2*Math.PI*42*(1-cp/100))+'"/></svg><div class="data-orb-pct">'+cp+'<span>%</span></div></div></div><div class="data-orb-detail">Forfait <strong>'+(u.plan||'')+'</strong> · <strong>'+remaining+'%</strong> restant ce cycle'+(cp>=90?'<br><span class="data-orb-cta">⚡ Renouvelez maintenant pour ne pas perdre votre connexion</span>':'')+'</div></div>';
    }

    // ═══ STATS ═══
    html+='<div class="stats-row"><div class="stat-pill"><div class="stat-pill-num">'+pays.filter(p=>p.status==='validated').length+'</div><div class="stat-pill-lbl">Paiements validés</div></div><div class="stat-pill"><div class="stat-pill-num">'+freeT.length+'</div><div class="stat-pill-lbl">Tickets restants</div></div><div class="stat-pill"><div class="stat-pill-num">'+tix.length+'</div><div class="stat-pill-lbl">Total tickets</div></div></div>';

    // ═══ HISTORIQUE ═══
    if(pays.length>0){
      html+='<div class="section-card"><div class="section-head">📋 Historique des paiements</div>';
      pays.forEach(p=>{
        const ic=p.status==='validated'?'✅':p.status==='rejected'?'❌':'⏳';
        html+='<div class="history-row"><div class="history-left"><div class="history-icon">'+ic+'</div><div><div class="history-plan">'+p.plan+'</div><div class="history-date">'+fmtDate(p.payment_date)+' · Réf: '+(p.reference||'—')+'</div></div></div><div class="history-right"><div class="history-amount">'+(p.amount||'—')+' Ar</div><span class="badge badge-'+p.status+'" style="font-size:10px">'+({validated:'Validé',pending:'En attente',rejected:'Refusé'}[p.status])+'</span></div></div>';
      });
      html+='</div>';
    }
    html+='</div>';
    c.innerHTML=html;
  }catch(e){c.innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><p>Erreur de chargement</p><button class="btn btn-ghost" onclick="cPage(\'home\',null)" style="margin-top:12px;width:auto;padding:10px 20px">Réessayer</button></div>';}
}

function renderClientPaiement(){
  const c=document.getElementById('c-content');photoData=null;
  const plans=[
    {n:'100 Go',p:'40.000',d:'Valable 30 jours',icon:'📶'},
    {n:'200 Go',p:'55.000',d:'Valable 30 jours',icon:'📶'},
    {n:'Illimité 5 appareils',p:'65.000',d:'30 jours · jusqu\'à 5 appareils',icon:'🏠'},
    {n:'Illimité 9+ appareils',p:'90.000',d:'30 jours · 9 appareils et plus',icon:'🏢'}
  ];
  const nums=[
    {n:'0344127501',name:'Rojo Rindra'},
    {n:'0346341775',name:'Rasoamanana Ny Tiana (NY)'},
    {n:'0321825114',name:'Rasoamanana Ny Tiana (NY)'}
  ];
  let html='<div class="fade-up"><div class="page-header"><div class="page-title">💳 Renouveler</div><div class="page-sub">Choisissez votre abonnement</div></div>';
  html+='<div class="pay-box"><div class="pay-box-title">📲 Envoyez votre paiement sur</div>';
  nums.forEach(num=>{
    html+='<div class="pay-num-row"><div class="pay-num">'+num.n+'</div><div class="pay-num-name">'+num.name+'</div></div>';
  });
  html+='<div class="pay-box-warn">⚠️ Frais de retrait Mobile Money à votre charge — merci d\'envoyer le montant exact du forfait + frais de retrait.</div>';
  html+='<div class="pay-box-sub">Puis remplissez le formulaire ci-dessous ↓</div></div>';
  html+='<div class="section-card"><div class="section-head">Choisir un plan</div>';
  plans.forEach((pl,i)=>{html+='<div class="plan-card'+(i===0?' selected':'')+'" onclick="selPlan(this,\''+pl.n+'\')"><div class="plan-icon">'+pl.icon+'</div><div class="plan-info"><div class="plan-name">'+pl.n+'</div><div class="plan-desc">'+pl.d+'</div></div><div class="plan-price">'+pl.p+' Ar</div></div>';});
  html+='</div><div class="section-card"><div class="section-head">Détails du paiement</div>';
  html+='<label class="inp-label">Date du paiement *</label><input class="inp" type="date" id="c-paydate" max="'+today()+'">';
  html+='<label class="inp-label">Référence du paiement</label><input class="inp" type="text" id="c-payref" placeholder="Ex: TXN123456789">';
  html+='<label class="inp-label">Photo du reçu</label>';
  html+='<div class="upload-zone" id="upload-zone" onclick="document.getElementById(\'c-photo\').click()"><div class="upload-icon">📷</div><div class="upload-text">Appuyez pour ajouter une photo</div><div class="upload-sub">JPG, PNG recommandé</div><input type="file" id="c-photo" accept="image/*" style="display:none" onchange="previewPhoto()"></div>';
  html+='<div id="photo-preview" style="display:none;margin-bottom:12px"><img id="preview-img" style="width:100%;border-radius:12px;max-height:200px;object-fit:cover"><button class="btn btn-ghost" style="margin-top:8px" onclick="removePhoto()">🗑 Supprimer</button></div>';
  html+='<button class="btn btn-primary btn-full" onclick="submitPay()">📤 Envoyer la demande</button></div></div>';
  c.innerHTML=html;selPlanName='100 Go';
}

function selPlan(el,name){document.querySelectorAll('.plan-card').forEach(c=>c.classList.remove('selected'));el.classList.add('selected');selPlanName=name;}
function previewPhoto(){const f=document.getElementById('c-photo').files[0];if(!f)return;const r=new FileReader();r.onload=e=>{photoData=e.target.result;document.getElementById('preview-img').src=photoData;document.getElementById('photo-preview').style.display='block';document.getElementById('upload-zone').style.display='none';};r.readAsDataURL(f);}
function removePhoto(){photoData=null;document.getElementById('c-photo').value='';document.getElementById('photo-preview').style.display='none';document.getElementById('upload-zone').style.display='block';}

async function submitPay(){
  const d=document.getElementById('c-paydate').value;
  if(!d){toast('⚠️ Veuillez indiquer la date du paiement.','error');return;}
  const prices={'100 Go':'40.000','200 Go':'55.000','Illimité 5 appareils':'65.000','Illimité 9+ appareils':'90.000'};
  try{
    await sbPost('payments',{client_id:me.id,client_name:me.name,plan:selPlanName,amount:prices[selPlanName],payment_date:d,reference:document.getElementById('c-payref').value||null,status:'pending',photo_url:photoData});
    await sbPatch('clients','id=eq.'+me.id,{status:'pending'});
    me.status='pending';photoData=null;
    launchConfetti();
    showModal('<div style="text-align:center;padding:16px"><div style="font-size:56px;margin-bottom:16px">🎉</div><div class="modal-title" style="justify-content:center;margin-bottom:8px">Demande envoyée !</div><p style="color:var(--text2);font-size:13px;margin-bottom:20px">Merci pour votre confiance ! L\'administrateur va valider votre paiement et vous envoyer votre ticket Mikrotik très vite.</p><button class="btn btn-primary btn-full" onclick="closeModal();cPage(\'home\',document.getElementById(\'cnav-home\'))">Génial, merci ! ✓</button></div>');
  }catch(e){toast('Erreur lors de l\'envoi. Réessayez.','error');}
}

async function renderClientMessages(){
  document.getElementById('c-msg-dot').style.display='none';
  const c=document.getElementById('c-content');
  try{
    const msgs=await sbGet('messages','client_id=eq.'+me.id+'&order=created_at.asc');
    let html='<div class="fade-up"><div class="page-header"><div class="page-title">💬 Messages</div><div class="page-sub">Support NTY Starnet</div></div>';

    // ═══ TABS : Bot / Admin ═══
    html+='<div class="chat-tabs"><button class="chat-tab active" id="tab-bot" onclick="switchChatTab(\'bot\')">🤖 Assistant</button><button class="chat-tab" id="tab-admin" onclick="switchChatTab(\'admin\')">👨‍💼 Admin</button></div>';

    // ═══ BOT CHAT ═══
    html+='<div id="chat-bot-panel"><div class="chat-card"><div class="chat-header"><div class="chat-avatar">🤖</div><div><div class="chat-name">Assistant NTY Starnet</div><div class="chat-status" style="color:var(--accent2)">● Disponible 24h/24</div></div></div>';
    html+='<div class="msg-list" id="bot-msg-list">';
    const botMsgs=JSON.parse(localStorage.getItem('nty_bot_msgs_'+me.id)||'[]');
    if(!botMsgs.length){
      html+='<div class="msg-wrap msg-recv"><div class="bubble bubble-recv">'+formatBotMsg(botReply('bonjour'))+'</div></div>';
    } else {
      botMsgs.forEach(m=>{
        if(m.type==='image'){
          html+='<div class="msg-wrap msg-sent"><img src="'+m.url+'" class="chat-img-preview"><div class="msg-time">'+m.time+'</div></div>';
        } else {
          html+='<div class="msg-wrap msg-'+(m.from==='user'?'sent':'recv')+'"><div class="bubble bubble-'+(m.from==='user'?'sent':'recv')+'">'+formatBotMsg(m.text)+'</div><div class="msg-time">'+m.time+'</div></div>';
        }
      });
    }
    html+='</div>';
    html+='<div class="chat-inp-wrap">';
    html+='<div class="chat-inp">';
    html+='<button class="chat-photo-btn" onclick="document.getElementById(\'bot-photo-inp\').click()" title="Envoyer une photo">📷</button>';
    html+='<input type="file" id="bot-photo-inp" accept="image/*" style="display:none" onchange="sendBotPhoto()">';
    html+='<input class="chat-inp-field" type="text" id="bot-msg-inp" placeholder="Ex: comment se connecter ?" onkeydown="if(event.key===\'Enter\')sendBotMsg()">';
    html+='<button class="chat-send-btn" onclick="sendBotMsg()">→</button>';
    html+='</div></div></div></div>';

    // ═══ ADMIN CHAT ═══
    html+='<div id="chat-admin-panel" style="display:none"><div class="chat-card"><div class="chat-header"><div class="chat-avatar">🛜</div><div><div class="chat-name">NTY Starnet Admin</div><div class="chat-status">● En ligne</div></div></div>';
    html+='<div class="msg-list" id="c-msg-list">';
    if(!msgs.length)html+='<div class="empty"><div class="empty-icon">💬</div><p>Posez votre question à l administrateur !</p></div>';
    else msgs.forEach(m=>{
      const mine=m.sender==='client';
      if(m.content&&m.content.startsWith('[IMG]')){
        const imgUrl=m.content.replace('[IMG]','');
        html+='<div class="msg-wrap msg-'+(mine?'sent':'recv')+'"><img src="'+imgUrl+'" class="chat-img-preview"><div class="msg-time">'+new Date(m.created_at).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})+'</div></div>';
      } else {
        html+='<div class="msg-wrap msg-'+(mine?'sent':'recv')+'"><div class="bubble bubble-'+(mine?'sent':'recv')+'">'+m.content.replace(/\n/g,'<br>')+'</div><div class="msg-time">'+new Date(m.created_at).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})+'</div></div>';
      }
    });
    html+='</div>';
    html+='<div class="chat-inp-wrap">';
    html+='<div class="chat-inp">';
    html+='<button class="chat-photo-btn" onclick="document.getElementById(\'admin-photo-inp\').click()" title="Envoyer une photo">📷</button>';
    html+='<input type="file" id="admin-photo-inp" accept="image/*" style="display:none" onchange="sendAdminPhoto()">';
    html+='<input class="chat-inp-field" type="text" id="c-msg-inp" placeholder="Message ou envoyez une photo..." onkeydown="if(event.key===\'Enter\')cSendMsg()">';
    html+='<button class="chat-send-btn" onclick="cSendMsg()">→</button>';
    html+='</div></div></div></div>';

    html+='</div>';
    c.innerHTML=html;
    const el=document.getElementById('bot-msg-list');if(el)el.scrollTop=el.scrollHeight;
    const el2=document.getElementById('c-msg-list');if(el2)el2.scrollTop=el2.scrollHeight;
  }catch(e){c.innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><p>Erreur</p></div>';}
}

function switchChatTab(tab){
  document.getElementById('tab-bot').classList.toggle('active',tab==='bot');
  document.getElementById('tab-admin').classList.toggle('active',tab==='admin');
  document.getElementById('chat-bot-panel').style.display=tab==='bot'?'block':'none';
  document.getElementById('chat-admin-panel').style.display=tab==='admin'?'block':'none';
}

function sendBotMsg(){
  const inp=document.getElementById('bot-msg-inp');
  if(!inp||!inp.value.trim())return;
  const userText=inp.value.trim();inp.value='';
  const botMsgs=JSON.parse(localStorage.getItem('nty_bot_msgs_'+me.id)||'[]');
  botMsgs.push({from:'user',text:userText,time:now()});
  const reply=botReply(userText);
  botMsgs.push({from:'bot',text:reply,time:now()});
  if(botMsgs.length>50)botMsgs.splice(0,botMsgs.length-50);
  localStorage.setItem('nty_bot_msgs_'+me.id,JSON.stringify(botMsgs));
  renderClientMessages();
  setTimeout(()=>{switchChatTab('bot');const el=document.getElementById('bot-msg-list');if(el)el.scrollTop=el.scrollHeight;},100);
}

function sendBotPhoto(){
  const f=document.getElementById('bot-photo-inp').files[0];
  if(!f)return;
  const r=new FileReader();
  r.onload=e=>{
    const url=e.target.result;
    const botMsgs=JSON.parse(localStorage.getItem('nty_bot_msgs_'+me.id)||'[]');
    botMsgs.push({from:'user',type:'image',url:url,time:now()});
    // Bot répond avec analyse guidée
    const botResp=`📸 **J'ai bien reçu votre capture d'écran !**

Pour vous aider au mieux, dites-moi :
• Quel appareil utilisez-vous ? (téléphone, PC, capteur...)
• Quelle marque ? (TP-Link, Comfast, Tenda, Android, iPhone...)
• Quel message d'erreur voyez-vous exactement ?

En attendant, voici les vérifications rapides :

1. **Page blanche ?** → Tapez \`192.168.0.1\` dans votre navigateur
2. **Erreur "site inaccessible" ?** → Vérifiez que vous êtes connecté au WiFi NTY Starnet
3. **Page de login qui n\'accepte pas ?** → Vérifiez votre ticket dans l\'onglet Accueil

💡 Si votre problème persiste, envoyez aussi cette capture à l\'administrateur via l\'onglet **👨‍💼 Admin** pour une aide personnalisée !`;
    botMsgs.push({from:'bot',text:botResp,time:now()});
    if(botMsgs.length>50)botMsgs.splice(0,botMsgs.length-50);
    localStorage.setItem('nty_bot_msgs_'+me.id,JSON.stringify(botMsgs));
    renderClientMessages();
    setTimeout(()=>{switchChatTab('bot');const el=document.getElementById('bot-msg-list');if(el)el.scrollTop=el.scrollHeight;},100);
  };
  r.readAsDataURL(f);
}

async function sendAdminPhoto(){
  const f=document.getElementById('admin-photo-inp').files[0];
  if(!f)return;
  if(f.size>5*1024*1024){toast('Image trop grande (max 5MB)','error');return;}
  const r=new FileReader();
  r.onload=async e=>{
    const url=e.target.result;
    try{
      await sbPost('messages',{client_id:me.id,sender:'client',sender_name:me.name,content:'[IMG]'+url});
      toast('📷 Photo envoyée à l\'administrateur !');
      renderClientMessages();
      setTimeout(()=>switchChatTab('admin'),100);
    }catch(err){toast('Erreur envoi photo','error');}
  };
  r.readAsDataURL(f);
}

async function cSendMsg(){
  const inp=document.getElementById('c-msg-inp');if(!inp||!inp.value.trim())return;
  const txt=inp.value.trim();inp.value='';
  try{await sbPost('messages',{client_id:me.id,sender:'client',sender_name:me.name,content:txt});renderClientMessages();}
  catch(e){inp.value=txt;toast('Erreur envoi','error');}
}

function renderClientProfil(){
  const u=me;const c=document.getElementById('c-content');
  const joinDays=u.join_date?Math.floor((new Date()-new Date(u.join_date))/(1000*60*60*24)):0;
  let loyaltyBadge='';
  if(joinDays>=365)loyaltyBadge='<div class="loyalty-badge loyalty-legend">👑 Légende NTY</div>';
  else if(joinDays>=180)loyaltyBadge='<div class="loyalty-badge loyalty-vip">💎 Client VIP</div>';
  else if(joinDays>=90)loyaltyBadge='<div class="loyalty-badge loyalty-fidele">⭐ Client fidèle</div>';
  else loyaltyBadge='<div class="loyalty-badge loyalty-new">🌱 Nouveau membre</div>';
  let html='<div class="fade-up"><div class="profile-hero" onclick="easterEgg(this)"><div class="profile-avatar">'+initials(u.name)+'</div><div class="profile-name">'+u.name+'</div><div class="profile-username">@'+u.username+'</div>'+loyaltyBadge+'<div style="margin-top:8px"><span class="badge badge-'+(u.status||'pending')+'">'+({active:'✅ Actif',expired:'❌ Expiré',pending:'⏳ En attente'}[u.status||'pending'])+'</span></div></div>';
  if(joinDays>0){
    const hoursConnected=Math.round(joinDays*24*0.7);
    html+='<div class="fun-stat-card">🔌 Vous êtes avec nous depuis <strong>'+joinDays+' jour'+(joinDays>1?'s':'')+'</strong> — ça représente environ <strong>'+hoursConnected.toLocaleString('fr')+' heures</strong> de connexion potentielle ! ⚡</div>';
  }
  html+='<div class="section-card"><div class="section-head">Informations</div><div class="info-row"><div class="info-key">📞 Téléphone</div><div class="info-val">'+(u.phone||'—')+'</div></div><div class="info-row"><div class="info-key">📦 Plan</div><div class="info-val">'+(u.plan||'—')+'</div></div><div class="info-row"><div class="info-key">📅 Début</div><div class="info-val">'+fmtDate(u.start_date)+'</div></div><div class="info-row"><div class="info-key">📅 Fin</div><div class="info-val">'+(u.expiry_date?fmtDate(u.expiry_date)+' à 23h59':'—')+'</div></div><div class="info-row"><div class="info-key">🗓 Membre depuis</div><div class="info-val">'+fmtDate(u.join_date)+'</div></div></div>';
  html+='<div class="section-card"><div class="section-head">🔐 Sécurité</div><button class="btn btn-ghost btn-full" onclick="showChangePass()">Changer mon mot de passe</button></div>';
  html+='<button class="btn btn-danger btn-full" style="margin-top:8px" onclick="logout()">🚪 Se déconnecter</button></div>';
  c.innerHTML=html;
}

function showChangePass(){
  showModal('<div class="modal-title">🔐 Changer le mot de passe <button class="modal-close" onclick="closeModal()">×</button></div><label class="inp-label">Mot de passe actuel</label><input class="inp" type="password" id="old-pass" placeholder="••••••••"><label class="inp-label">Nouveau mot de passe</label><input class="inp" type="password" id="new-pass" placeholder="••••••••"><label class="inp-label">Confirmer</label><input class="inp" type="password" id="conf-pass" placeholder="••••••••"><button class="btn btn-primary btn-full" onclick="changePass()">Changer</button><button class="btn btn-ghost btn-full" onclick="closeModal()">Annuler</button>');
}

async function changePass(){
  const old=document.getElementById('old-pass').value;
  const n=document.getElementById('new-pass').value;
  const conf=document.getElementById('conf-pass').value;
  if(old!==me.password){toast('Mot de passe actuel incorrect','error');return;}
  if(n.length<4){toast('Minimum 4 caractères','error');return;}
  if(n!==conf){toast('Les mots de passe ne correspondent pas','error');return;}
  try{
    const table=me.role==='admin'?'admins':'clients';
    await sbPatch(table,'id=eq.'+me.id,{password:n});
    me.password=n;closeModal();toast('✅ Mot de passe modifié !');
  }catch(e){toast('Erreur','error');}
}

// ═══════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════

function aPage(page,btn){
  document.querySelectorAll('#page-admin .nav-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  const c=document.getElementById('a-content');loading(c);
  requestAnimationFrame(()=>{
    if(page==='dashboard')renderAdminDashboard();
    else if(page==='clients')renderAdminClients();
    else if(page==='paiements')renderAdminPaiements();
    else if(page==='messages')renderAdminMessages();
    else if(page==='stats')renderAdminStats();
  });
}

async function renderAdminDashboard(){
  const c=document.getElementById('a-content');
  try{
    const [clients,payments]=await Promise.all([sbGet('clients'),sbGet('payments','order=created_at.desc')]);
    const pPending=payments.filter(p=>p.status==='pending');
    const revenue=payments.filter(p=>p.status==='validated').reduce((s,p)=>s+(parseInt((p.amount||'0').replace('.',''))||0),0);
    const dot=document.getElementById('a-pay-dot');if(dot)dot.style.display=pPending.length>0?'block':'none';
    const soon=clients.filter(x=>{const dl=daysLeft(x.expiry_date);return dl!==null&&dl>=0&&dl<=5;});

    let html='<div class="fade-up"><div class="page-header"><div class="page-title">📊 Dashboard</div><div class="page-sub">Vue d\'ensemble NTY Starnet</div></div>';

    // ═══ BOUTON COUPURE ÉLECTRIQUE PAR ZONE ═══
    let zones=[];
    try{zones=await sbGet('zones','order=name.asc');}catch(e){}
    const coupureZones=JSON.parse(localStorage.getItem('nty_coupure_zones')||'{}');
    html+='<div class="coupure-panel-wrap"><div class="coupure-panel-title">⚡ Gestion des coupures électriques</div>';
    html+='<div class="zone-grid">';
    zones.forEach(z=>{
      const isOn=coupureZones[z.name]===true;
      html+='<div class="zone-coupure-card '+(isOn?'zone-on':'zone-off')+'"><div class="zone-card-top"><div class="zone-icon">'+(isOn?'🔴':'🟢')+'</div><div><div class="zone-name">'+z.name+'</div><div class="zone-status">'+(isOn?'Coupure active':'Normal')+'</div></div></div>';
      html+='<div style="display:flex;gap:6px;margin-top:10px">';
      if(isOn){
        html+='<button class="btn btn-success" style="flex:1;padding:8px;margin:0;font-size:12px" onclick="toggleZoneCoupure(\''+z.name+'\',false)">🟢 Rétablir</button>';
      } else {
        html+='<button class="btn btn-danger" style="flex:1;padding:8px;margin:0;font-size:12px" onclick="toggleZoneCoupure(\''+z.name+'\',true)">🔴 Coupure</button>';
      }
      html+='<button class="btn btn-ghost" style="width:auto;padding:8px 10px;margin:0;font-size:12px" onclick="showCoupureEdit(\''+z.name+'\')">✏️</button>';
      html+='</div></div>';
    });
    html+='</div>';
    html+='<button class="btn btn-ghost btn-full" style="margin-top:8px" onclick="showZoneManager()">⚙️ Gérer les zones</button>';
    html+='</div>';

    // ═══ REVENUE ═══
    html+='<div class="revenue-hero"><div class="revenue-label">💰 REVENUS TOTAUX VALIDÉS</div><div class="revenue-amount">'+revenue.toLocaleString('fr')+' <span>Ar</span></div><div class="revenue-sub">'+payments.filter(p=>p.status==='validated').length+' paiements · '+clients.filter(x=>x.status==='active').length+' clients actifs</div></div>';

    // ═══ STATS ═══
    html+='<div class="stats-grid"><div class="stat-card-admin"><div class="stat-card-num" style="color:var(--accent)">'+clients.length+'</div><div class="stat-card-lbl">Total clients</div></div><div class="stat-card-admin"><div class="stat-card-num" style="color:var(--success)">'+clients.filter(x=>x.status==='active').length+'</div><div class="stat-card-lbl">Actifs</div></div><div class="stat-card-admin"><div class="stat-card-num" style="color:var(--warning)">'+pPending.length+'</div><div class="stat-card-lbl">Paiements en attente</div></div><div class="stat-card-admin"><div class="stat-card-num" style="color:var(--danger)">'+clients.filter(x=>x.status==='expired').length+'</div><div class="stat-card-lbl">Expirés</div></div></div>';

    // ═══ PAIEMENTS EN ATTENTE ═══
    if(pPending.length>0){
      html+='<div class="section-card"><div class="section-head-row"><div class="section-head">🔔 Paiements en attente</div><span class="count-badge">'+pPending.length+'</span></div>';
      for(const p of pPending.slice(0,3)){
        const cT=await sbGet('tickets','client_id=eq.'+p.client_id+'&is_used=eq.false&order=created_at.asc&limit=1');
        const next=cT[0];
        html+='<div class="pay-item"><div class="pay-item-top"><div><div class="pay-item-name">'+p.client_name+'</div><div class="pay-item-sub">'+p.plan+' · '+fmtDate(p.payment_date)+'</div>'+(next?'<div class="pay-item-ticket">🎫 '+next.code+'</div>':'<div class="pay-item-notick">⚠️ Aucun ticket dispo</div>')+'</div><div class="pay-item-amount">'+(p.amount||'—')+' Ar</div></div><div class="pay-item-btns"><button class="btn btn-success" style="flex:2;padding:10px;margin:0;font-size:13px" onclick="openValidate(\''+p.id+'\')">✓ Valider</button><button class="btn btn-danger" style="flex:1;padding:10px;margin:0;font-size:13px" onclick="curPayId=\''+p.id+'\';rejectConfirm()">✗</button></div></div>';
      }
      html+='</div>';
    }

    // ═══ EXPIRENT BIENTÔT ═══
    if(soon.length>0){
      html+='<div class="section-card"><div class="section-head">⏰ Expirent dans 5 jours ou moins</div>';
      soon.forEach(x=>{const dl=daysLeft(x.expiry_date);html+='<div class="info-row"><div class="info-key"><div style="font-weight:600">'+x.name+'</div><div style="font-size:11px;color:var(--text3)">'+x.plan+' · expire le '+fmtDate(x.expiry_date)+'</div></div><div class="info-val" style="color:var(--warning);font-family:var(--mono);font-weight:700">'+dl+'j</div></div>';});
      html+='</div>';
    }
    html+='</div>';
    c.innerHTML=html;
  }catch(e){c.innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><p>Erreur<br><button class="btn btn-ghost" onclick="aPage(\'dashboard\',null)" style="margin-top:12px;width:auto;padding:10px 20px">Réessayer</button></p></div>';}
}

function toggleZoneCoupure(zoneName,active){
  const zones=JSON.parse(localStorage.getItem('nty_coupure_zones')||'{}');
  zones[zoneName]=active;
  localStorage.setItem('nty_coupure_zones',JSON.stringify(zones));
  // Mettre à jour coupureActive global (true si au moins une zone a une coupure)
  coupureActive=Object.values(zones).some(v=>v===true);
  localStorage.setItem('nty_coupure',coupureActive.toString());
  toast(active?'🔴 Coupure activée pour '+zoneName+'!':'🟢 Connexion rétablie pour '+zoneName+'!',active?'error':'success');
  aPage('dashboard',null);
}

function toggleCoupure(active){
  coupureActive=active;
  localStorage.setItem('nty_coupure',active.toString());
  toast(active?'🔴 Alerte coupure activée !':'🟢 Connexion rétablie !',active?'error':'success');
  aPage('dashboard',null);
}

function showCoupureEdit(zoneName){
  const zoneKey='nty_coupure_msg_'+(zoneName||'default');
  const currentMsg=localStorage.getItem(zoneKey)||'⚡ Coupure électrique en cours dans votre zone — La connexion WiFi sera rétablie dès le retour du courant.';
  showModal('<div class="modal-title">✏️ Message pour '+(zoneName||'tous')+' <button class="modal-close" onclick="closeModal()">×</button></div><p style="font-size:13px;color:var(--text2);margin-bottom:14px">Ce message s\'affichera uniquement aux clients de la zone <strong>'+(zoneName||'tous')+'</strong>.</p><label class="inp-label">Choisir un message prédéfini</label><div class="preset-list"><div class="preset-item" onclick="setPreset(this,\'⚡ Coupure électrique en cours — La connexion WiFi est temporairement indisponible. Nous travaillons à rétablir le service.\')">⚡ Coupure électrique générale</div><div class="preset-item" onclick="setPreset(this,\'🔧 Maintenance en cours — Votre connexion WiFi sera rétablie dans quelques heures. Merci pour votre patience.\')">🔧 Maintenance technique</div><div class="preset-item" onclick="setPreset(this,\'🌩️ Panne due aux conditions météorologiques — La connexion sera rétablie dès que possible.\')">🌩️ Panne météo</div><div class="preset-item" onclick="setPreset(this,\'⚡ Coupure électrique dans votre zone — La connexion WiFi reprendra automatiquement dès le retour du courant.\')">⚡ Coupure zone spécifique</div></div><label class="inp-label" style="margin-top:14px">Ou écrire un message personnalisé</label><textarea class="inp" id="coupure-msg-inp" rows="3">'+currentMsg+'</textarea><button class="btn btn-primary btn-full" onclick="saveCoupureMsg(\''+zoneKey+'\')">💾 Enregistrer</button><button class="btn btn-ghost btn-full" onclick="closeModal()">Annuler</button>');
}

function setPreset(el,msg){
  document.querySelectorAll('.preset-item').forEach(i=>i.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('coupure-msg-inp').value=msg;
}

function saveCoupureMsg(zoneKey){
  const msg=document.getElementById('coupure-msg-inp').value.trim();
  if(!msg){toast('Entrez un message','error');return;}
  localStorage.setItem(zoneKey||'nty_coupure_msg',msg);
  if(!zoneKey)coupureMsg=msg;
  closeModal();toast('✅ Message enregistré !');
}

async function renderAdminClients(search=''){
  const c=document.getElementById('a-content');
  try{
    let q='order=created_at.desc';
    if(search)q+='&or=(name.ilike.*'+search+'*,username.ilike.*'+search+'*)';
    // Charge clients ET tous les tickets dispo en parallèle (2 appels au lieu de N+1)
    const [clients,allFreeTickets]=await Promise.all([sbGet('clients',q),sbGet('tickets','is_used=eq.false')]);
    const ticketCountByClient={};
    allFreeTickets.forEach(t=>{ticketCountByClient[t.client_id]=(ticketCountByClient[t.client_id]||0)+1;});

    let html='<div class="fade-up"><div class="page-header-row"><div><div class="page-title">👥 Clients</div><div class="page-sub">'+clients.length+' client(s)</div></div><button class="btn btn-primary btn-sm" onclick="showAddClient()">+ Ajouter</button></div>';
    html+='<div class="search-box"><span class="search-icon">🔍</span><input class="search-inp" type="text" placeholder="Rechercher..." value="'+search+'" oninput="renderAdminClients(this.value)"></div>';
    if(!clients.length)html+='<div class="empty"><div class="empty-icon">👤</div><p>Aucun client</p></div>';
    else{
      html+='<div class="client-list">';
      for(const cl of clients){
        const tixCount=ticketCountByClient[cl.id]||0;
        const dl=daysLeft(cl.expiry_date);
        html+='<div class="client-card" onclick="openDetail(\''+cl.id+'\')"><div class="client-avatar">'+initials(cl.name)+'</div><div class="client-info"><div class="client-name">'+cl.name+'</div><div class="client-meta">📍 '+(cl.zone||'—')+' · @'+cl.username+' · '+tixCount+' ticket(s) · '+(dl!==null&&dl>=0?dl+'j':'—')+'</div></div><div class="client-right"><span class="badge badge-'+(cl.status||'pending')+'">'+({active:'Actif',expired:'Expiré',pending:'En attente'}[cl.status||'pending'])+'</span><div class="client-arrow">›</div></div></div>';
      }
      html+='</div>';
    }
    html+='</div>';c.innerHTML=html;
  }catch(e){c.innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><p>Erreur</p></div>';}
}

async function renderAdminPaiements(filter='pending'){
  const c=document.getElementById('a-content');
  try{
    let q='order=created_at.desc';if(filter)q+='&status=eq.'+filter;
    // Charge paiements ET tickets disponibles en parallèle (1 seul appel au lieu d'un par paiement)
    const [pays,freeTickets]=await Promise.all([
      sbGet('payments',q),
      filter==='pending'||filter===''?sbGet('tickets','is_used=eq.false&order=created_at.asc'):Promise.resolve([])
    ]);
    // Map client_id -> premier ticket dispo
    const nextTicketByClient={};
    freeTickets.forEach(t=>{if(!nextTicketByClient[t.client_id])nextTicketByClient[t.client_id]=t;});

    let html='<div class="fade-up"><div class="page-header"><div class="page-title">💳 Paiements</div></div>';
    html+='<div class="filter-tabs"><button class="ftab '+(filter==='pending'?'active':'')+'" onclick="renderAdminPaiements(\'pending\')">En attente</button><button class="ftab '+(filter==='validated'?'active':'')+'" onclick="renderAdminPaiements(\'validated\')">Validés</button><button class="ftab '+(filter===''?'active':'')+'" onclick="renderAdminPaiements(\'\')">Tous</button></div>';
    if(!pays.length)html+='<div class="empty"><div class="empty-icon">💳</div><p>Aucun paiement</p></div>';
    else for(const p of pays){
      const next=p.status==='pending'?nextTicketByClient[p.client_id]:null;
      html+='<div class="pay-card"><div class="pay-card-top"><div><div class="pay-card-name">'+p.client_name+'</div><div class="pay-card-sub">'+p.plan+' · '+fmtDate(p.payment_date)+'</div><div class="pay-card-ref">Réf: '+(p.reference||'—')+'</div></div><div class="pay-card-right"><div class="pay-card-amount">'+(p.amount||'—')+' Ar</div><span class="badge badge-'+p.status+'">'+({validated:'✅ Validé',pending:'⏳ En attente',rejected:'❌ Refusé'}[p.status])+'</span></div></div>';
      if(p.status==='pending'){
        html+=(next?'<div class="ticket-preview">🎫 Prochain ticket: <strong>'+next.code+'</strong></div>':'<div class="ticket-preview" style="color:var(--danger)">⚠️ Aucun ticket disponible</div>');
        html+='<div class="pay-card-btns"><button class="btn btn-success" style="flex:2;padding:10px;margin:0;font-size:13px" onclick="openValidate(\''+p.id+'\')">✓ Valider + Envoyer ticket</button><button class="btn btn-danger" style="flex:1;padding:10px;margin:0;font-size:13px" onclick="curPayId=\''+p.id+'\';rejectConfirm()">✗</button></div>';
      }
      if(p.photo_url)html+='<button class="btn btn-ghost" style="margin-top:8px;padding:8px;font-size:12px;width:auto" onclick="showModal(\'<div class=modal-title>Preuve <button class=modal-close onclick=closeModal()>×</button></div><img src=&quot;'+p.photo_url+'&quot; style=&quot;width:100%;border-radius:12px&quot;>\')">📷 Voir la preuve</button>';
      html+='</div>';
    }
    html+='</div>';c.innerHTML=html;
  }catch(e){c.innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><p>Erreur</p></div>';}
}

async function openValidate(payId){
  curPayId=payId;
  try{
    const pays=await sbGet('payments','id=eq.'+payId);const pay=pays[0];
    const cT=await sbGet('tickets','client_id=eq.'+pay.client_id+'&is_used=eq.false&order=created_at.asc&limit=1');const next=cT[0];
    let html='<div class="modal-title">✅ Valider le paiement <button class="modal-close" onclick="closeModal()">×</button></div>';
    html+='<div class="modal-client">Client : <strong>'+pay.client_name+'</strong></div>';
    html+=[['Plan',pay.plan],['Montant',(pay.amount||'—')+' Ar'],['Date paiement',fmtDate(pay.payment_date)],['Référence',pay.reference||'—']].map(([k,v])=>'<div class="info-row"><div class="info-key">'+k+'</div><div class="info-val">'+v+'</div></div>').join('');
    if(pay.photo_url)html+='<div style="margin:12px 0"><div class="inp-label">Preuve</div><img src="'+pay.photo_url+'" style="width:100%;border-radius:12px;max-height:180px;object-fit:cover"></div>';
    html+='<div class="ticket-preview-big">'+(next?'<div class="tp-label">🎫 TICKET QUI SERA ENVOYÉ</div><div class="tp-code">'+next.code+'</div>':'<div style="color:var(--danger);font-size:13px">⚠️ Aucun ticket. Ajoutez-en dans la fiche client.</div>')+'</div>';
    if(next)html+='<button class="btn btn-success btn-full" onclick="validatePay(\''+payId+'\',\''+next.id+'\',\''+next.code+'\',\''+pay.client_id+'\')">✓ Valider et envoyer le ticket</button>';
    html+='<button class="btn btn-danger btn-full" onclick="closeModal();rejectConfirm()">✗ Refuser</button><button class="btn btn-ghost btn-full" onclick="closeModal()">Annuler</button>';
    showModal(html);
  }catch(e){toast('Erreur chargement','error');}
}

async function validatePay(payId,ticketId,ticketCode,clientId){
  try{
    const startDate=today();
    const endDate=addDays(startDate,29);
    const startFmt=fmtDateFull(startDate);
    const endFmt=fmtDateFull(endDate);
    await Promise.all([
      sbPatch('payments','id=eq.'+payId,{status:'validated'}),
      sbPatch('tickets','id=eq.'+ticketId,{is_used:true,is_current:true}),
      sbPatch('clients','id=eq.'+clientId,{status:'active',current_ticket:ticketCode,start_date:startDate,expiry_date:endDate}),
      sbPost('messages',{client_id:clientId,sender:'admin',sender_name:'Admin',content:'✅ Paiement validé !\n\n🎫 Votre ticket Mikrotik : '+ticketCode+'\n\n📅 Valable du '+startFmt+' au '+endFmt+' à 23h59.\n\nConnectez-vous avec ce code sur le réseau NTY Starnet. 🌐'})
    ]);
    closeModal();
    showModal('<div style="text-align:center;padding:16px"><div style="font-size:56px;margin-bottom:12px">🎉</div><div class="modal-title" style="justify-content:center;margin-bottom:8px">Ticket envoyé !</div><div class="ticket-preview-big"><div class="tp-label">TICKET ENVOYÉ</div><div class="tp-code">'+ticketCode+'</div><div style="font-size:12px;color:var(--text3);margin-top:8px">Du '+startFmt+' au '+endFmt+' à 23h59</div></div><button class="btn btn-primary btn-full" onclick="closeModal();aPage(\'paiements\',null)">OK ✓</button></div>');
  }catch(e){toast('Erreur lors de la validation','error');}
}

function rejectConfirm(){
  showModal('<div class="modal-title">❌ Refuser <button class="modal-close" onclick="closeModal()">×</button></div><p style="font-size:13px;color:var(--text2);margin-bottom:14px">Le client recevra un message de refus.</p><label class="inp-label">Motif (optionnel)</label><input class="inp" type="text" id="reject-reason" placeholder="Ex: Référence incorrecte, montant insuffisant..."><button class="btn btn-danger btn-full" onclick="doReject()">✗ Confirmer</button><button class="btn btn-ghost btn-full" onclick="closeModal()">Annuler</button>');
}

async function doReject(){
  const reason=document.getElementById('reject-reason')?.value||'';
  try{
    const pays=await sbGet('payments','id=eq.'+curPayId);const pay=pays[0];
    await Promise.all([
      sbPatch('payments','id=eq.'+curPayId,{status:'rejected'}),
      sbPost('messages',{client_id:pay.client_id,sender:'admin',sender_name:'Admin',content:'❌ Votre paiement du '+fmtDate(pay.payment_date)+' a été refusé.'+(reason?'\n\nMotif: '+reason:'')+'\n\nContactez-nous pour plus d\'informations.'})
    ]);
    closeModal();toast('Paiement refusé');aPage('paiements',null);
  }catch(e){toast('Erreur','error');}
}

async function openDetail(id){
  curDetailId=id;
  try{
    const [clients,tickets]=await Promise.all([sbGet('clients','id=eq.'+id),sbGet('tickets','client_id=eq.'+id+'&order=created_at.asc')]);
    const cl=clients[0];const freeT=tickets.filter(t=>!t.is_used);const dl=daysLeft(cl.expiry_date);
    let html='<div class="modal-title"><div style="display:flex;align-items:center;gap:10px"><div class="modal-avatar">'+initials(cl.name)+'</div><div><div>'+cl.name+'</div><div style="font-size:11px;color:var(--text3)">@'+cl.username+'</div></div></div><button class="modal-close" onclick="closeModal()">×</button></div>';
    html+='<div class="dtabs"><button class="dtab active" onclick="dtab(\'info\',this)">Infos</button><button class="dtab" onclick="dtab(\'tickets\',this)">Tickets ('+freeT.length+')</button><button class="dtab" onclick="dtab(\'edit\',this)">Modifier</button></div>';
    html+='<div id="dt-info">';
    html+=[['Statut','<span class="badge badge-'+(cl.status||'pending')+'">'+({active:'✅ Actif',expired:'❌ Expiré',pending:'⏳ En attente'}[cl.status||'pending'])+'</span>'],['Zone','📍 '+(cl.zone||'—')],['Plan',cl.plan||'—'],['Prix',(cl.plan_price||'—')+' Ar/mois'],['Début',fmtDate(cl.start_date)],['Fin',(cl.expiry_date?fmtDate(cl.expiry_date)+' à 23h59':'—')],['Jours restants',dl!==null&&dl>=0?dl+' jours':'—'],['Tickets dispo',freeT.length+' / '+tickets.length],['Téléphone',cl.phone||'—']].map(([k,v])=>'<div class="info-row"><div class="info-key">'+k+'</div><div class="info-val">'+v+'</div></div>').join('');
    html+='<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-success" style="flex:1;padding:10px;margin:0;font-size:13px" onclick="quickStatus(\''+id+'\',\'active\')">✓ Activer</button><button class="btn btn-danger" style="flex:1;padding:10px;margin:0;font-size:13px" onclick="quickStatus(\''+id+'\',\'expired\')">✗ Expirer</button></div>';
    if(cl.plan==='100 Go'||cl.plan==='200 Go'){
      html+='<div class="divider"></div><div class="inp-label">📊 Consommation de données ('+cl.plan+')</div><div style="display:flex;gap:8px;margin-bottom:8px"><button class="btn '+(cl.consumption_pct=='25'?'btn-primary':'btn-ghost')+'" style="flex:1;padding:9px;margin:0;font-size:13px" onclick="setConsumption(\''+id+'\',25)">25%</button><button class="btn '+(cl.consumption_pct=='50'?'btn-primary':'btn-ghost')+'" style="flex:1;padding:9px;margin:0;font-size:13px" onclick="setConsumption(\''+id+'\',50)">50%</button><button class="btn '+(cl.consumption_pct=='75'?'btn-primary':'btn-ghost')+'" style="flex:1;padding:9px;margin:0;font-size:13px" onclick="setConsumption(\''+id+'\',75)">75%</button><button class="btn '+(cl.consumption_pct=='90'?'btn-primary':'btn-ghost')+'" style="flex:1;padding:9px;margin:0;font-size:13px" onclick="setConsumption(\''+id+'\',90)">90%</button></div><button class="btn btn-ghost btn-full" style="margin-bottom:8px" onclick="setConsumption(\''+id+'\',0)">↺ Réinitialiser (nouveau cycle)</button>';
    }
    html+='<button class="btn" style="margin-top:4px;background:rgba(239,68,68,0.1);color:var(--danger);border:1px solid rgba(239,68,68,0.2);width:100%" onclick="deleteClient(\''+id+'\',\''+cl.name+'\')">🗑 Supprimer ce client</button></div>';
    html+='<div id="dt-tickets" style="display:none"><label class="inp-label">Ajouter des tickets (un par ligne)</label><textarea class="inp" id="new-tickets-inp" placeholder="ABC123-XYZ&#10;DEF456-UVW&#10;..."></textarea><button class="btn btn-success btn-full" onclick="addMoreTickets(\''+id+'\')">+ Ajouter</button><div style="margin-top:12px">';
    if(!tickets.length)html+='<div class="empty"><div class="empty-icon">🎫</div><p>Aucun ticket</p></div>';
    else tickets.forEach((t,i)=>{html+='<div class="ticket-row '+(t.is_used?'ticket-used':'')+'"><span class="ticket-row-code">'+(i+1)+'. '+t.code+(t.is_current?' 👈':'')+'</span><span class="tag '+(t.is_current?'tag-cur':t.is_used?'tag-used':'tag-free')+'">'+(t.is_current?'Actuel':t.is_used?'Utilisé':'Dispo')+'</span></div>';});
    html+='</div></div>';
    let editZones=[];try{editZones=await sbGet('zones','order=name.asc');}catch(e){}
    html+='<div id="dt-edit" style="display:none"><label class="inp-label">Nom complet</label><input class="inp" type="text" id="edit-name" value="'+cl.name+'"><label class="inp-label">Username</label><input class="inp" type="text" id="edit-user" value="'+cl.username+'"><label class="inp-label">Nouveau mot de passe (vide = inchangé)</label><input class="inp" type="password" id="edit-pass" placeholder="Nouveau mot de passe"><label class="inp-label">Téléphone</label><input class="inp" type="tel" id="edit-phone" value="'+(cl.phone||'')+'"><label class="inp-label">📍 Zone</label><select class="inp" id="edit-zone">'+editZones.map(z=>'<option '+(cl.zone===z.name?'selected':'')+'>'+z.name+'</option>').join('')+'</select><label class="inp-label">Plan</label><select class="inp" id="edit-plan">'+['100 Go','200 Go','Illimité 5 appareils','Illimité 9+ appareils'].map(p=>'<option '+(cl.plan===p?'selected':'')+'>'+p+'</option>').join('')+'</select><button class="btn btn-primary btn-full" onclick="saveClientEdit(\''+id+'\')">💾 Enregistrer</button></div>';
    showModal(html);
  }catch(e){toast('Erreur','error');}
}

function dtab(tab,btn){document.querySelectorAll('#modal-content .dtab').forEach(t=>t.classList.remove('active'));if(btn)btn.classList.add('active');['info','tickets','edit'].forEach(t=>{const el=document.getElementById('dt-'+t);if(el)el.style.display=t===tab?'block':'none';});}
async function quickStatus(id,status){try{await sbPatch('clients','id=eq.'+id,{status});closeModal();toast('Statut mis à jour !');renderAdminClients();}catch(e){toast('Erreur','error');}}

async function setConsumption(id,pct){
  try{
    await sbPatch('clients','id=eq.'+id,{consumption_pct:pct.toString()});
    if(pct>0){
      await sbPost('messages',{client_id:id,sender:'admin',sender_name:'Admin',content:'📊 Mise à jour de votre consommation : vous avez utilisé '+pct+'% de votre forfait.'+(pct>=90?'\n\n⚠️ Pensez à renouveler votre abonnement bientôt pour éviter toute interruption.':'')});
    }
    toast(pct>0?'✅ Consommation mise à jour : '+pct+'%':'✅ Consommation réinitialisée');
    openDetail(id);
  }catch(e){toast('Erreur','error');}
}
async function deleteClient(id,name){if(!confirm('Supprimer "'+name+'" ? Irréversible.'))return;try{await sbDelete('clients','id=eq.'+id);closeModal();toast('Client supprimé');renderAdminClients();}catch(e){toast('Erreur','error');}}
async function addMoreTickets(clientId){const raw=document.getElementById('new-tickets-inp')?.value.trim();if(!raw){toast('Entrez un ticket','error');return;}const codes=raw.split('\n').map(t=>t.trim()).filter(t=>t);try{for(const code of codes){await sbPost('tickets',{client_id:clientId,code,is_used:false,is_current:false});}toast('✅ '+codes.length+' ticket(s) ajouté(s) !');openDetail(clientId);}catch(e){toast('Erreur','error');}}

async function saveClientEdit(id){
  const name=document.getElementById('edit-name').value.trim();const user=document.getElementById('edit-user').value.trim().toLowerCase();const pass=document.getElementById('edit-pass').value;const phone=document.getElementById('edit-phone').value.trim();const plan=document.getElementById('edit-plan').value;
  const zone=document.getElementById('edit-zone')?.value||'';
  const prices={'100 Go':'40.000','200 Go':'55.000','Illimité 5 appareils':'65.000','Illimité 9+ appareils':'90.000'};
  if(!name||!user){toast('Nom et username requis','error');return;}
  const updates={name,username:user,phone,zone,plan,plan_price:prices[plan]};
  if(pass){if(pass.length<4){toast('Mot de passe trop court','error');return;}updates.password=pass;}
  try{await sbPatch('clients','id=eq.'+id,updates);closeModal();toast('✅ Client modifié !'+(pass?' MDP: '+pass:''));renderAdminClients();}
  catch(e){toast('Erreur. Username peut-être déjà utilisé.','error');}
}

async function showAddClient(){
  let zones=[];
  try{zones=await sbGet('zones','order=name.asc');}catch(e){}
  const zoneOptions=zones.map(z=>'<option>'+z.name+'</option>').join('');
  showModal('<div class="modal-title">👤 Nouveau client <button class="modal-close" onclick="closeModal()">×</button></div><label class="inp-label">Nom complet *</label><input class="inp" type="text" id="n-name" placeholder="Ex: Rakoto Jean"><label class="inp-label">Username *</label><input class="inp" type="text" id="n-user" placeholder="Ex: rakoto"><label class="inp-label">Mot de passe *</label><input class="inp" type="password" id="n-pass" placeholder="Choisir un mot de passe"><label class="inp-label">Téléphone</label><input class="inp" type="tel" id="n-phone" placeholder="034 XX XXX XX"><label class="inp-label">📍 Zone *</label><select class="inp" id="n-zone">'+zoneOptions+'</select><label class="inp-label">Plan</label><select class="inp" id="n-plan"><option>100 Go</option><option>200 Go</option><option>Illimité 5 appareils</option><option>Illimité 9+ appareils</option></select><label class="inp-label">Tickets Mikrotik (un par ligne) *</label><textarea class="inp" id="n-tickets" placeholder="ABC123-XYZ&#10;DEF456-UVW&#10;..."></textarea><p style="font-size:11px;color:var(--text3);margin-bottom:12px">💡 Envoyés un par un à chaque paiement validé.</p><button class="btn btn-primary btn-full" onclick="addClient()">✓ Créer</button><button class="btn btn-ghost btn-full" onclick="closeModal()">Annuler</button>');
}

async function addClient(){
  const name=document.getElementById('n-name').value.trim();const user=document.getElementById('n-user').value.trim().toLowerCase();const pass=document.getElementById('n-pass').value;const phone=document.getElementById('n-phone').value.trim();const zone=document.getElementById('n-zone').value;const plan=document.getElementById('n-plan').value;const raw=document.getElementById('n-tickets').value.trim();
  if(!name||!user||!pass){toast('Remplissez nom, username et mot de passe.','error');return;}
  if(!raw){toast('Ajoutez au moins un ticket.','error');return;}
  const tickets=raw.split('\n').map(t=>t.trim()).filter(t=>t);
  const prices={'100 Go':'40.000','200 Go':'55.000','Illimité 5 appareils':'65.000','Illimité 9+ appareils':'90.000'};
  try{
    const nc=await sbPost('clients',{username:user,password:pass,name,phone,zone,plan,plan_price:prices[plan],status:'pending',join_date:today()});
    const clientId=nc[0].id;
    for(const code of tickets){await sbPost('tickets',{client_id:clientId,code,is_used:false,is_current:false});}
    closeModal();
    showModal('<div style="text-align:center;padding:16px"><div style="font-size:56px;margin-bottom:12px">🎉</div><div class="modal-title" style="justify-content:center;margin-bottom:12px">Client créé !</div><div class="info-box"><div class="info-row"><div class="info-key">Nom</div><div class="info-val">'+name+'</div></div><div class="info-row"><div class="info-key">Username</div><div class="info-val" style="font-family:var(--mono)">'+user+'</div></div><div class="info-row"><div class="info-key">Mot de passe</div><div class="info-val" style="font-family:var(--mono)">'+pass+'</div></div><div class="info-row"><div class="info-key">Tickets</div><div class="info-val">'+tickets.length+'</div></div></div><button class="btn btn-primary btn-full" style="margin-top:12px" onclick="closeModal();renderAdminClients()">OK ✓</button></div>');
  }catch(e){toast('Erreur. Username peut-être déjà utilisé.','error');}
}

async function renderAdminMessages(){
  const c=document.getElementById('a-content');
  try{
    // Charge clients ET tous les messages en parallèle (2 appels au lieu de N+1)
    const [clients,allMsgs]=await Promise.all([sbGet('clients','order=created_at.desc'),sbGet('messages','order=created_at.desc')]);
    const lastMsgByClient={};
    allMsgs.forEach(m=>{if(!lastMsgByClient[m.client_id])lastMsgByClient[m.client_id]=m;});

    let html='<div class="fade-up"><div class="page-header"><div class="page-title">💬 Messages</div><div class="page-sub">Conversations avec les clients</div></div>';
    if(!clients.length)html+='<div class="empty"><div class="empty-icon">💬</div><p>Aucun client</p></div>';
    else for(const cl of clients){
      const last=lastMsgByClient[cl.id];
      html+='<div class="conv-card" onclick="openAdminChat(\''+cl.id+'\',\''+cl.name+'\')"><div class="conv-avatar">'+initials(cl.name)+'</div><div class="conv-info"><div class="conv-name">'+cl.name+'</div><div class="conv-last">'+(last?last.content.substring(0,50)+'...':'Pas encore de messages')+'</div></div><div class="conv-right"><span class="badge badge-'+(cl.status||'pending')+'" style="font-size:9px">'+({active:'Actif',expired:'Expiré',pending:'En attente'}[cl.status||'pending'])+'</span>'+(last?'<div class="conv-time">'+new Date(last.created_at).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})+'</div>':'')+'</div></div>';
    }
    html+='</div>';c.innerHTML=html;
  }catch(e){c.innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><p>Erreur</p></div>';}
}

async function openAdminChat(clientId,clientName){
  curChatId=clientId;
  try{
    const msgs=await sbGet('messages','client_id=eq.'+clientId+'&order=created_at.asc');
    let html='<div class="modal-title"><div>💬 '+clientName+'</div><button class="modal-close" onclick="closeModal()">×</button></div>';
    html+='<div class="msg-list" id="admin-msg-list" style="max-height:300px">';
    if(!msgs.length)html+='<div class="empty"><div class="empty-icon">💬</div><p>Pas encore de messages</p></div>';
    else msgs.forEach(m=>{
      const mine=m.sender==='admin';
      if(m.content&&m.content.startsWith('[IMG]')){
        const imgUrl=m.content.replace('[IMG]','');
        html+='<div class="msg-wrap msg-'+(mine?'sent':'recv')+'"><img src="'+imgUrl+'" class="chat-img-preview"><div class="msg-time">'+new Date(m.created_at).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})+'</div></div>';
      } else {
        html+='<div class="msg-wrap msg-'+(mine?'sent':'recv')+'">'+(mine?'':'<div style="font-size:10px;color:var(--text3);margin-bottom:2px">'+m.sender_name+'</div>')+'<div class="bubble bubble-'+(mine?'sent':'recv')+'">'+m.content.replace(/\n/g,'<br>')+'</div><div class="msg-time">'+new Date(m.created_at).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})+'</div></div>';
      }
    });
    html+='</div><div class="chat-inp"><input class="chat-inp-field" type="text" id="a-msg-inp" placeholder="Répondre..." onkeydown="if(event.key===\'Enter\')aSendMsg()"><button class="chat-send-btn" onclick="aSendMsg()">→</button></div>';
    showModal(html);
    setTimeout(()=>{const el=document.getElementById('admin-msg-list');if(el)el.scrollTop=el.scrollHeight;},100);
  }catch(e){toast('Erreur','error');}
}

async function aSendMsg(){
  const inp=document.getElementById('a-msg-inp');if(!inp||!inp.value.trim())return;
  const txt=inp.value.trim();const nameEl=document.querySelector('#modal-content .modal-title div');const name=nameEl?nameEl.textContent.replace('💬 ',''):'Client';inp.value='';
  try{await sbPost('messages',{client_id:curChatId,sender:'admin',sender_name:'Admin',content:txt});openAdminChat(curChatId,name);}
  catch(e){inp.value=txt;toast('Erreur','error');}
}

async function renderAdminStats(){
  const c=document.getElementById('a-content');
  try{
    const [clients,payments]=await Promise.all([sbGet('clients'),sbGet('payments')]);
    const validated=payments.filter(p=>p.status==='validated');
    const revenue=validated.reduce((s,p)=>s+(parseInt((p.amount||'0').replace('.',''))||0),0);
    const total=clients.length||1;
    const planCount={};clients.forEach(cl=>{if(cl.plan)planCount[cl.plan]=(planCount[cl.plan]||0)+1;});
    let html='<div class="fade-up"><div class="page-header"><div class="page-title">📈 Statistiques</div></div>';
    html+='<div class="revenue-hero"><div class="revenue-label">💰 REVENUS TOTAUX</div><div class="revenue-amount">'+revenue.toLocaleString('fr')+' <span>Ar</span></div><div class="revenue-sub">'+validated.length+' paiements validés</div></div>';
    html+='<div class="stats-grid"><div class="stat-card-admin"><div class="stat-card-num" style="color:var(--accent)">'+clients.length+'</div><div class="stat-card-lbl">Total clients</div></div><div class="stat-card-admin"><div class="stat-card-num" style="color:var(--success)">'+clients.filter(x=>x.status==='active').length+'</div><div class="stat-card-lbl">Actifs</div></div><div class="stat-card-admin"><div class="stat-card-num" style="color:var(--warning)">'+payments.filter(p=>p.status==='pending').length+'</div><div class="stat-card-lbl">En attente</div></div><div class="stat-card-admin"><div class="stat-card-num" style="color:var(--purple)">'+payments.length+'</div><div class="stat-card-lbl">Total paiements</div></div></div>';
    html+='<div class="section-card"><div class="section-head">Répartition clients</div>';
    [{l:'Actifs',v:clients.filter(x=>x.status==='active').length,col:'var(--success)'},{l:'En attente',v:clients.filter(x=>x.status==='pending').length,col:'var(--warning)'},{l:'Expirés',v:clients.filter(x=>x.status==='expired').length,col:'var(--danger)'}].forEach(s=>{const pct=Math.round(s.v/total*100);html+='<div class="prog-wrap"><div class="prog-label"><span>'+s.l+'</span><span class="prog-val">'+s.v+' ('+pct+'%)</span></div><div class="prog-bar"><div class="prog-fill" style="width:'+pct+'%;background:'+s.col+'"></div></div></div>';});
    html+='</div>';
    if(Object.keys(planCount).length>0){html+='<div class="section-card"><div class="section-head">Par plan</div>';Object.entries(planCount).forEach(([plan,count])=>{const pct=Math.round(count/total*100);html+='<div class="prog-wrap"><div class="prog-label"><span>'+plan+'</span><span class="prog-val">'+count+'</span></div><div class="prog-bar"><div class="prog-fill" style="width:'+pct+'%;background:var(--accent)"></div></div></div>';});html+='</div>';}
    html+='<div class="section-card"><div class="section-head">🔐 Sécurité</div><button class="btn btn-ghost btn-full" onclick="showChangePass()">Changer mon mot de passe admin</button></div>';
    html+='</div>';c.innerHTML=html;
  }catch(e){c.innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><p>Erreur</p></div>';}
}

// ═══ GESTIONNAIRE DE ZONES ═══
async function showZoneManager(){
  let zones=[];
  try{zones=await sbGet('zones','order=name.asc');}catch(e){}
  let html='<div class="modal-title">⚙️ Gérer les zones <button class="modal-close" onclick="closeModal()">×</button></div>';
  html+='<div style="margin-bottom:14px">';
  zones.forEach(z=>{
    html+='<div class="info-row"><div class="info-val" style="font-weight:600">📍 '+z.name+'</div><button class="btn btn-danger btn-sm" style="padding:6px 12px;font-size:12px" onclick="deleteZone(\''+z.id+'\',\''+z.name+'\')">🗑</button></div>';
  });
  if(!zones.length)html+='<div class="empty"><div class="empty-icon">📍</div><p>Aucune zone</p></div>';
  html+='</div>';
  html+='<label class="inp-label">Ajouter une nouvelle zone</label>';
  html+='<input class="inp" type="text" id="new-zone-name" placeholder="Ex: Ambohijanaka">';
  html+='<button class="btn btn-primary btn-full" onclick="addZone()">+ Ajouter la zone</button>';
  html+='<button class="btn btn-ghost btn-full" onclick="closeModal()">Fermer</button>';
  showModal(html);
}

async function addZone(){
  const name=document.getElementById('new-zone-name').value.trim();
  if(!name){toast('Entrez un nom de zone','error');return;}
  try{
    await sbPost('zones',{name});
    toast('✅ Zone "'+name+'" créée !');
    showZoneManager();
  }catch(e){toast('Erreur. Cette zone existe peut-être déjà.','error');}
}

async function deleteZone(id,name){
  if(!confirm('Supprimer la zone "'+name+'" ? Les clients de cette zone ne seront pas supprimés.'))return;
  try{
    await sbDelete('zones','id=eq.'+id);
    toast('Zone "'+name+'" supprimée');
    showZoneManager();
  }catch(e){toast('Erreur suppression','error');}
}

// ═══ CONFETTIS DE CÉLÉBRATION ═══
function launchConfetti(){
  const colors=['#3b82f6','#60a5fa','#34d399','#fbbf24','#a78bfa','#f87171'];
  const container=document.createElement('div');
  container.className='confetti-container';
  document.body.appendChild(container);
  for(let i=0;i<60;i++){
    const c=document.createElement('div');
    c.className='confetti-piece';
    c.style.left=Math.random()*100+'%';
    c.style.background=colors[Math.floor(Math.random()*colors.length)];
    c.style.animationDelay=(Math.random()*0.4)+'s';
    c.style.animationDuration=(2+Math.random()*1.5)+'s';
    c.style.width=c.style.height=(6+Math.random()*6)+'px';
    c.style.borderRadius=Math.random()>0.5?'50%':'2px';
    container.appendChild(c);
  }
  setTimeout(()=>container.remove(),3500);
}

// ═══ EASTER EGG — 5 clics rapides sur l'avatar profil ═══
let eggClicks=0,eggTimer=null;
function easterEgg(el){
  eggClicks++;
  clearTimeout(eggTimer);
  eggTimer=setTimeout(()=>{eggClicks=0;},800);
  if(eggClicks>=5){
    eggClicks=0;
    const msgs=['🛰️ Vous avez trouvé le secret NTY Starnet !','⭐ Easter egg débloqué ! Merci d\'être un client fidèle.','🚀 Vous êtes officiellement un explorateur NTY !'];
    toast(msgs[Math.floor(Math.random()*msgs.length)]);
    launchConfetti();
  }
}


// ═══════════════════════════════════════════════════════
// BOT D'ASSISTANCE NTY STARNET
// ═══════════════════════════════════════════════════════
const BOT_NAME = '🤖 Assistant NTY Starnet';
const TAKEN_IPS = ['192.168.0.57', '192.168.0.9', '192.168.0.77', '192.168.0.79', '192.168.0.86', '192.168.0.39', '192.168.0.49', '192.168.0.5', '192.168.0.226', '192.168.0.228', '192.168.0.87', '192.168.0.65', '192.168.0.71', '192.168.0.50', '192.168.0.201', '192.168.0.95', '192.168.0.254', '26.26.26.4', '192.168.0.253', '26.26.26.251', '192.168.0.88', '192.168.0.252', '192.168.0.26', '192.168.0.203', '192.168.0.90', '192.168.0.202', '192.168.0.81', '192.168.2.2', '192.168.0.112', '192.168.0.222', '192.168.0.58', '192.168.0.42', '192.168.0.204'];

function getAvailableIPs(){
  const available=[];
  for(let i=2;i<=254;i++){
    const ip='192.168.0.'+i;
    if(!TAKEN_IPS.includes(ip))available.push(ip);
  }
  return available;
}

function botReply(userMsg){
  const msg=userMsg.toLowerCase().trim();
  
  // ═══ CONNEXION / SE CONNECTER ═══
  if(msg.includes('connect')&&!msg.includes('déconnect')||msg.includes('se connecter')||msg.includes('comment connecter')||msg.includes('connexion')){
    return `📶 **Comment se connecter au WiFi NTY Starnet**

**Étape 1** — Cherchez le réseau WiFi :
• \`TNTY_5GHZ/0344127501\`
• ou \`CNTY_5GHZ/0344127501\`
• (Les relais ont un suffixe : Kl, has, FANO...)

**Étape 2** — Mot de passe WiFi : \`42024...\`

**Étape 3** — Ouvrez votre navigateur (Chrome, Firefox...) → une page de connexion Mikrotik s'affiche automatiquement

**Étape 4** — Entrez votre ticket Mikrotik comme login ET mot de passe

✅ Vous êtes connecté !

Si la page ne s'affiche pas, tapez \`192.168.0.1\` dans votre navigateur.`;
  }

  // ═══ TICKET / CODE ═══
  if(msg.includes('ticket')||msg.includes('code')||msg.includes('identifiant')){
    return `🎫 **Votre ticket Mikrotik**

Votre ticket est affiché sur votre dashboard (page Accueil).

Pour l'utiliser :
1. Connectez-vous au WiFi \`TNTY_5GHZ/0344127501\`
2. Ouvrez votre navigateur
3. Entrez le code comme **login** et **mot de passe**

⚠️ Si vous ne voyez pas votre ticket ici, c'est que votre paiement n'a pas encore été validé. Contactez l'administrateur via la messagerie.`;
  }

  // ═══ PAGE NE S'AFFICHE PAS ═══
  if(msg.includes('page')||msg.includes('affiche pas')||msg.includes('navigateur')||msg.includes('portail')){
    return `🔧 **La page de connexion ne s'affiche pas ?**

Essayez dans cet ordre :

1. Tapez directement \`192.168.0.1\` dans votre navigateur
2. Vérifiez que vous êtes bien connecté au WiFi NTY Starnet
3. Désactivez votre données mobiles (4G/5G) le temps de vous connecter
4. Essayez avec le navigateur Chrome
5. Videz le cache de votre navigateur

Si ça ne marche toujours pas, tapez "capteur" pour configurer votre équipement.`;
  }

  // ═══ CONNEXION LENTE ═══
  if(msg.includes('lent')||msg.includes('lente')||msg.includes('lenteur')||msg.includes('vitesse')||msg.includes('lentement')||msg.includes('lag')){
    return `🐢 **Connexion lente — Solutions étape par étape**

**🔌 ÉTAPE 1 — Vérifiez vos câbles**
• Un câble mal branché ou abîmé peut réduire drastiquement la vitesse
• Débranchez et rebranchez fermement tous les câbles réseau
• Vérifiez que les témoins LED du câble sont bien verts

**💡 ÉTAPE 2 — Vérifiez les témoins**
• Tous les témoins doivent être verts et stables
• Un témoin orange ou clignotant anormalement = problème

**🔄 ÉTAPE 3 — Redémarrez votre capteur**
• Débranchez-le 30 secondes, rebranchez
• Attendez 2 minutes que la connexion se stabilise

**📶 ÉTAPE 4 — Vérifiez votre signal WiFi**
• Rapprochez-vous de votre capteur ou de l'émetteur NTY
• Les obstacles (murs épais, métal) réduisent le signal

**📊 ÉTAPE 5 — Vérifiez votre quota**
• Si vous avez un forfait 100Go ou 200Go, vérifiez votre consommation sur l'Accueil
• Un quota dépassé peut ralentir ou couper la connexion

**⏰ ÉTAPE 6 — Heures de pointe**
• La connexion peut être plus lente entre 19h et 22h
• Essayez à un autre moment pour comparer

Si la lenteur persiste, envoyez une 📷 photo de vos témoins à l'admin ! 🙏`;
  }

  // ═══ CONFIGURATION CAPTEUR TP-LINK ═══
  if(msg.includes('tp-link')||msg.includes('tp link')||msg.includes('tplink')){
    const ip=getAvailableIPs()[0]||'192.168.0.100';
    return `📡 **Configuration TP-Link**

**Étape 1** — Connectez votre PC/téléphone au TP-Link via WiFi ou câble

**Étape 2** — Ouvrez votre navigateur et tapez : \`192.168.0.254\` ou \`tplinkwifi.net\`

**Étape 3** — Connectez-vous (login: \`admin\` / mot de passe: \`admin\` ou laissez vide)

**Étape 4** — Allez dans **"Mode"** → Choisissez **"Client"** ou **"WISP"**

**Étape 5** — Scannez les réseaux → Sélectionnez \`TNTY_5GHZ/0344127501\` → Entrez le mot de passe \`42024...\`

**Étape 6** — Dans les paramètres réseau, mettez :
• IP : \`${ip}\`
• Masque : \`255.255.255.0\`
• Passerelle : \`192.168.0.1\`
• DNS : \`8.8.8.8\`

**Étape 7** — Enregistrez et redémarrez le TP-Link

✅ Attendez 1 minute puis testez votre connexion !`;
  }

  // ═══ CONFIGURATION COMFAST ═══
  if(msg.includes('comfast')||msg.includes('n312')||msg.includes('com fast')){
    const ip=getAvailableIPs()[1]||'192.168.0.101';
    return `📡 **Configuration Comfast N312**

**Étape 1** — Connectez votre PC/téléphone au Comfast via WiFi

**Étape 2** — Tapez dans votre navigateur : \`192.168.10.1\`

**Étape 3** — Login: \`admin\` / Mot de passe: \`admin\`

**Étape 4** — Allez dans **"Working Mode"** → Sélectionnez **"Client Mode"** (mode client/répéteur)

**Étape 5** — Cliquez **"Scan"** → Sélectionnez \`TNTY_5GHZ/0344127501\` → Entrez \`42024...\`

**Étape 6** — Dans **"LAN Settings"** :
• IP LAN : \`${ip}\`
• Masque : \`255.255.255.0\`
• Passerelle : \`192.168.0.1\`

**Étape 7** — Cliquez **"Save & Apply"** → Redémarrez

✅ Reconnectez-vous au WiFi Comfast et testez !`;
  }

  // ═══ CONFIGURATION TENDA ═══
  if(msg.includes('tenda')){
    const ip=getAvailableIPs()[2]||'192.168.0.102';
    return `📡 **Configuration Tenda**

**Étape 1** — Connectez votre appareil au Tenda via WiFi

**Étape 2** — Tapez dans le navigateur : \`192.168.0.1\` ou \`tendawifi.com\`

**Étape 3** — Pas de mot de passe au départ (ou \`admin\`)

**Étape 4** — Allez dans **"Mode"** → Choisissez **"Client universel (WISP)"**

**Étape 5** — Cliquez **"Sélectionner"** → Choisissez \`TNTY_5GHZ/0344127501\` → Entrez \`42024...\`

**Étape 6** — Paramètres réseau :
• IP WAN : \`${ip}\`
• Masque : \`255.255.255.0\`
• Passerelle : \`192.168.0.1\`
• DNS : \`8.8.8.8\`

**Étape 7** — **"Enregistrer"** → Redémarrez le Tenda

✅ Testez votre connexion après 1 minute !`;
  }

  // ═══ CAPTEUR (sans préciser la marque) ═══
  if(msg.includes('capteur')||msg.includes('routeur')||msg.includes('configur')||msg.includes('installer')||msg.includes('installation')){
    return `📡 **Configuration de votre capteur**

Quelle est la marque de votre capteur ? Tapez l'un de ces mots :

• **"TP-Link"** — pour un capteur TP-Link
• **"Comfast"** ou **"N312"** — pour un Comfast N312
• **"Tenda"** — pour un Tenda

Je vous donnerai les instructions étape par étape selon votre marque ! 😊`;
  }

  // ═══ IP / ADRESSE ═══
  if(msg.includes('adresse ip')||msg.includes('ip ')||msg.includes('192.168')){
    const avail=getAvailableIPs().slice(0,5);
    return `🌐 **Adresses IP disponibles**

Voici des adresses IP disponibles pour votre capteur :
${avail.map((ip,i)=>'• `'+ip+'`').join('\n')}

**Paramètres réseau à utiliser :**
• Adresse IP : une des adresses ci-dessus
• Masque de sous-réseau : \`255.255.255.0\`
• Passerelle : \`192.168.0.1\`
• DNS primaire : \`8.8.8.8\`
• DNS secondaire : \`8.8.4.4\``;
  }

  // ═══ PAIEMENT ═══
  if(msg.includes('paiement')||msg.includes('payer')||msg.includes('renouveler')||msg.includes('abonnement')){
    return `💳 **Renouveler votre abonnement**

1. Allez dans l'onglet **"Paiement"** en bas de l'écran
2. Choisissez votre forfait
3. Envoyez le paiement Mobile Money sur :
   • \`0344127501\` — Rojo Rindra
   • \`0346341775\` — Rasoamanana Ny Tiana (NY)
   • \`0321825114\` — Rasoamanana Ny Tiana (NY)
4. Remplissez le formulaire avec la date et la référence
5. Ajoutez une photo du reçu si possible
6. Envoyez la demande ✅

L'administrateur validera votre paiement très rapidement !`;
  }

  // ═══ PAS DE CONNEXION / NE MARCHE PAS ═══
  if(msg.includes('marche pas')||msg.includes('fonctionne pas')||msg.includes('pas de connexion')||msg.includes('déconnecté')||msg.includes('plus de connexion')||msg.includes('internet')||msg.includes('wifi')){
    return `❌ **Problème de connexion — Suivez ces étapes dans l'ordre**

**🔌 ÉTAPE 1 — Vérifiez les câbles**
• Vérifiez que le câble entre votre capteur et votre routeur/switch est bien branché des deux côtés
• Débranchez et rebranchez fermement chaque câble
• Si le câble est abîmé ou plié, essayez avec un autre câble

**💡 ÉTAPE 2 — Vérifiez les témoins lumineux (LEDs)**
• Regardez les petites lumières sur votre capteur :
  → 🟢 **Vert fixe** = Normal, tout va bien
  → 🟠 **Orange/Rouge fixe** = Problème de connexion
  → ⚡ **Clignotant rapidement** = En train de se connecter (attendez)
  → ❌ **Éteint** = Pas d'alimentation, vérifiez le câble d'alimentation

**🔄 ÉTAPE 3 — Redémarrez votre équipement**
• Débranchez votre capteur de la prise électrique
• Attendez **30 secondes** (important !)
• Rebranchez et attendez **1 à 2 minutes** que les témoins se stabilisent

**📶 ÉTAPE 4 — Vérifiez le WiFi**
• Déconnectez-vous du WiFi et reconnectez-vous à \`TNTY_5GHZ/0344127501\`
• Désactivez vos données mobiles (4G/5G) pendant la connexion

**✅ ÉTAPE 5 — Vérifiez votre abonnement**
• Allez sur l'onglet **Accueil** et vérifiez que votre abonnement est actif
• Si expiré → renouvelez via l'onglet **Paiement**

Si après tout ça ça ne marche toujours pas, envoyez une **📷 photo de vos témoins lumineux** et contactez l'administrateur via l'onglet **👨‍💼 Admin** ! 🙏`;
  }

  // ═══ TÉMOINS / LUMIÈRES / LEDS ═══
  if(msg.includes('témoin')||msg.includes('lumière')||msg.includes('led')||msg.includes('voyant')||msg.includes('clignot')||msg.includes('rouge')||msg.includes('orange')){
    return `💡 **Que signifient les témoins lumineux ?**

**Sur votre capteur WiFi :**
→ 🟢 **Vert fixe** = Connexion normale, tout va bien
→ 🟢 **Vert clignotant** = Données en transit (normal)
→ 🟠 **Orange fixe** = Problème de connexion réseau
→ 🔴 **Rouge fixe** = Erreur — pas de connexion internet
→ ⚡ **Clignotant rapide** = En cours de démarrage, attendez 2 minutes
→ ❌ **Éteint** = Pas d'alimentation électrique

**Sur le port câble (LAN) :**
→ 🟢 **Vert** = Câble bien branché et actif
→ ❌ **Éteint** = Câble débranché ou défectueux → vérifiez le câble

**Solutions immédiates :**
1. Débranchez et rebranchez tous les câbles fermement
2. Redémarrez le capteur (débranchez 30 sec, rebranchez)
3. Si les témoins ne reviennent pas au vert après 2 minutes → contactez l'admin

📷 Envoyez une photo de vos témoins via le bouton 📷 pour une aide plus précise !`;
  }

  // ═══ CÂBLES ═══
  if(msg.includes('câble')||msg.includes('cable')||msg.includes('branché')||msg.includes('brancher')||msg.includes('fil')||msg.includes('prise')){
    return `🔌 **Vérification des câbles**

**Quels câbles vérifier ?**

1. **Câble d'alimentation** (électrique) de votre capteur
   → Bien branché dans la prise ? Prise fonctionnelle ?

2. **Câble réseau (RJ45)** entre votre capteur et le point d'accès NTY
   → Les deux bouts bien enfoncés ? (vous devez entendre un "clic")
   → Le témoin LED du port doit s'allumer en vert

3. **Câble entre votre PC et votre capteur** (si vous utilisez un câble)
   → Débranchez et rebranchez des deux côtés

**Procédure recommandée :**
1. Débranchez TOUS les câbles
2. Attendez 10 secondes
3. Rebranchez dans l'ordre : alimentation d'abord, réseau ensuite
4. Attendez 2 minutes et vérifiez les témoins lumineux

💡 Si un câble est plié, écrasé ou abîmé → remplacez-le, c'est souvent la cause du problème !`;
  }

  // ═══ COUPURE ÉLECTRIQUE ═══
  if(msg.includes('courant')||msg.includes('électricité')||msg.includes('coupure')||msg.includes('panne')){
    return `⚡ **Coupure électrique ?**

En cas de coupure de courant dans votre zone, le WiFi NTY Starnet sera temporairement indisponible — c'est normal et cela n'affecte pas votre abonnement.

✅ La connexion reprendra **automatiquement** dès le retour du courant.

⏳ Votre abonnement **continue de courir** normalement pendant la coupure.

Si la connexion ne revient pas après le retour du courant, redémarrez votre capteur en le débranchant 30 secondes.`;
  }

  // ═══ BONJOUR / SALUT ═══
  if(msg.includes('bonjour')||msg.includes('salut')||msg.includes('bonsoir')||msg.includes('allo')||msg.includes('hello')||msg.includes('hi')||msg===''||msg.length<4){
    return `👋 **Bonjour ! Je suis l'assistant NTY Starnet.**

Je peux vous aider avec :

🔌 **"connexion"** — Comment se connecter au WiFi
🎫 **"ticket"** — Utiliser votre ticket Mikrotik
📡 **"capteur"** — Configurer votre équipement (TP-Link, Comfast, Tenda)
🐢 **"lent"** — Problème de vitesse
❌ **"ne marche pas"** — Dépannage connexion
💳 **"paiement"** — Renouveler votre abonnement
🌐 **"adresse IP"** — Trouver une IP disponible

Tapez votre problème et je vous aide ! 😊`;
  }

  // ═══ RÉPONSE PAR DÉFAUT ═══
  return `🤖 Je n'ai pas bien compris votre question. Voici ce que je peux vous aider :

• Tapez **"connexion"** pour savoir comment vous connecter
• Tapez **"capteur"** pour configurer votre équipement
• Tapez **"ticket"** pour utiliser votre ticket Mikrotik
• Tapez **"ne marche pas"** pour un dépannage rapide
• Tapez **"paiement"** pour renouveler votre abonnement

Ou contactez directement l'administrateur via ce chat — il répond rapidement ! 😊`;
}

function formatBotMsg(text){
  return text
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\`(.+?)\`/g,'<code style="background:rgba(99,179,255,0.12);padding:1px 6px;border-radius:4px;font-family:var(--mono);font-size:12px;color:var(--accent2)">$1</code>')
    .replace(/\n/g,'<br>');
}

document.addEventListener('DOMContentLoaded',()=>{
  initStars();
  document.getElementById('login-pass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
  document.getElementById('login-user').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('login-pass').focus();});
});
