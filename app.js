const SB_URL='https://bpeliducuuagffwlsjal.supabase.co';
const SB_KEY='sb_publishable_3HKOfxQfItpFE8VYDIEULg_j550L4Hi';

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
let coupureActive=localStorage.getItem('nty_coupure')==='true';
let coupureMsg=localStorage.getItem('nty_coupure_msg')||'Coupure electrique en cours — La connexion WiFi est temporairement indisponible.';

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

// LOGIN
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
  }catch(e){err.style.display='flex';err.querySelector('.err-msg').textContent='Erreur de connexion. Reessayez.';}
  btn.innerHTML='Se connecter <span>→</span>';btn.disabled=false;
}
function logout(){me=null;document.getElementById('login-user').value='';document.getElementById('login-pass').value='';document.getElementById('login-err').style.display='none';showPage('page-login');}

// CLIENT NAV
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

// CLIENT HOME
async function renderClientHome(){
  const c=document.getElementById('c-content');
  try{
    const [cd,pays,tix]=await Promise.all([sbGet('clients','id=eq.'+me.id),sbGet('payments','client_id=eq.'+me.id+'&order=created_at.desc&limit=5'),sbGet('tickets','client_id=eq.'+me.id)]);
    const u=cd[0]||me;me={...me,...u};
    const dl=daysLeft(u.expiry_date);
    const freeT=tix.filter(t=>!t.is_used);
    const h=new Date().getHours();
    const greetPool=h<5?['Bonne nuit 🌙','Le WiFi veille sur vous 🛡️']:h<12?['Pret a conquerir Internet ? 🚀','Bonjour, votre WiFi vous attend ! 📶','Belle journee connectee ☀️']:h<18?['Bon apres-midi connecte ! 🌤','Tout roule de votre cote ? 📡']:['Bonsoir, profitez de votre soiree 🌆','Une bonne connexion pour bien finir 🌟'];
    const greet=greetPool[Math.floor(Math.random()*greetPool.length)];
    const pct=dl!==null&&dl>0?Math.min(100,Math.round(dl/30*100)):0;
    const fillColor=pct>60?'var(--success)':pct>25?'var(--warning)':'var(--danger)';
    const statusMap={active:'✅ Actif',expired:'❌ Expire',pending:'⏳ En attente'};
    const startFmt=fmtDateFull(u.start_date);
    const endFmt=fmtDateFull(u.expiry_date);
    let html='<div class="fade-up">';
    html+='<div class="greeting"><div class="greeting-text">'+greet+'</div><div class="greeting-name">'+u.name+'</div></div>';

    // Coupure par zone
    const clientZone=u.zone||'';
    const coupureZones=JSON.parse(localStorage.getItem('nty_coupure_zones')||'{}');
    if(clientZone&&coupureZones[clientZone]===true){
      const zoneMsg=localStorage.getItem('nty_coupure_msg_'+clientZone)||'Coupure electrique en cours dans votre zone ('+clientZone+') — La connexion WiFi sera retablie des le retour du courant.';
      html+='<div class="notif-card notif-danger" style="border-width:2px"><div class="notif-icon">🔴</div><div class="notif-body"><div class="notif-title">Coupure en cours — '+clientZone+'</div><div class="notif-msg">'+zoneMsg+'</div></div></div>';
    }

    // Alerts
    if(u.status==='expired'||dl!==null&&dl<0)html+='<div class="notif-card notif-danger" style="border-width:2px"><div class="notif-icon">🚫</div><div class="notif-body"><div class="notif-title">Connexion coupee automatiquement</div><div class="notif-msg">Votre abonnement a expire le <strong>'+endFmt+'</strong>. Votre acces WiFi a ete automatiquement suspendu. Renouvelez pour retablir la connexion.</div></div></div>';
    if(dl!==null&&dl<=5&&dl>0)html+='<div class="notif-card notif-warning"><div class="notif-icon">⏰</div><div class="notif-body"><div class="notif-title">Renouvellement urgent !</div><div class="notif-msg">Votre abonnement expire le <strong>'+endFmt+' a 23h59</strong> dans <strong>'+dl+' jour(s)</strong>. Sans renouvellement, votre connexion sera automatiquement coupee.</div></div></div>';
    if(dl===0)html+='<div class="notif-card notif-danger"><div class="notif-icon">🔴</div><div class="notif-body"><div class="notif-title">Expire aujourd hui a 23h59 !</div><div class="notif-msg">Renouvelez immediatement pour eviter la coupure automatique ce soir.</div></div></div>';
    if(pays.some(p=>p.status==='pending'))html+='<div class="notif-card notif-info"><div class="notif-icon">💳</div><div class="notif-body"><div class="notif-title">Paiement en cours de validation</div><div class="notif-msg">Votre paiement est en cours de validation. Vous recevrez votre ticket Mikrotik des que c est traite.</div></div></div>';
    if(u.start_date&&u.expiry_date&&u.status==='active')html+='<div class="notif-card notif-info"><div class="notif-icon">📅</div><div class="notif-body"><div class="notif-title">Periode abonnement</div><div class="notif-msg">Du <strong>'+startFmt+'</strong> au <strong>'+endFmt+' a 23h59</strong>.</div></div></div>';
    if(u.status==='active'&&dl!==null&&dl>5)html+='<div class="notif-card notif-subtle"><div class="notif-icon">ℹ️</div><div class="notif-body"><div class="notif-title">Information importante</div><div class="notif-msg">En cas de non-renouvellement, votre connexion WiFi sera <strong>automatiquement suspendue</strong> le <strong>'+endFmt+' a 23h59</strong>. Pensez a renouveler a temps !</div></div></div>';

    // Hero card
    html+='<div class="hero-card"><div class="hero-top"><div><div class="hero-label">ABONNEMENT</div><span class="badge badge-'+(u.status||'pending')+'">'+(statusMap[u.status||'pending'])+'</span></div><div class="hero-right"><div class="hero-label">PLAN</div><div class="hero-plan">'+(u.plan||'—')+'</div><div class="hero-price">'+(u.plan_price||'—')+' Ar/mois</div></div></div>';
    html+='<div class="hero-mid"><div><div class="hero-label">EXPIRATION</div><div class="hero-exp">'+(u.expiry_date?endFmt+' a 23h59':'—')+'</div></div><div class="hero-days-wrap"><div class="hero-label">JOURS RESTANTS</div><div class="hero-days" style="color:'+fillColor+'">'+(dl!==null&&dl>=0?dl:'—')+'</div></div></div>';
    if(dl!==null&&dl>=0)html+='<div class="expiry-track"><div class="expiry-fill" style="width:'+pct+'%;background:'+fillColor+'"></div></div>';
    html+='<button class="btn btn-primary btn-full" onclick="cPage(\'paiement\',document.getElementById(\'cnav-paiement\'))">🔄 Renouveler l abonnement</button></div>';

    // Ticket
    if(u.current_ticket)html+='<div class="ticket-card"><div class="ticket-label">🎫 VOTRE TICKET MIKROTIK ACTIF</div><div class="ticket-code">'+u.current_ticket+'</div><div class="ticket-valid">Valable du '+startFmt+' au '+endFmt+' a 23h59</div></div>';

    // Consommation (100Go/200Go uniquement)
    const isLimitedPlan=u.plan==='100 Go'||u.plan==='200 Go';
    if(isLimitedPlan&&u.consumption_pct&&parseInt(u.consumption_pct)>0&&u.status==='active'){
      const cp=parseInt(u.consumption_pct);
      const remaining=100-cp;
      let theme,icon,headline;
      if(cp>=90){theme='critical';icon='🔴';headline='Quota presque epuise !';}
      else if(cp>=70){theme='warning';icon='🟠';headline='Quota en surveillance';}
      else if(cp>=50){theme='mid';icon='🟡';headline='Mi-parcours atteint';}
      else{theme='good';icon='🟢';headline='Tout va bien';}
      html+='<div class="data-orb-card data-orb-'+theme+'"><div class="data-orb-glow"></div><div class="data-orb-top"><div><div class="data-orb-eyebrow">'+icon+' Suivi consommation</div><div class="data-orb-headline">'+headline+'</div></div><div class="data-orb-ring-wrap"><svg class="data-orb-ring" viewBox="0 0 100 100"><circle class="data-orb-track" cx="50" cy="50" r="42"/><circle class="data-orb-progress data-orb-progress-'+theme+'" cx="50" cy="50" r="42" style="stroke-dasharray:'+(2*Math.PI*42)+';stroke-dashoffset:'+(2*Math.PI*42*(1-cp/100))+'"/></svg><div class="data-orb-pct">'+cp+'<span>%</span></div></div></div><div class="data-orb-detail">Forfait <strong>'+(u.plan||'')+'</strong> · <strong>'+remaining+'%</strong> restant'+(cp>=90?'<br><span class="data-orb-cta">⚡ Renouvelez maintenant !</span>':'')+'</div></div>';
    }

    // Stats
    html+='<div class="stats-row"><div class="stat-pill"><div class="stat-pill-num">'+pays.filter(p=>p.status==='validated').length+'</div><div class="stat-pill-lbl">Paie valides</div></div><div class="stat-pill"><div class="stat-pill-num">'+freeT.length+'</div><div class="stat-pill-lbl">Tickets restants</div></div><div class="stat-pill"><div class="stat-pill-num">'+tix.length+'</div><div class="stat-pill-lbl">Total tickets</div></div></div>';

    // Historique
    if(pays.length>0){
      html+='<div class="section-card"><div class="section-head">📋 Historique paiements</div>';
      pays.forEach(p=>{
        const ic=p.status==='validated'?'✅':p.status==='rejected'?'❌':'⏳';
        html+='<div class="history-row"><div class="history-left"><div class="history-icon">'+ic+'</div><div><div class="history-plan">'+p.plan+'</div><div class="history-date">'+fmtDate(p.payment_date)+' · Ref: '+(p.reference||'—')+'</div></div></div><div class="history-right"><div class="history-amount">'+(p.amount||'—')+' Ar</div><span class="badge badge-'+p.status+'" style="font-size:10px">'+({validated:'Valide',pending:'En attente',rejected:'Refuse'}[p.status])+'</span></div></div>';
      });
      html+='</div>';
    }
    html+='</div>';
    c.innerHTML=html;
  }catch(e){c.innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><p>Erreur de chargement</p><button class="btn btn-ghost" onclick="cPage(\'home\',null)" style="margin-top:12px;width:auto;padding:10px 20px">Reessayer</button></div>';}
}

// CLIENT PAIEMENT
function renderClientPaiement(){
  const c=document.getElementById('c-content');photoData=null;
  const plans=[{n:'100 Go',p:'40.000',d:'Valable 30 jours',icon:'📶'},{n:'200 Go',p:'55.000',d:'Valable 30 jours',icon:'📶'},{n:'Illimite 5 appareils',p:'65.000',d:'30 jours · 5 appareils',icon:'🏠'},{n:'Illimite 9+ appareils',p:'90.000',d:'30 jours · 9+ appareils',icon:'🏢'}];
  const nums=[{n:'0344127501',name:'Rojo Rindra'},{n:'0346341775',name:'Rasoamanana Ny Tiana (NY)'},{n:'0321825114',name:'Rasoamanana Ny Tiana (NY)'}];
  let html='<div class="fade-up"><div class="page-header"><div class="page-title">💳 Renouveler</div><div class="page-sub">Choisissez votre abonnement</div></div>';
  html+='<div class="pay-box"><div class="pay-box-title">📲 Envoyez votre paiement sur</div>';
  nums.forEach(num=>{html+='<div class="pay-num-row"><div class="pay-num">'+num.n+'</div><div class="pay-num-name">'+num.name+'</div></div>';});
  html+='<div class="pay-box-warn">⚠️ Frais de retrait Mobile Money a votre charge — envoyez le montant exact + frais de retrait.</div>';
  html+='<div class="pay-box-sub">Puis remplissez le formulaire ci-dessous ↓</div></div>';
  html+='<div class="section-card"><div class="section-head">Choisir un plan</div>';
  plans.forEach((pl,i)=>{html+='<div class="plan-card'+(i===0?' selected':'')+'" onclick="selPlan(this,\''+pl.n+'\')"><div class="plan-icon">'+pl.icon+'</div><div class="plan-info"><div class="plan-name">'+pl.n+'</div><div class="plan-desc">'+pl.d+'</div></div><div class="plan-price">'+pl.p+' Ar</div></div>';});
  html+='</div><div class="section-card"><div class="section-head">Details du paiement</div>';
  html+='<label class="inp-label">Date du paiement *</label><input class="inp" type="date" id="c-paydate" max="'+today()+'">';
  html+='<label class="inp-label">Reference du paiement</label><input class="inp" type="text" id="c-payref" placeholder="Ex: TXN123456789">';
  html+='<label class="inp-label">Photo du recu</label>';
  html+='<div class="upload-zone" id="upload-zone" onclick="document.getElementById(\'c-photo\').click()"><div class="upload-icon">📷</div><div class="upload-text">Appuyez pour ajouter une photo</div><div class="upload-sub">JPG, PNG recommande</div><input type="file" id="c-photo" accept="image/*" style="display:none" onchange="previewPhoto()"></div>';
  html+='<div id="photo-preview" style="display:none;margin-bottom:12px"><img id="preview-img" style="width:100%;border-radius:12px;max-height:200px;object-fit:cover"><button class="btn btn-ghost" style="margin-top:8px" onclick="removePhoto()">🗑 Supprimer</button></div>';
  html+='<button class="btn btn-primary btn-full" onclick="submitPay()">📤 Envoyer la demande</button></div></div>';
  c.innerHTML=html;selPlanName='100 Go';
}
function selPlan(el,name){document.querySelectorAll('.plan-card').forEach(c=>c.classList.remove('selected'));el.classList.add('selected');selPlanName=name;}
function previewPhoto(){const f=document.getElementById('c-photo').files[0];if(!f)return;const r=new FileReader();r.onload=e=>{photoData=e.target.result;document.getElementById('preview-img').src=photoData;document.getElementById('photo-preview').style.display='block';document.getElementById('upload-zone').style.display='none';};r.readAsDataURL(f);}
function removePhoto(){photoData=null;document.getElementById('c-photo').value='';document.getElementById('photo-preview').style.display='none';document.getElementById('upload-zone').style.display='block';}
async function submitPay(){
  const d=document.getElementById('c-paydate').value;
  if(!d){toast('Veuillez indiquer la date du paiement.','error');return;}
  const prices={'100 Go':'40.000','200 Go':'55.000','Illimite 5 appareils':'65.000','Illimite 9+ appareils':'90.000'};
  try{
    await sbPost('payments',{client_id:me.id,client_name:me.name,plan:selPlanName,amount:prices[selPlanName],payment_date:d,reference:document.getElementById('c-payref').value||null,status:'pending',photo_url:photoData});
    await sbPatch('clients','id=eq.'+me.id,{status:'pending'});
    me.status='pending';photoData=null;
    launchConfetti();
    showModal('<div style="text-align:center;padding:16px"><div style="font-size:56px;margin-bottom:16px">🎉</div><div class="modal-title" style="justify-content:center;margin-bottom:8px">Demande envoyee !</div><p style="color:var(--text2);font-size:13px;margin-bottom:20px">Merci pour votre confiance ! L administrateur va valider votre paiement et vous envoyer votre ticket Mikrotik.</p><button class="btn btn-primary btn-full" onclick="closeModal();cPage(\'home\',document.getElementById(\'cnav-home\'))">Genial, merci ! ✓</button></div>');
  }catch(e){toast('Erreur lors de l envoi. Reessayez.','error');}
}

// CLIENT MESSAGES avec BOT IA
async function renderClientMessages(){
  document.getElementById('c-msg-dot').style.display='none';
  const c=document.getElementById('c-content');
  try{
    const msgs=await sbGet('messages','client_id=eq.'+me.id+'&order=created_at.asc');
    let html='<div class="fade-up"><div class="page-header"><div class="page-title">💬 Messages</div><div class="page-sub">Support NTY Starnet</div></div>';
    html+='<div class="chat-tabs"><button class="chat-tab active" id="tab-bot" onclick="switchChatTab(\'bot\')">🤖 Assistant IA</button><button class="chat-tab" id="tab-admin" onclick="switchChatTab(\'admin\')">👨‍💼 Admin</button></div>';

    // BOT IA
    html+='<div id="chat-bot-panel"><div class="chat-card"><div class="chat-header"><div class="chat-avatar">🤖</div><div><div class="chat-name">Assistant NTY Starnet IA</div><div class="chat-status" style="color:var(--accent2)">● Disponible 24h/24</div></div></div>';
    html+='<div class="msg-list" id="bot-msg-list">';
    const botMsgs=JSON.parse(localStorage.getItem('nty_bot_msgs_'+me.id)||'[]');
    if(!botMsgs.length){
      html+='<div class="msg-wrap msg-recv"><div class="bubble bubble-recv">👋 Bonjour ! Je suis votre assistant NTY Starnet intelligent.<br><br>Je peux vous aider avec :<br>📶 Se connecter au WiFi<br>📡 Configurer votre capteur<br>🔧 Depanner votre connexion<br>💳 Renouveler votre abonnement<br><br>Posez-moi votre question en langage naturel, je comprends tout ! 😊</div></div>';
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
    html+='<div class="chat-inp"><button class="chat-photo-btn" onclick="document.getElementById(\'bot-photo-inp\').click()" title="Envoyer une photo">📷</button>';
    html+='<input type="file" id="bot-photo-inp" accept="image/*" style="display:none" onchange="sendBotPhoto()">';
    html+='<input class="chat-inp-field" type="text" id="bot-msg-inp" placeholder="Posez votre question..." onkeydown="if(event.key===\'Enter\')sendBotMsg()">';
    html+='<button class="chat-send-btn" onclick="sendBotMsg()">→</button></div></div></div>';

    // ADMIN
    html+='<div id="chat-admin-panel" style="display:none"><div class="chat-card"><div class="chat-header"><div class="chat-avatar">🛜</div><div><div class="chat-name">NTY Starnet Admin</div><div class="chat-status">● En ligne</div></div></div>';
    html+='<div class="msg-list" id="c-msg-list">';
    if(!msgs.length)html+='<div class="empty"><div class="empty-icon">💬</div><p>Posez votre question a l administrateur !</p></div>';
    else msgs.forEach(m=>{
      const mine=m.sender==='client';
      if(m.content&&m.content.startsWith('[IMG]')){
        html+='<div class="msg-wrap msg-'+(mine?'sent':'recv')+'"><img src="'+m.content.replace('[IMG]','')+'" class="chat-img-preview"><div class="msg-time">'+new Date(m.created_at).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})+'</div></div>';
      } else {
        html+='<div class="msg-wrap msg-'+(mine?'sent':'recv')+'"><div class="bubble bubble-'+(mine?'sent':'recv')+'">'+m.content.replace(/\n/g,'<br>')+'</div><div class="msg-time">'+new Date(m.created_at).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})+'</div></div>';
      }
    });
    html+='</div>';
    html+='<div class="chat-inp"><button class="chat-photo-btn" onclick="document.getElementById(\'admin-photo-inp\').click()" title="Envoyer une photo">📷</button>';
    html+='<input type="file" id="admin-photo-inp" accept="image/*" style="display:none" onchange="sendAdminPhoto()">';
    html+='<input class="chat-inp-field" type="text" id="c-msg-inp" placeholder="Message a l administrateur..." onkeydown="if(event.key===\'Enter\')cSendMsg()">';
    html+='<button class="chat-send-btn" onclick="cSendMsg()">→</button></div></div></div>';

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

function formatBotMsg(text){
  if(!text)return'';
  return text.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`(.+?)`/g,'<code style="background:rgba(99,179,255,0.12);padding:1px 6px;border-radius:4px;font-family:var(--mono);font-size:12px;color:var(--accent2)">$1</code>').replace(/\n/g,'<br>');
}

function sendBotMsg(){
  const inp=document.getElementById('bot-msg-inp');
  if(!inp||!inp.value.trim())return;
  const userText=inp.value.trim();inp.value='';
  const botMsgs=JSON.parse(localStorage.getItem('nty_bot_msgs_'+me.id)||'[]');
  botMsgs.push({from:'user',text:userText,time:now()});
  localStorage.setItem('nty_bot_msgs_'+me.id,JSON.stringify(botMsgs));
  renderClientMessages();
  setTimeout(()=>switchChatTab('bot'),50);
  callAIBot(userText,botMsgs);
}

function callAIBot(userMsg,botMsgs){
  // Bot intelligent local - repond instantanement
  setTimeout(()=>{
    const reply=ntyBotReply(userMsg,botMsgs);
    const msgs=JSON.parse(localStorage.getItem('nty_bot_msgs_'+me.id)||'[]');
    msgs.push({from:'bot',text:reply,time:now()});
    if(msgs.length>50)msgs.splice(0,msgs.length-50);
    localStorage.setItem('nty_bot_msgs_'+me.id,JSON.stringify(msgs));
    renderClientMessages();
    setTimeout(()=>{switchChatTab('bot');const el=document.getElementById('bot-msg-list');if(el)el.scrollTop=el.scrollHeight;},100);
  },800);
}

function ntyBotReply(msg,history){
  const m=msg.toLowerCase().trim();
  const zone=me&&me.zone?me.zone:'';
  const isAnjanahary=zone==='Anjanahary';
  const routerIP=isAnjanahary?'26.26.26.1':'192.168.0.1';
  const poolIP=isAnjanahary?'26.26.26.x':'192.168.0.x';

  if(m.match(/^(bonjour|salut|bonsoir|bonne nuit|allo|hello|hi|slt|bjr|bsr|re|bj)\s*[!?.]*$/)||m.length<4){
    return '👋 Bonjour ! Je suis votre assistant NTY Starnet.\n\nJe peux vous aider avec :\n📶 "connexion" — Se connecter au WiFi\n🎫 "ticket" — Utiliser votre ticket Mikrotik\n📡 "capteur" — Configurer votre equipement\n💡 "temoins" — Voyants lumineux\n🔌 "cables" — Probleme de cablage\n🐢 "lent" — Connexion lente\n❌ "marche pas" — Depannage\n💳 "paiement" — Renouveler\n🌐 "adresse ip" — IP disponible\n\nZone : '+zone+' | Routeur : '+routerIP+'\n\nPosez votre question ! 😊';
  }

  if(m.match(/connect|wifi|reseau|internet|se connecter|comment acceder/)){
    return '📶 Comment se connecter au WiFi NTY Starnet\n\n1. Cherchez le reseau :\n   TNTY_5GHZ/0344127501\n   ou CNTY_5GHZ/0344127501\n   (Relais : meme nom + suffixe Kl, has, FANO...)\n\n2. Mot de passe WiFi : 42024...\n\n3. Ouvrez Chrome → une page de connexion s affiche\n\n4. Entrez votre ticket Mikrotik comme login ET mot de passe\n\n✅ Connecte !\n\n⚠️ Si la page ne s affiche pas, tapez '+routerIP+' dans votre navigateur.';
  }

  if(m.match(/ticket|code|identifiant|mikrotik|login/)){
    return '🎫 Votre Ticket Mikrotik\n\nVotre ticket est affiche sur votre Accueil.\n\nComment l utiliser :\n1. Connectez-vous au WiFi TNTY_5GHZ/0344127501\n2. Ouvrez Chrome\n3. La page de connexion Mikrotik s affiche\n4. Entrez le meme code dans Login ET Mot de passe\n5. Cliquez Se connecter\n\n✅ Si le ticket ne fonctionne plus → abonnement peut-etre expire.\n⚠️ Paiement valide mais pas de ticket → contactez l admin via 👨‍💼 Admin.';
  }

  if(m.match(/page|affiche pas|portail|navigateur|inaccessible|introuvable/)){
    return '🔧 La page de connexion ne s affiche pas ?\n\nSolution 1 — Tapez directement dans votre navigateur :\n'+routerIP+'\n\nSolution 2 — Verifications :\n1. Etes-vous connecte au WiFi NTY Starnet ?\n2. Desactivez votre 4G/5G\n3. Essayez avec Chrome\n4. Videz le cache du navigateur\n\nSolution 3 — Sur Android :\n• Desactivez le WiFi, rallumez-le\n• Acceptez la notification de connexion\n\n💡 Tapez "capteur" pour configurer votre equipement.';
  }

  if(m.match(/temoin|voyant|led|lumiere|clignot|rouge|orange|vert|eteint|allume/)){
    return '💡 Signification des temoins lumineux\n\nSur votre capteur WiFi :\n🟢 Vert fixe = Connexion normale\n🟢 Vert clignotant = Donnees en transit (normal)\n🟠 Orange fixe = Probleme de connexion\n🔴 Rouge fixe = Pas de connexion internet\n⚡ Clignotant rapide = Demarrage, attendez 2 min\n❌ Eteint = Pas d alimentation — verifiez la prise\n\nSur le port cable :\n🟢 Vert = Cable actif\n❌ Eteint = Cable debranche ou defectueux\n\nAction immediate :\n1. Rouge/orange → debranchez 30 sec, rebranchez\n2. Attendez 2 minutes que ca passe au vert\n3. Si ca ne passe pas → verifiez les cables\n\n📷 Envoyez une photo des temoins a l admin via 👨‍💼 Admin !';
  }

  if(m.match(/cable|branche|fil|rj45|prise|debranch|rebranche/)){
    return '🔌 Verification des cables\n\nQuels cables verifier ?\n\n1. Cable alimentation (electrique)\n→ Bien branche dans la prise ?\n→ La prise fonctionne ?\n\n2. Cable reseau (RJ45)\n→ Les deux bouts bien enfonces ? (clic)\n→ Le temoin LED du port doit etre vert\n\n3. Cable vers PC/routeur\n→ Debranchez et rebranchez des deux cotes\n\nProcedure :\n1. Debranchez TOUS les cables\n2. Attendez 10 secondes\n3. Rebranchez : alimentation d abord, reseau ensuite\n4. Attendez 2 minutes, verifiez les temoins\n\n⚠️ Cable plié ou abime → remplacez-le !';
  }

  if(m.match(/tp.?link|tplink/)){
    return '📡 Configuration TP-Link\n\n1. Connectez votre appareil au TP-Link\n\n2. Tapez dans le navigateur :\n   192.168.0.254 ou tplinkwifi.net\n\n3. Login : admin / MDP : admin (ou vide)\n\n4. Allez dans "Mode" → "Client" ou "WISP"\n\n5. Scannez → TNTY_5GHZ/0344127501 → MDP : 42024...\n\n6. Parametres reseau :\n   IP capteur : une IP libre dans '+poolIP+'\n   Masque : 255.255.255.0\n   Passerelle : '+routerIP+'\n   DNS : 8.8.8.8\n\n7. Enregistrez et redemarrez\n\n✅ Attendez 2 minutes puis testez !';
  }

  if(m.match(/comfast|n312|com fast/)){
    return '📡 Configuration Comfast N312\n\n1. Connectez votre appareil au Comfast\n\n2. Tapez dans le navigateur :\n   192.168.10.1\n\n3. Login : admin / MDP : admin\n\n4. "Working Mode" → "Client Mode"\n\n5. "Scan" → TNTY_5GHZ/0344127501 → MDP : 42024...\n\n6. "LAN Settings" :\n   IP : une IP libre dans '+poolIP+'\n   Masque : 255.255.255.0\n   Passerelle : '+routerIP+'\n\n7. "Save & Apply" → Redemarrez\n\n✅ Reconnectez-vous au WiFi Comfast et testez !';
  }

  if(m.match(/tenda/)){
    return '📡 Configuration Tenda\n\n1. Connectez votre appareil au Tenda\n\n2. Tapez dans le navigateur :\n   192.168.0.1 ou tendawifi.com\n\n3. MDP : vide ou admin\n\n4. "Mode" → "Client universel (WISP)"\n\n5. "Selectionner" → TNTY_5GHZ/0344127501 → MDP : 42024...\n\n6. Parametres reseau :\n   IP : une IP libre dans '+poolIP+'\n   Masque : 255.255.255.0\n   Passerelle : '+routerIP+'\n   DNS : 8.8.8.8\n\n7. "Enregistrer" → Redemarrez\n\n✅ Testez apres 1 minute !';
  }

  if(m.match(/capteur|configur|installer|parametre|setup|equipement/)){
    return '📡 Configuration de votre capteur\n\nVotre zone : '+( zone||'Ampasapito')+'\nRouteur NTY : '+routerIP+'\nPool IP disponible : '+poolIP+'\n\nQuelle marque de capteur avez-vous ?\n\n• "TP-Link" → Instructions TP-Link\n• "Comfast" ou "N312" → Instructions Comfast\n• "Tenda" → Instructions Tenda\n\nJe vous donnerai les instructions precises ! 😊';
  }

  if(m.match(/adresse ip|ip libre|ip disponible|quelle ip/)){
    return '🌐 Adresses IP pour votre zone : '+(zone||'Ampasapito')+'\n\nRouteur/Passerelle : '+routerIP+'\nPool disponible : '+poolIP+'\n\nParametres a utiliser :\n• IP capteur : une IP libre dans '+poolIP+'\n• Masque : 255.255.255.0\n• Passerelle : '+routerIP+'\n• DNS primaire : 8.8.8.8\n• DNS secondaire : 8.8.4.4\n\n⚠️ Choisissez une IP pas deja utilisee.\nDemandez a l admin si vous n etes pas sur.';
  }

  if(m.match(/lent|lente|lenteur|vitesse|lag|debit/)){
    return '🐢 Connexion lente — Solutions\n\n1. Verifiez les cables\n→ Cable mal branche = connexion lente\n→ Debranchez/rebranchez fermement\n→ Temoins LED doivent etre verts\n\n2. Redemarrez le capteur\n→ Debranchez 30 secondes, rebranchez\n→ Attendez 2 minutes\n\n3. Verifiez le signal\n→ Rapprochez-vous du capteur\n→ Evitez les obstacles (murs, metal)\n\n4. Verifiez votre quota\n→ Forfait 100Go/200Go ? Verifiez la consommation\n\n5. Heures de pointe\n→ Entre 19h et 22h c est plus lent\n\n6. Redemarrez votre telephone/PC\n\n📷 Si ca persiste, envoyez une photo des temoins a l admin !';
  }

  if(m.match(/marche pas|fonctionne pas|pas de connexion|deconnecte|plus de connexion|ne marche|coupee|rien ne|problem|probleme/)){
    return '❌ Probleme de connexion — Etapes\n\n🔌 ETAPE 1 — Cables\n→ Verifiez que tous les cables sont bien branches\n→ Debranchez et rebranchez fermement\n\n💡 ETAPE 2 — Temoins lumineux\n→ 🟢 Vert = OK\n→ 🟠 Orange = Probleme\n→ ❌ Eteint = Pas d alimentation\n\n🔄 ETAPE 3 — Redemarrez\n→ Debranchez le capteur\n→ Attendez 30 secondes\n→ Rebranchez et attendez 2 minutes\n\n📶 ETAPE 4 — WiFi\n→ Reconnectez-vous a TNTY_5GHZ/0344127501\n→ Desactivez votre 4G/5G\n\n✅ ETAPE 5 — Abonnement\n→ Verifiez que votre abonnement est actif\n\n📷 Envoyez une photo des temoins a l admin via 👨‍💼 Admin !';
  }

  if(m.match(/paiement|payer|renouveler|abonnement|forfait|expir|mvola|mobile money/)){
    return '💳 Renouveler votre abonnement\n\n1. Allez dans l onglet "Paiement" en bas\n\n2. Choisissez votre forfait :\n   100 Go = 40.000 Ar\n   200 Go = 55.000 Ar\n   Illimite 5 appareils = 65.000 Ar\n   Illimite 9+ appareils = 90.000 Ar\n\n3. Envoyez le paiement Mobile Money sur :\n   0344127501 — Rojo Rindra\n   0346341775 — Rasoamanana Ny Tiana\n   0321825114 — Rasoamanana Ny Tiana\n\n⚠️ Frais de retrait a votre charge !\n\n4. Remplissez le formulaire avec date, reference et photo du recu\n\n✅ L administrateur validera rapidement !';
  }

  if(m.match(/courant|electricite|coupure electrique|panne electrique/)){
    return '⚡ Coupure electrique\n\nEn cas de coupure dans votre zone, le WiFi est temporairement indisponible.\n\n✅ La connexion reprendra automatiquement au retour du courant.\n\n⏳ Votre abonnement continue normalement — vous ne perdez pas de jours.\n\nSi la connexion ne revient pas apres le courant :\n1. Redemarrez votre capteur (debranchez 30 sec)\n2. Verifiez les temoins lumineux\n3. Contactez l admin via 👨‍💼 Admin si ca ne revient pas';
  }

  return '🤖 Je n ai pas compris votre question.\n\nEssayez :\n• "connexion" — Se connecter au WiFi\n• "ticket" — Votre ticket Mikrotik\n• "TP-Link" / "Comfast" / "Tenda" — Configurer\n• "temoins" — Voyants lumineux\n• "cables" — Probleme de cables\n• "marche pas" — Connexion en panne\n• "lent" — Connexion lente\n• "paiement" — Renouveler\n\nOu contactez l administrateur via 👨‍💼 Admin — il repond rapidement ! 😊';
}

