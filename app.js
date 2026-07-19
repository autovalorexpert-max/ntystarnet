const SB_URL='https://bpeliducuuagffwlsjal.supabase.co';
const SB_KEY='sb_publishable_3HKOfxQfItpFE8VYDIEULg_j550L4Hi';

async function sb(table,method='GET',body=null,query=''){
  const url=SB_URL+'/rest/v1/'+table+(query?'?'+query:'');
  const headers={'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json','Prefer':'return=representation'};
  const res=await fetch(url,{method,headers,body:body?JSON.stringify(body):null});
  if(!res.ok){const e=await res.text();throw new Error(e);}
  const txt=await res.text();return txt?JSON.parse(txt):[];
}
async function sbGet(t,q=''){return sb(t,'GET',null,q);}
async function sbPost(t,d){return sb(t,'POST',d);}
async function sbPatch(t,q,d){return sb(t,'PATCH',d,q);}
async function sbDelete(t,q){return sb(t,'DELETE',null,q);}

let me=null,selPlanName='100 Go',photoData=null,curChatId=null,curDetailId=null,curPayId=null;
let coupureActive=localStorage.getItem('nty_coupure')==='true';
let coupureMsg=localStorage.getItem('nty_coupure_msg')||'Coupure electrique en cours.';

function showPage(id){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById(id).classList.add('active');}
function now(){return new Date().toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'});}
function today(){return new Date().toISOString().split('T')[0];}
function fmtDate(d){if(!d)return'—';try{return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'});}catch{return d;}}
function fmtDateFull(d){if(!d)return'—';try{return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});}catch{return d;}}
function daysLeft(exp){if(!exp)return null;return Math.ceil((new Date(exp)-new Date())/(1000*60*60*24));}
function addDays(date,days){const d=new Date(date);d.setDate(d.getDate()+days);return d.toISOString().split('T')[0];}
function addOneMonth(date){
  // Debut le 19 juillet → fin le 18 aout (meme jour -1)
  const d=new Date(date);const day=d.getDate();
  d.setMonth(d.getMonth()+1);
  if(d.getDate()!==day)d.setDate(0);
  d.setDate(d.getDate()-1);
  return d.toISOString().split('T')[0];
}
function calcProrata(planPrice,startDate,newDay){
  const priceNum=parseInt((planPrice||'0').replace('.',''))||0;
  const dailyPrice=Math.round(priceNum/30);
  const todayD=new Date();
  let nextDate=new Date(todayD.getFullYear(),todayD.getMonth(),newDay);
  if(nextDate<=todayD)nextDate.setMonth(nextDate.getMonth()+1);
  const days=Math.ceil((nextDate-todayD)/(1000*60*60*24));
  const amount=dailyPrice*days;
  return{days,amount,amountFmt:amount.toLocaleString('fr'),nextDate:nextDate.toISOString().split('T')[0],dailyPrice};
}
function showModal(html){document.getElementById('modal-content').innerHTML=html;document.getElementById('modal').style.display='flex';}
function closeModal(){document.getElementById('modal').style.display='none';}
function initials(n){return(n||'??').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();}
function loading(el){if(el)el.innerHTML='<div class="loading"><div class="spinner"></div><p>Chargement en cours...</p></div>';}
function toast(msg,type='success'){
  const t=document.createElement('div');t.className='toast toast-'+type;t.innerHTML=msg;
  document.body.appendChild(t);setTimeout(()=>t.classList.add('show'),10);
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
    if(admins.length>0){me={...admins[0],role:'admin'};err.style.display='none';showPage('page-admin');checkExpiredClients();aPage('dashboard',null);btn.innerHTML='Se connecter <span>→</span>';btn.disabled=false;return;}
    const clients=await sbGet('clients','username=eq.'+u+'&password=eq.'+p);
    if(clients.length>0){me={...clients[0],role:'client'};err.style.display='none';showPage('page-client');checkExpiredClient(clients[0]);cPage('home',null);btn.innerHTML='Se connecter <span>→</span>';btn.disabled=false;return;}
    err.style.display='flex';err.querySelector('.err-msg').textContent='Identifiants incorrects';
  }catch(e){err.style.display='flex';err.querySelector('.err-msg').textContent='Erreur de connexion. Reessayez.';}
  btn.innerHTML='Se connecter <span>→</span>';btn.disabled=false;
}
function logout(){me=null;document.getElementById('login-user').value='';document.getElementById('login-pass').value='';document.getElementById('login-err').style.display='none';showPage('page-login');}
function togglePass(){const i=document.getElementById('login-pass');i.type=i.type==='password'?'text':'password';}

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
    const gPool=h<5?['Bonne nuit 🌙','Le WiFi veille sur vous 🛡️']:h<12?['Pret a conquerir Internet ? 🚀','Bonjour, votre WiFi vous attend ! 📶']:h<18?['Bon apres-midi connecte ! 🌤','Tout roule de votre cote ? 📡']:['Bonsoir, profitez de votre soiree 🌆','Une bonne connexion pour bien finir 🌟'];
    const greet=gPool[Math.floor(Math.random()*gPool.length)];
    const pct=dl!==null&&dl>0?Math.min(100,Math.round(dl/30*100)):0;
    const fillColor=pct>60?'var(--success)':pct>25?'var(--warning)':'var(--danger)';
    const statusMap={active:'✅ Actif',expired:'❌ Expire',pending:'⏳ En attente'};
    const endFmt=fmtDateFull(u.expiry_date);
    const startFmt=fmtDateFull(u.start_date);
    // Jour de renouvellement
    const renewDay=u.expiry_date?new Date(u.expiry_date).getDate()+1:null;
    let html='<div class="fade-up">';
    html+='<div class="greeting"><div class="greeting-text">'+greet+'</div><div class="greeting-name">'+u.name+'</div></div>';

    // Coupure zone
    const cZ=JSON.parse(localStorage.getItem('nty_coupure_zones')||'{}');
    if(u.zone&&cZ[u.zone]===true){
      const zMsg=localStorage.getItem('nty_coupure_msg_'+u.zone)||'Coupure electrique en cours dans votre zone.';
      html+='<div class="notif-card notif-danger" style="border-width:2px"><div class="notif-icon">🔴</div><div class="notif-body"><div class="notif-title">Coupure en cours — '+u.zone+'</div><div class="notif-msg">'+zMsg+'</div></div></div>';
    }

    // Notifications
    if(u.status==='expired'||dl!==null&&dl<0)html+='<div class="notif-card notif-danger" style="border-width:2px"><div class="notif-icon">🚫</div><div class="notif-body"><div class="notif-title">Connexion coupee automatiquement</div><div class="notif-msg">Votre abonnement a expire le <strong>'+endFmt+'</strong>. Renouvelez pour retablir la connexion.</div></div></div>';
    if(dl!==null&&dl<=5&&dl>0)html+='<div class="notif-card notif-warning"><div class="notif-icon">⏰</div><div class="notif-body"><div class="notif-title">⚠️ Renouvelez maintenant !</div><div class="notif-msg">Votre connexion sera <strong>coupee automatiquement le '+endFmt+' a 23h59</strong> dans <strong>'+dl+' jour(s)</strong>.<br>Payez votre abonnement <strong>avant le '+endFmt+'</strong> pour ne pas perdre votre connexion !</div></div></div>';
    if(dl===0)html+='<div class="notif-card notif-danger" style="border-width:2px"><div class="notif-icon">🚨</div><div class="notif-body"><div class="notif-title">Derniere chance — Expire ce soir !</div><div class="notif-msg">Votre connexion sera <strong>coupee ce soir a 23h59</strong>. Renouvelez <strong>maintenant</strong> pour ne pas perdre votre acces WiFi !</div></div></div>';
    if(pays.some(p=>p.status==='pending'))html+='<div class="notif-card notif-info"><div class="notif-icon">💳</div><div class="notif-body"><div class="notif-title">Paiement en cours de validation</div><div class="notif-msg">Votre paiement est en cours de traitement.</div></div></div>';
    if(u.start_date&&u.expiry_date&&u.status==='active')html+='<div class="notif-card notif-info"><div class="notif-icon">📅</div><div class="notif-body"><div class="notif-title">Periode abonnement</div><div class="notif-msg">Du <strong>'+startFmt+'</strong> au <strong>'+endFmt+' a 23h59</strong>'+(renewDay?' · Renouvellement le <strong>'+renewDay+'</strong> de chaque mois':'')+'.<br>💡 Payez <strong>avant le '+endFmt+'</strong> pour eviter toute coupure.</div></div></div>';
    if(u.status==='active'&&dl!==null&&dl>5)html+='<div class="notif-card notif-subtle"><div class="notif-icon">ℹ️</div><div class="notif-body"><div class="notif-title">Information importante</div><div class="notif-msg">Votre connexion sera <strong>automatiquement coupee</strong> le <strong>'+endFmt+' a 23h59</strong> si vous n avez pas renouvele. Pensez a payer <strong>avant le '+endFmt+'</strong> pour eviter toute interruption !</div></div></div>';

    // Hero card
    html+='<div class="hero-card"><div class="hero-top"><div><div class="hero-label">ABONNEMENT</div><span class="badge badge-'+(u.status||'pending')+'">'+(statusMap[u.status||'pending'])+'</span></div><div class="hero-right"><div class="hero-label">PLAN</div><div class="hero-plan">'+(u.plan||'—')+'</div><div class="hero-price">'+(u.plan_price||'—')+' Ar/mois</div></div></div>';
    html+='<div class="hero-mid"><div><div class="hero-label">EXPIRATION</div><div class="hero-exp">'+(u.expiry_date?endFmt+' a 23h59':'—')+'</div></div><div class="hero-days-wrap"><div class="hero-label">JOURS RESTANTS</div><div class="hero-days" style="color:'+fillColor+'">'+(dl!==null&&dl>=0?dl:'—')+'</div></div></div>';
    if(dl!==null&&dl>=0)html+='<div class="expiry-track"><div class="expiry-fill" style="width:'+pct+'%;background:'+fillColor+'"></div></div>';
    html+='<button class="btn btn-primary btn-full" onclick="cPage(\'paiement\',document.getElementById(\'cnav-paiement\'))">🔄 Renouveler l abonnement</button></div>';

    // Ticket
    if(u.current_ticket)html+='<div class="ticket-card"><div class="ticket-label">🎫 VOTRE TICKET MIKROTIK ACTIF</div><div class="ticket-code">'+u.current_ticket+'</div><div class="ticket-valid">Valable du '+startFmt+' au '+endFmt+' a 23h59</div></div>';

    // Consommation 100Go/200Go
    const isLP=u.plan==='100 Go'||u.plan==='200 Go';
    if(isLP&&u.consumption_pct&&parseInt(u.consumption_pct)>0&&u.status==='active'){
      const cp=parseInt(u.consumption_pct);const rem=100-cp;
      let th,ic,hl;
      if(cp>=90){th='critical';ic='🔴';hl='Quota presque epuise !';}
      else if(cp>=70){th='warning';ic='🟠';hl='Quota en surveillance';}
      else if(cp>=50){th='mid';ic='🟡';hl='Mi-parcours atteint';}
      else{th='good';ic='🟢';hl='Tout va bien';}
      html+='<div class="data-orb-card data-orb-'+th+'"><div class="data-orb-glow"></div><div class="data-orb-top"><div><div class="data-orb-eyebrow">'+ic+' Suivi consommation</div><div class="data-orb-headline">'+hl+'</div></div><div class="data-orb-ring-wrap"><svg class="data-orb-ring" viewBox="0 0 100 100"><circle class="data-orb-track" cx="50" cy="50" r="42"/><circle class="data-orb-progress data-orb-progress-'+th+'" cx="50" cy="50" r="42" style="stroke-dasharray:'+(2*Math.PI*42)+';stroke-dashoffset:'+(2*Math.PI*42*(1-cp/100))+'"/></svg><div class="data-orb-pct">'+cp+'<span>%</span></div></div></div><div class="data-orb-detail">Forfait <strong>'+(u.plan||'')+'</strong> · <strong>'+rem+'%</strong> restant'+(cp>=90?'<br><span class="data-orb-cta">⚡ Renouvelez maintenant !</span>':'')+'</div></div>';
    }

    // Stats
    html+='<div class="stats-row"><div class="stat-pill"><div class="stat-pill-num">'+pays.filter(p=>p.status==='validated').length+'</div><div class="stat-pill-lbl">Paie valides</div></div><div class="stat-pill"><div class="stat-pill-num">'+freeT.length+'</div><div class="stat-pill-lbl">Tickets restants</div></div><div class="stat-pill"><div class="stat-pill-num">'+tix.length+'</div><div class="stat-pill-lbl">Total tickets</div></div></div>';

    // Historique
    if(pays.length>0){
      html+='<div class="section-card"><div class="section-head">📋 Historique paiements</div>';
      pays.forEach(p=>{
        const ic=p.status==='validated'?'✅':p.status==='rejected'?'❌':'⏳';
        const typeTag=p.payment_type==='prorata'?'<span class="tag-prorata">📅 PRORATA</span>':'<span class="tag-abo">🔄 ABONNEMENT</span>';
        html+='<div class="history-row"><div class="history-left"><div class="history-icon">'+ic+'</div><div><div class="history-plan">'+p.plan+' '+typeTag+'</div><div class="history-date">'+fmtDate(p.payment_date)+' · Ref: '+(p.reference||'—')+'</div></div></div><div class="history-right"><div class="history-amount">'+(p.amount||'—')+' Ar</div><span class="badge badge-'+p.status+'" style="font-size:10px">'+({validated:'Valide',pending:'En attente',rejected:'Refuse'}[p.status])+'</span></div></div>';
      });
      html+='</div>';
    }
    html+='</div>';c.innerHTML=html;
  }catch(e){c.innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><p>Erreur<br><button class="btn btn-ghost" onclick="cPage(\'home\',null)" style="margin-top:12px;width:auto;padding:10px 20px">Reessayer</button></p></div>';}
}

// CLIENT PAIEMENT
function renderClientPaiement(){
  const c=document.getElementById('c-content');photoData=null;
  const plans=[{n:'100 Go',p:'40.000',d:'Valable 1 mois',icon:'📶'},{n:'200 Go',p:'55.000',d:'Valable 1 mois',icon:'📶'},{n:'Illimite 6 appareils',p:'65.000',d:'1 mois · 6 appareils',icon:'🏠'},{n:'Illimite 9+ appareils',p:'90.000',d:'1 mois · 9+ appareils',icon:'🏢'}];
  const nums=[{n:'0344127501',name:'Rojo Rindra'},{n:'0346341775',name:'Rasoamanana Ny Tiana'},{n:'0321825114',name:'Rasoamanana Ny Tiana'}];
  let html='<div class="fade-up"><div class="page-header"><div class="page-title">💳 Paiement</div><div class="page-sub">Renouveler ou changer de date</div></div>';

  // Section prorata si abonnement actif
  if(me.status==='active'&&me.expiry_date){
    const expDay=new Date(me.expiry_date).getDate()+1;
    html+='<div class="prorata-card">';
    html+='<div class="prorata-title">📅 Changer ma date de renouvellement</div>';
    html+='<div class="prorata-steps">';
    html+='<div class="prorata-step"><div class="prorata-step-num">1</div><div class="prorata-step-text"><strong>Choisissez votre nouvelle date</strong><br>Selectionnez le jour du mois ou vous souhaitez renouveler desormais.</div></div>';
    html+='<div class="prorata-step"><div class="prorata-step-num">2</div><div class="prorata-step-text"><strong>Calculez le montant</strong><br>L application calcule automatiquement le montant a payer pour couvrir les jours entre votre date actuelle et votre nouvelle date. Ce montant est base sur votre prix journalier (prix mensuel ÷ 30).</div></div>';
    html+='<div class="prorata-step"><div class="prorata-step-num">3</div><div class="prorata-step-text"><strong>Payez le prorata</strong><br>Envoyez le montant calcule par Mobile Money, puis soumettez votre demande avec la photo du recu.</div></div>';
    html+='<div class="prorata-step"><div class="prorata-step-num">4</div><div class="prorata-step-text"><strong>Validation par l administrateur</strong><br>Apres validation, votre date de renouvellement change automatiquement. Ce changement est definitif.</div></div>';
    html+='<div class="prorata-step"><div class="prorata-step-num">5</div><div class="prorata-step-text"><strong>Nouveau cycle</strong><br>A partir de votre nouvelle date, vous renouvelez votre abonnement complet chaque mois a cette meme date.</div></div>';
    html+='</div>';
    html+='<div class="prorata-info-box">ℹ️ Exemple : Vous payez le <strong>9</strong> du mois et voulez passer au <strong>20</strong>. Vous payez le prorata pour 11 jours, puis le <strong>20</strong> vous payez votre abonnement complet normalement.</div>';
    html+='<div class="prorata-desc" style="margin-top:12px">Votre date actuelle : renouvellement le <strong>'+expDay+'</strong> de chaque mois.</div>';
    html+='<label class="inp-label">Nouvelle date souhaitee</label>';
    html+='<select class="inp" id="prorata-day" onchange="calcProrataDisplay()">';
    for(let d=1;d<=28;d++){html+='<option value="'+d+'"'+(d===expDay?' selected':'')+'>Le '+d+' de chaque mois</option>';}
    html+='</select>';
    html+='<div id="prorata-result" style="display:none"></div>';
    html+='<button class="btn btn-secondary btn-full" onclick="calcProrataDisplay()" style="margin-bottom:8px">🧮 Calculer le prorata</button>';
    html+='<button class="btn btn-full" id="prorata-pay-btn" style="display:none;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-weight:700" onclick="showProrataPayment()">💳 Payer le prorata</button>';
    html+='</div>';
  }

  html+='<div class="pay-box"><div class="pay-box-title">📲 Paiement Mobile Money</div>';
  nums.forEach(num=>{html+='<div class="pay-num-row"><div class="pay-num">'+num.n+'</div><div class="pay-num-name">'+num.name+'</div></div>';});
  html+='<div class="pay-box-warn">⚠️ Frais de retrait a votre charge — envoyez le montant exact + frais.</div></div>';
  html+='<div class="section-card"><div class="section-head">🔄 Renouveler l abonnement</div>';
  plans.forEach((pl,i)=>{html+='<div class="plan-card'+(i===0?' selected':'')+'" onclick="selPlan(this,\''+pl.n+'\')"><div class="plan-icon">'+pl.icon+'</div><div class="plan-info"><div class="plan-name">'+pl.n+'</div><div class="plan-desc">'+pl.d+'</div></div><div class="plan-price">'+pl.p+' Ar</div></div>';});
  html+='</div><div class="section-card"><div class="section-head">Details du paiement</div>';
  html+='<label class="inp-label">Date du paiement *</label><input class="inp" type="date" id="c-paydate" max="'+today()+'">';
  html+='<label class="inp-label">Nom de l envoyeur</label><input class="inp" type="text" id="c-payref" placeholder="Ex: Rakoto Jean">';
  html+='<label class="inp-label">Photo du recu</label>';
  html+='<div class="upload-zone" id="upload-zone" onclick="document.getElementById(\'c-photo\').click()"><div class="upload-icon">📷</div><div class="upload-text">Appuyer pour ajouter une photo</div><input type="file" id="c-photo" accept="image/*" style="display:none" onchange="previewPhoto()"></div>';
  html+='<div id="photo-preview" style="display:none;margin-bottom:12px"><img id="preview-img" style="width:100%;border-radius:12px;max-height:200px;object-fit:cover"><button class="btn btn-ghost" style="margin-top:8px" onclick="removePhoto()">🗑 Supprimer</button></div>';
  html+='<button class="btn btn-primary btn-full" onclick="submitPay()">📤 Envoyer la demande</button></div></div>';
  c.innerHTML=html;selPlanName='100 Go';
}

function calcProrataDisplay(){
  const dayEl=document.getElementById('prorata-day');
  const day=parseInt(dayEl?dayEl.value:0);
  if(!day||!me.expiry_date)return;
  const expDay=new Date(me.expiry_date).getDate()+1;
  const resultDiv=document.getElementById('prorata-result');
  const payBtn=document.getElementById('prorata-pay-btn');
  if(day===expDay){resultDiv.style.display='none';payBtn.style.display='none';return;}
  const p=calcProrata(me.plan_price,me.start_date,day);
  resultDiv.style.display='block';
  resultDiv.innerHTML='<div class="prorata-result-box">'
    +'<div class="prorata-result-row"><span>📅 Nouvelle date</span><strong>Le '+day+' de chaque mois</strong></div>'
    +'<div class="prorata-result-row"><span>🗓 Valable jusqu au</span><strong>'+fmtDateFull(p.nextDate)+'</strong></div>'
    +'<div class="prorata-result-row"><span>📆 Jours couverts</span><strong>'+p.days+' jours</strong></div>'
    +'<div class="prorata-result-row"><span>💰 Prix par jour</span><strong>'+p.dailyPrice.toLocaleString('fr')+' Ar</strong></div>'
    +'<div class="prorata-result-row prorata-total"><span>💳 MONTANT PRORATA</span><strong>'+p.amountFmt+' Ar</strong></div>'
    +'</div>';
  payBtn.style.display='block';
  payBtn.setAttribute('data-day',day);
  payBtn.setAttribute('data-amount',p.amountFmt);
  payBtn.setAttribute('data-nextdate',p.nextDate);
}

function showProrataPayment(){
  const btn=document.getElementById('prorata-pay-btn');
  const newDay=btn.getAttribute('data-day');
  const amount=btn.getAttribute('data-amount');
  const nextDate=btn.getAttribute('data-nextdate');
  photoData=null;
  showModal(
    '<div class="modal-title">📅 Paiement Prorata <button class="modal-close" onclick="closeModal()">×</button></div>'
    +'<div class="prorata-result-box" style="margin-bottom:12px">'
    +'<div class="prorata-result-row"><span>Nouvelle date</span><strong>Le '+newDay+' de chaque mois</strong></div>'
    +'<div class="prorata-result-row"><span>Valable jusqu au</span><strong>'+fmtDateFull(nextDate)+'</strong></div>'
    +'<div class="prorata-result-row prorata-total"><span>MONTANT A PAYER</span><strong>'+amount+' Ar</strong></div>'
    +'</div>'
    +'<div class="pay-box" style="margin-bottom:12px"><div class="pay-box-title">📲 Envoyez sur</div>'
    +'<div class="pay-num-row"><div class="pay-num">0344127501</div><div class="pay-num-name">Rojo Rindra</div></div>'
    +'<div class="pay-num-row"><div class="pay-num">0346341775</div><div class="pay-num-name">Rasoamanana Ny Tiana</div></div>'
    +'<div class="pay-box-warn">⚠️ Frais de retrait a votre charge</div></div>'
    +'<label class="inp-label">Date du paiement *</label><input class="inp" type="date" id="prorata-paydate" max="'+today()+'">'
    +'<label class="inp-label">Nom de l envoyeur</label><input class="inp" type="text" id="prorata-ref" placeholder="Ex: Rakoto Jean">'
    +'<label class="inp-label">Photo du recu</label>'
    +'<div class="upload-zone" id="prorata-upload-zone" onclick="document.getElementById(\'pp-photo\').click()"><div class="upload-icon">📷</div><div class="upload-text">Ajouter une photo</div><input type="file" id="pp-photo" accept="image/*" style="display:none" onchange="previewProrataPhoto()"></div>'
    +'<div id="pp-preview" style="display:none;margin-bottom:12px"><img id="pp-img" style="width:100%;border-radius:12px;max-height:180px;object-fit:cover"><button class="btn btn-ghost" style="margin-top:8px" onclick="removeProrataPhoto()">🗑 Supprimer</button></div>'
    +'<button class="btn btn-primary btn-full" onclick="submitProrata(\''+newDay+'\',\''+amount+'\',\''+nextDate+'\')">📤 Envoyer la demande prorata</button>'
    +'<button class="btn btn-ghost btn-full" onclick="closeModal()">Annuler</button>'
  );
}
function previewProrataPhoto(){
  const f=document.getElementById('pp-photo').files[0];if(!f)return;
  const r=new FileReader();r.onload=e=>{photoData=e.target.result;document.getElementById('pp-img').src=photoData;document.getElementById('pp-preview').style.display='block';document.getElementById('prorata-upload-zone').style.display='none';};r.readAsDataURL(f);
}
function removeProrataPhoto(){photoData=null;document.getElementById('pp-photo').value='';document.getElementById('pp-preview').style.display='none';document.getElementById('prorata-upload-zone').style.display='block';}
async function submitProrata(newDay,amount,nextDate){
  const d=document.getElementById('prorata-paydate').value;
  if(!d){toast('Veuillez indiquer la date du paiement.','error');return;}
  try{
    await sbPost('payments',{client_id:me.id,client_name:me.name,plan:'Changement date → le '+newDay+' du mois',amount:amount,payment_date:d,reference:document.getElementById('prorata-ref').value||null,status:'pending',photo_url:photoData,payment_type:'prorata',prorata_new_day:parseInt(newDay),prorata_next_date:nextDate});
    closeModal();launchConfetti();
    showModal('<div style="text-align:center;padding:16px"><div style="font-size:56px;margin-bottom:16px">🎉</div><div class="modal-title" style="justify-content:center;margin-bottom:8px">Demande de prorata envoyee !</div><p style="color:var(--text2);font-size:13px;margin-bottom:20px">L administrateur va valider votre prorata. Apres validation, votre date de renouvellement sera le <strong>'+newDay+'</strong> de chaque mois !</p><button class="btn btn-primary btn-full" onclick="closeModal();cPage(\'home\',document.getElementById(\'cnav-home\'))">OK ✓</button></div>');
  }catch(e){toast('Erreur lors de l envoi.','error');}
}

function selPlan(el,name){document.querySelectorAll('.plan-card').forEach(c=>c.classList.remove('selected'));el.classList.add('selected');selPlanName=name;}
function previewPhoto(){const f=document.getElementById('c-photo').files[0];if(!f)return;const r=new FileReader();r.onload=e=>{photoData=e.target.result;document.getElementById('preview-img').src=photoData;document.getElementById('photo-preview').style.display='block';document.getElementById('upload-zone').style.display='none';};r.readAsDataURL(f);}
function removePhoto(){photoData=null;document.getElementById('c-photo').value='';document.getElementById('photo-preview').style.display='none';document.getElementById('upload-zone').style.display='block';}
async function submitPay(){
  const d=document.getElementById('c-paydate').value;
  if(!d){toast('Veuillez indiquer la date du paiement.','error');return;}
  const prices={'100 Go':'40.000','200 Go':'55.000','Illimite 6 appareils':'65.000','Illimite 9+ appareils':'90.000'};
  try{
    await sbPost('payments',{client_id:me.id,client_name:me.name,plan:selPlanName,amount:prices[selPlanName],payment_date:d,reference:document.getElementById('c-payref').value||null,status:'pending',photo_url:photoData,payment_type:'abonnement'});
    await sbPatch('clients','id=eq.'+me.id,{status:'pending'});me.status='pending';photoData=null;
    launchConfetti();
    showModal('<div style="text-align:center;padding:16px"><div style="font-size:56px;margin-bottom:16px">🎉</div><div class="modal-title" style="justify-content:center;margin-bottom:8px">Demande envoyee !</div><p style="color:var(--text2);font-size:13px;margin-bottom:20px">Merci ! L administrateur va valider et vous envoyer votre ticket Mikrotik.</p><button class="btn btn-primary btn-full" onclick="closeModal();cPage(\'home\',document.getElementById(\'cnav-home\'))">Genial, merci ! ✓</button></div>');
  }catch(e){toast('Erreur lors de l envoi.','error');}
}

// CLIENT MESSAGES
async function renderClientMessages(){
  document.getElementById('c-msg-dot').style.display='none';
  const c=document.getElementById('c-content');
  try{
    const msgs=await sbGet('messages','client_id=eq.'+me.id+'&order=created_at.asc');
    let html='<div class="fade-up"><div class="page-header"><div class="page-title">💬 Messages</div><div class="page-sub">Support NTY Starnet</div></div>';
    html+='<div class="chat-tabs"><button class="chat-tab active" id="tab-bot" onclick="switchChatTab(\'bot\')">🤖 Assistant</button><button class="chat-tab" id="tab-admin" onclick="switchChatTab(\'admin\')">👨‍💼 Admin</button></div>';
    html+='<div id="chat-bot-panel"><div class="chat-card"><div class="chat-header"><div class="chat-avatar">🤖</div><div><div class="chat-name">Assistant NTY Starnet</div><div class="chat-status" style="color:var(--accent2)">● Disponible 24h/24</div></div></div>';
    html+='<div class="msg-list" id="bot-msg-list">';
    const botMsgs=JSON.parse(localStorage.getItem('nty_bot_msgs_'+me.id)||'[]');
    if(!botMsgs.length){
      html+='<div class="msg-wrap msg-recv"><div class="bubble bubble-recv">'+formatBotMsg(ntyBotReply('bonjour',[]))+'</div></div>';
    } else {
      botMsgs.forEach(m=>{
        if(m.type==='image')html+='<div class="msg-wrap msg-sent"><img src="'+m.url+'" class="chat-img-preview"><div class="msg-time">'+m.time+'</div></div>';
        else html+='<div class="msg-wrap msg-'+(m.from==='user'?'sent':'recv')+'"><div class="bubble bubble-'+(m.from==='user'?'sent':'recv')+'">'+formatBotMsg(m.text)+'</div><div class="msg-time">'+m.time+'</div></div>';
      });
    }
    html+='</div>';
    html+='<div class="chat-inp"><button class="chat-photo-btn" onclick="document.getElementById(\'bot-photo-inp\').click()" title="Photo">📷</button><input type="file" id="bot-photo-inp" accept="image/*" style="display:none" onchange="sendBotPhoto()"><input class="chat-inp-field" type="text" id="bot-msg-inp" placeholder="Posez votre question..." onkeydown="if(event.key===\'Enter\')sendBotMsg()"><button class="chat-send-btn" onclick="sendBotMsg()">→</button></div></div></div>';
    html+='<div id="chat-admin-panel" style="display:none"><div class="chat-card"><div class="chat-header"><div class="chat-avatar">🛜</div><div><div class="chat-name">NTY Starnet Admin</div><div class="chat-status">● En ligne</div></div></div>';
    html+='<div class="msg-list" id="c-msg-list">';
    if(!msgs.length)html+='<div class="empty"><div class="empty-icon">💬</div><p>Posez votre question a l administrateur !</p></div>';
    else msgs.forEach(m=>{
      const mine=m.sender==='client';
      if(m.content&&m.content.startsWith('[IMG]'))html+='<div class="msg-wrap msg-'+(mine?'sent':'recv')+'"><img src="'+m.content.replace('[IMG]','')+'" class="chat-img-preview"><div class="msg-time">'+new Date(m.created_at).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})+'</div></div>';
      else html+='<div class="msg-wrap msg-'+(mine?'sent':'recv')+'"><div class="bubble bubble-'+(mine?'sent':'recv')+'">'+m.content.replace(/\n/g,'<br>')+'</div><div class="msg-time">'+new Date(m.created_at).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})+'</div></div>';
    });
    html+='</div><div class="chat-inp"><button class="chat-photo-btn" onclick="document.getElementById(\'admin-photo-inp\').click()" title="Photo">📷</button><input type="file" id="admin-photo-inp" accept="image/*" style="display:none" onchange="sendAdminPhoto()"><input class="chat-inp-field" type="text" id="c-msg-inp" placeholder="Message a l administrateur..." onkeydown="if(event.key===\'Enter\')cSendMsg()"><button class="chat-send-btn" onclick="cSendMsg()">→</button></div></div></div>';
    html+='</div>';c.innerHTML=html;
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
function formatBotMsg(text){if(!text)return'';return text.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`(.+?)`/g,'<code style="background:rgba(99,179,255,0.12);padding:1px 6px;border-radius:4px;font-family:var(--mono);font-size:12px;color:var(--accent2)">$1</code>').replace(/\n/g,'<br>');}
function sendBotMsg(){
  const inp=document.getElementById('bot-msg-inp');if(!inp||!inp.value.trim())return;
  const userText=inp.value.trim();inp.value='';
  const botMsgs=JSON.parse(localStorage.getItem('nty_bot_msgs_'+me.id)||'[]');
  botMsgs.push({from:'user',text:userText,time:now()});
  localStorage.setItem('nty_bot_msgs_'+me.id,JSON.stringify(botMsgs));
  renderClientMessages();setTimeout(()=>switchChatTab('bot'),50);
  setTimeout(()=>{
    const msgs=JSON.parse(localStorage.getItem('nty_bot_msgs_'+me.id)||'[]');
    msgs.push({from:'bot',text:ntyBotReply(userText,msgs),time:now()});
    if(msgs.length>50)msgs.splice(0,msgs.length-50);
    localStorage.setItem('nty_bot_msgs_'+me.id,JSON.stringify(msgs));
    renderClientMessages();setTimeout(()=>{switchChatTab('bot');const el=document.getElementById('bot-msg-list');if(el)el.scrollTop=el.scrollHeight;},100);
  },700);
}
function sendBotPhoto(){
  const f=document.getElementById('bot-photo-inp').files[0];if(!f)return;
  const r=new FileReader();r.onload=e=>{
    const url=e.target.result;
    const botMsgs=JSON.parse(localStorage.getItem('nty_bot_msgs_'+me.id)||'[]');
    botMsgs.push({from:'user',type:'image',url:url,time:now()});
    botMsgs.push({from:'bot',text:'📸 Merci pour la capture ! Decrivez : 1️⃣ Quelle marque (TP-Link, Comfast, Tenda...) 2️⃣ Votre zone (Ampasapito ou Anjanahary) 3️⃣ Ce que vous voyez. Envoyez aussi a l admin via 👨‍💼 Admin !',time:now()});
    if(botMsgs.length>50)botMsgs.splice(0,botMsgs.length-50);
    localStorage.setItem('nty_bot_msgs_'+me.id,JSON.stringify(botMsgs));
    renderClientMessages();setTimeout(()=>{switchChatTab('bot');const el=document.getElementById('bot-msg-list');if(el)el.scrollTop=el.scrollHeight;},100);
  };r.readAsDataURL(f);
}
async function sendAdminPhoto(){
  const f=document.getElementById('admin-photo-inp').files[0];if(!f)return;
  if(f.size>5*1024*1024){toast('Image trop grande (max 5MB)','error');return;}
  const r=new FileReader();r.onload=async e=>{
    try{await sbPost('messages',{client_id:me.id,sender:'client',sender_name:me.name,content:'[IMG]'+e.target.result});toast('📷 Photo envoyee !');renderClientMessages();setTimeout(()=>switchChatTab('admin'),100);}
    catch(err){toast('Erreur envoi photo','error');}
  };r.readAsDataURL(f);
}
async function cSendMsg(){
  const inp=document.getElementById('c-msg-inp');if(!inp||!inp.value.trim())return;
  const txt=inp.value.trim();inp.value='';
  try{await sbPost('messages',{client_id:me.id,sender:'client',sender_name:me.name,content:txt});renderClientMessages();setTimeout(()=>switchChatTab('admin'),100);}
  catch(e){inp.value=txt;toast('Erreur envoi','error');}
}

// BOT LOCAL
function ntyBotReply(msg,history){
  const m=msg.toLowerCase().trim();
  const zone=me&&me.zone?me.zone:'';
  const routerIP=zone==='Anjanahary'?'26.26.26.1':'192.168.0.1';
  const poolIP=zone==='Anjanahary'?'26.26.26.x':'192.168.0.x';
  if(m.match(/^(bonjour|salut|bonsoir|bonne nuit|allo|hello|hi|slt|bjr|bsr|re|bj)\s*[!?.]*$/)||m.length<4){
    return '👋 Bonjour ! Je suis votre assistant NTY Starnet.\n\nJe peux vous aider avec :\n📶 "connexion" — Se connecter au WiFi\n🎫 "ticket" — Votre ticket Mikrotik\n📡 "capteur" — Configurer votre equipement\n💡 "temoins" — Voyants lumineux\n🔌 "cables" — Probleme de cablage\n🐢 "lent" — Connexion lente\n❌ "marche pas" — Depannage\n💳 "paiement" — Renouveler\n🌐 "adresse ip" — IP disponible\n\nZone : '+(zone||'non definie')+' | Routeur : '+routerIP+'\n\nPosez votre question ! 😊';
  }
  if(m.match(/connect|wifi|reseau|internet|se connecter|comment acceder/))return '📶 Comment se connecter :\n\n1. Cherchez le reseau WiFi :\n   TNTY_5GHZ/0344127501\n   ou CNTY_5GHZ/0344127501\n   (Relais : meme nom + Kl, has, FANO...)\n\n2. Mot de passe : 42024...\n\n3. Ouvrez Chrome → page de connexion s affiche\n\n4. Entrez votre ticket Mikrotik comme login ET mot de passe\n\n✅ Connecte !\n\n⚠️ Si la page ne s affiche pas, tapez '+routerIP+' dans votre navigateur.';
  if(m.match(/ticket|code|identifiant|mikrotik|login/))return '🎫 Votre Ticket Mikrotik\n\nVotre ticket est affiche sur votre Accueil.\n\nComment l utiliser :\n1. Connectez-vous au WiFi TNTY_5GHZ/0344127501\n2. Ouvrez Chrome\n3. La page Mikrotik s affiche\n4. Entrez le code comme Login ET Mot de passe\n5. Cliquez Se connecter\n\n⚠️ Ticket ne marche plus → abonnement peut-etre expire.\n📞 Contactez l admin via 👨‍💼 Admin si besoin.';
  if(m.match(/page|affiche pas|portail|navigateur|inaccessible/))return '🔧 Page de connexion introuvable ?\n\nSolution 1 — Tapez directement :\n'+routerIP+'\n\nSolution 2 :\n1. Verifiez que vous etes connecte au WiFi NTY\n2. Desactivez votre 4G/5G\n3. Essayez avec Chrome\n4. Videz le cache du navigateur\n\nSolution 3 sur Android :\n• Desactivez/rallumez le WiFi\n• Acceptez la notification de connexion';
  if(m.match(/temoin|voyant|led|lumiere|clignot|rouge|orange/))return '💡 Temoins lumineux :\n\n🟢 Vert fixe = OK\n🟢 Vert clignotant = Donnees en transit (normal)\n🟠 Orange fixe = Probleme de connexion\n🔴 Rouge fixe = Pas d internet\n⚡ Clignotant rapide = Demarrage, attendez 2 min\n❌ Eteint = Pas d alimentation\n\nPort cable :\n🟢 Vert = Cable actif\n❌ Eteint = Cable debranche\n\nSi rouge/orange → debranchez 30 sec, rebranchez\n📷 Envoyez une photo a l admin via 👨‍💼 Admin !';
  if(m.match(/cable|branche|fil|rj45|prise|debranch/))return '🔌 Verification des cables :\n\n1. Cable alimentation\n→ Bien branche dans la prise ?\n\n2. Cable reseau (RJ45)\n→ Les deux bouts enfonces ? (clic)\n→ Temoin LED doit etre vert\n\n3. Cable vers PC/routeur\n→ Debranchez/rebranchez des deux cotes\n\nProcedure :\n1. Debranchez TOUT\n2. Attendez 10 secondes\n3. Rebranchez : alimentation d abord, reseau ensuite\n4. Attendez 2 minutes\n\n⚠️ Cable plié ou abime → remplacez-le !';
  if(m.match(/tp.?link|tplink/))return '📡 Configuration TP-Link :\n\n1. Connectez-vous au TP-Link\n2. Tapez : 192.168.0.254 ou tplinkwifi.net\n3. Login: admin / MDP: admin\n4. Mode → "Client" ou "WISP"\n5. Scan → TNTY_5GHZ/0344127501 → MDP: 42024...\n6. Parametres reseau :\n   IP : une IP libre dans '+poolIP+'\n   Masque : 255.255.255.0\n   Passerelle : '+routerIP+'\n   DNS : 8.8.8.8\n7. Enregistrez et redemarrez\n\n✅ Attendez 2 minutes puis testez !';
  if(m.match(/comfast|n312/))return '📡 Configuration Comfast N312 :\n\n1. Connectez-vous au Comfast\n2. Tapez : 192.168.10.1\n3. Login: admin / MDP: admin\n4. Working Mode → "Client Mode"\n5. Scan → TNTY_5GHZ/0344127501 → MDP: 42024...\n6. LAN Settings :\n   IP : une IP libre dans '+poolIP+'\n   Masque : 255.255.255.0\n   Passerelle : '+routerIP+'\n7. Save & Apply → Redemarrez\n\n✅ Reconnectez-vous au WiFi Comfast et testez !';
  if(m.match(/tenda/))return '📡 Configuration Tenda :\n\n1. Connectez-vous au Tenda\n2. Tapez : 192.168.0.1 ou tendawifi.com\n3. MDP : vide ou admin\n4. Mode → "Client universel (WISP)"\n5. Selectionner → TNTY_5GHZ/0344127501 → MDP: 42024...\n6. Parametres :\n   IP : une IP libre dans '+poolIP+'\n   Masque : 255.255.255.0\n   Passerelle : '+routerIP+'\n   DNS : 8.8.8.8\n7. Enregistrer → Redemarrez\n\n✅ Testez apres 1 minute !';
  if(m.match(/capteur|configur|installer|parametre|setup/))return '📡 Configuration capteur\n\nVotre zone : '+(zone||'Ampasapito')+'\nRouteur : '+routerIP+'\nPool IP : '+poolIP+'\n\nQuelle marque ?\n• "TP-Link" → Instructions TP-Link\n• "Comfast" ou "N312" → Instructions Comfast\n• "Tenda" → Instructions Tenda\n\nJe vous guide ! 😊';
  if(m.match(/adresse ip|ip libre|ip disponible/))return '🌐 Adresses IP - Zone '+(zone||'Ampasapito')+':\n\nPasserelle : '+routerIP+'\nPool : '+poolIP+'\n\nParametres :\n• IP capteur : IP libre dans '+poolIP+'\n• Masque : 255.255.255.0\n• Passerelle : '+routerIP+'\n• DNS : 8.8.8.8 / 8.8.4.4\n\n⚠️ Choisissez une IP non utilisee.\nDemandez a l admin si vous n etes pas sur.';
  if(m.match(/lent|lenteur|vitesse|lag/))return '🐢 Connexion lente :\n\n1. Verifiez les cables → rebranchez fermement\n2. Redemarrez le capteur (30 sec)\n3. Rapprochez-vous du capteur\n4. Verifiez votre quota (100Go/200Go)\n5. Heures de pointe : entre 19h-22h c est plus lent\n6. Redemarrez votre telephone/PC\n\n📷 Si ca persiste, photo des temoins a l admin !';
  if(m.match(/marche pas|fonctionne pas|pas de connexion|deconnecte|probleme/))return '❌ Probleme de connexion :\n\n🔌 ETAPE 1 — Cables\n→ Debranchez/rebranchez tous les cables\n\n💡 ETAPE 2 — Temoins\n→ 🟢 Vert = OK · 🟠 Orange = Probleme · ❌ Eteint = Pas d alim\n\n🔄 ETAPE 3 — Redemarrez\n→ Debranchez 30 secondes, rebranchez, attendez 2 min\n\n📶 ETAPE 4 — WiFi\n→ Reconnectez-vous a TNTY_5GHZ/0344127501\n→ Desactivez 4G/5G\n\n✅ ETAPE 5 — Abonnement\n→ Verifiez que votre abonnement est actif\n\n📷 Photo des temoins a l admin via 👨‍💼 Admin !';
  if(m.match(/paiement|payer|renouveler|forfait|expir/))return '💳 Renouveler :\n\n1. Onglet "Paiement" en bas\n2. Choisissez votre forfait\n3. Payez sur Mobile Money :\n   0344127501 — Rojo Rindra\n   0346341775 / 0321825114 — Ny Tiana\n⚠️ Frais retrait a votre charge\n4. Remplissez le formulaire + photo du recu\n\n✅ Validation rapide par l administrateur !';
  if(m.match(/courant|coupure electrique|panne/))return '⚡ Coupure electrique :\n\nLe WiFi est temporairement indisponible en cas de coupure.\n\n✅ Connexion automatique au retour du courant.\n\n⏳ Votre abonnement continue normalement.\n\nSi ca ne revient pas apres le courant :\n1. Redemarrez votre capteur (30 sec)\n2. Verifiez les temoins\n3. Contactez l admin via 👨‍💼 Admin';
  return '🤖 Je n ai pas compris. Essayez :\n\n• "connexion" — WiFi\n• "ticket" — Mikrotik\n• "TP-Link" / "Comfast" / "Tenda" — Config\n• "temoins" — Voyants\n• "cables" — Cablage\n• "marche pas" — Depannage\n• "lent" — Vitesse\n• "paiement" — Renouveler\n\nOu contactez l admin via 👨‍💼 Admin ! 😊';
}

// CLIENT PROFIL
function renderClientProfil(){
  const u=me;const c=document.getElementById('c-content');
  const joinDays=u.join_date?Math.floor((new Date()-new Date(u.join_date))/(1000*60*60*24)):0;
  let lb='';
  if(joinDays>=365)lb='<div class="loyalty-badge loyalty-legend">👑 Legende NTY</div>';
  else if(joinDays>=180)lb='<div class="loyalty-badge loyalty-vip">💎 Client VIP</div>';
  else if(joinDays>=90)lb='<div class="loyalty-badge loyalty-fidele">⭐ Client fidele</div>';
  else lb='<div class="loyalty-badge loyalty-new">🌱 Nouveau membre</div>';
  let html='<div class="fade-up">';
  html+='<div class="profile-hero" onclick="easterEgg(this)"><div class="profile-avatar">'+initials(u.name)+'</div><div class="profile-name">'+u.name+'</div><div class="profile-username">@'+u.username+'</div>'+lb+'<div style="margin-top:8px"><span class="badge badge-'+(u.status||'pending')+'">'+({active:'✅ Actif',expired:'❌ Expire',pending:'⏳ En attente'}[u.status||'pending'])+'</span></div></div>';
  if(joinDays>0){const hrs=Math.round(joinDays*24*0.7);html+='<div class="fun-stat-card">🔌 Avec nous depuis <strong>'+joinDays+' jour(s)</strong> — environ <strong>'+hrs.toLocaleString('fr')+' heures</strong> de connexion ! ⚡</div>';}
  html+='<div class="section-card"><div class="section-head-row"><div class="section-head">Mes informations</div><button class="btn btn-primary btn-sm" onclick="showEditProfile()">✏️ Modifier</button></div>';
  html+='<div class="info-row"><div class="info-key">👤 Nom</div><div class="info-val">'+(u.name||'—')+'</div></div>';
  html+='<div class="info-row"><div class="info-key">📞 Telephone</div><div class="info-val">'+(u.phone||'—')+'</div></div>';
  html+='<div class="info-row"><div class="info-key">🌐 Adresse IP</div><div class="info-val" style="font-family:var(--mono)">'+(u.ip_address||'Non assignee')+'</div></div>';
  html+='<div class="info-row"><div class="info-key">📍 Zone</div><div class="info-val">'+(u.zone||'—')+'</div></div>';
  html+='<div class="info-row"><div class="info-key">📦 Plan</div><div class="info-val">'+(u.plan||'—')+'</div></div>';
  html+='<div class="info-row"><div class="info-key">📅 Debut</div><div class="info-val">'+fmtDate(u.start_date)+'</div></div>';
  html+='<div class="info-row"><div class="info-key">📅 Fin</div><div class="info-val">'+(u.expiry_date?fmtDate(u.expiry_date)+' a 23h59':'—')+'</div></div>';
  html+='<div class="info-row"><div class="info-key">🗓 Membre depuis</div><div class="info-val">'+fmtDate(u.join_date)+'</div></div></div>';
  html+='<div class="section-card"><div class="section-head">🔐 Securite</div><button class="btn btn-ghost btn-full" onclick="showChangePass()">Changer mon mot de passe</button></div>';
  html+='<button class="btn btn-danger btn-full" style="margin-top:8px" onclick="logout()">🚪 Se deconnecter</button></div>';
  c.innerHTML=html;
}
function showEditProfile(){
  showModal('<div class="modal-title">✏️ Modifier profil <button class="modal-close" onclick="closeModal()">×</button></div><label class="inp-label">Nom complet</label><input class="inp" type="text" id="ep-name" value="'+me.name+'"><label class="inp-label">Telephone</label><input class="inp" type="tel" id="ep-phone" value="'+(me.phone||'')+'"><p style="font-size:11px;color:var(--text3);margin-bottom:12px">Pour modifier username ou plan, contactez l administrateur.</p><button class="btn btn-primary btn-full" onclick="saveProfile()">💾 Enregistrer</button><button class="btn btn-ghost btn-full" onclick="closeModal()">Annuler</button>');
}
async function saveProfile(){
  const name=document.getElementById('ep-name').value.trim();const phone=document.getElementById('ep-phone').value.trim();
  if(!name){toast('Le nom est requis','error');return;}
  try{await sbPatch('clients','id=eq.'+me.id,{name,phone});me.name=name;me.phone=phone;closeModal();toast('✅ Profil mis a jour !');renderClientProfil();}
  catch(e){toast('Erreur','error');}
}
function showChangePass(){showModal('<div class="modal-title">🔐 Changer le mot de passe <button class="modal-close" onclick="closeModal()">×</button></div><label class="inp-label">Mot de passe actuel</label><input class="inp" type="password" id="old-pass"><label class="inp-label">Nouveau mot de passe</label><input class="inp" type="password" id="new-pass"><label class="inp-label">Confirmer</label><input class="inp" type="password" id="conf-pass"><button class="btn btn-primary btn-full" onclick="changePass()">Changer</button><button class="btn btn-ghost btn-full" onclick="closeModal()">Annuler</button>');}
async function changePass(){
  const old=document.getElementById('old-pass').value;const n=document.getElementById('new-pass').value;const conf=document.getElementById('conf-pass').value;
  if(old!==me.password){toast('Mot de passe actuel incorrect','error');return;}
  if(n.length<4){toast('Minimum 4 caracteres','error');return;}
  if(n!==conf){toast('Les mots de passe ne correspondent pas','error');return;}
  try{await sbPatch(me.role==='admin'?'admins':'clients','id=eq.'+me.id,{password:n});me.password=n;closeModal();toast('✅ Mot de passe modifie !');}
  catch(e){toast('Erreur','error');}
}

// ADMIN NAV
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

// ADMIN DASHBOARD
async function renderAdminDashboard(){
  const c=document.getElementById('a-content');
  try{
    const [clients,payments]=await Promise.all([sbGet('clients'),sbGet('payments','order=created_at.desc')]);
    const pPending=payments.filter(p=>p.status==='pending');
    const revenue=payments.filter(p=>p.status==='validated').reduce((s,p)=>s+(parseInt((p.amount||'0').replace(/\./g,''))||0),0);
    const dot=document.getElementById('a-pay-dot');if(dot)dot.style.display=pPending.length>0?'block':'none';
    const soon=clients.filter(x=>{const dl=daysLeft(x.expiry_date);return dl!==null&&dl>=0&&dl<=5;});
    let zones=[];try{zones=await sbGet('zones','order=name.asc');}catch(e){}
    const cZ=JSON.parse(localStorage.getItem('nty_coupure_zones')||'{}');
    let html='<div class="fade-up"><div class="page-header"><div class="page-title">📊 Dashboard</div><div class="page-sub">Vue generale NTY Starnet</div></div>';

    // Coupure par zone
    html+='<div class="coupure-panel-wrap"><div class="coupure-panel-title">⚡ Gestion des coupures</div><div class="zone-grid">';
    zones.forEach(z=>{
      const isOn=cZ[z.name]===true;
      html+='<div class="zone-coupure-card '+(isOn?'zone-on':'zone-off')+'">';
      html+='<div class="zone-card-top"><div class="zone-icon">'+(isOn?'🔴':'🟢')+'</div><div><div class="zone-name">'+z.name+'</div><div class="zone-status">'+(isOn?'Coupure active':'Normal')+'</div></div></div>';
      html+='<div style="display:flex;gap:6px;margin-top:10px">';
      if(isOn)html+='<button class="btn btn-success" style="flex:1;padding:8px;margin:0;font-size:12px" onclick="toggleZoneCoupure(\''+z.name+'\',false)">🟢 Retablir</button>';
      else html+='<button class="btn btn-danger" style="flex:1;padding:8px;margin:0;font-size:12px" onclick="toggleZoneCoupure(\''+z.name+'\',true)">🔴 Coupure</button>';
      html+='<button class="btn btn-ghost" style="width:auto;padding:8px 10px;margin:0;font-size:12px" onclick="showCoupureEdit(\''+z.name+'\')">✏️</button>';
      html+='</div></div>';
    });
    html+='</div><button class="btn btn-ghost btn-full" style="margin-top:8px" onclick="showZoneManager()">⚙️ Gerer les zones</button></div>';

    // Revenue
    html+='<div class="revenue-hero"><div class="revenue-label">💰 REVENUS TOTAUX VALIDES</div><div class="revenue-amount">'+revenue.toLocaleString('fr')+' <span>Ar</span></div><div class="revenue-sub">'+payments.filter(p=>p.status==='validated').length+' paiements · '+clients.filter(x=>x.status==='active').length+' clients actifs</div></div>';
    html+='<div class="stats-grid"><div class="stat-card-admin"><div class="stat-card-num" style="color:var(--accent)">'+clients.length+'</div><div class="stat-card-lbl">Total clients</div></div><div class="stat-card-admin"><div class="stat-card-num" style="color:var(--success)">'+clients.filter(x=>x.status==='active').length+'</div><div class="stat-card-lbl">Actifs</div></div><div class="stat-card-admin"><div class="stat-card-num" style="color:var(--warning)">'+pPending.length+'</div><div class="stat-card-lbl">En attente</div></div><div class="stat-card-admin"><div class="stat-card-num" style="color:var(--danger)">'+clients.filter(x=>x.status==='expired').length+'</div><div class="stat-card-lbl">Expires</div></div></div>';

    // Paiements en attente avec tag ABONNEMENT/PRORATA
    if(pPending.length>0){
      html+='<div class="section-card"><div class="section-head-row"><div class="section-head">🔔 Paiements en attente</div><span class="count-badge">'+pPending.length+'</span></div>';
      const freeT=await sbGet('tickets','is_used=eq.false&order=created_at.asc');
      const nextByClient={};freeT.forEach(t=>{if(!nextByClient[t.client_id])nextByClient[t.client_id]=t;});
      pPending.forEach(p=>{
        const isProrata=p.payment_type==='prorata';
        const typeTag=isProrata?'<span class="tag-prorata">📅 PRORATA</span>':'<span class="tag-abo">🔄 ABONNEMENT</span>';
        const next=!isProrata?nextByClient[p.client_id]:null;
        html+='<div class="pay-item"><div class="pay-item-top"><div><div class="pay-item-name">'+p.client_name+' '+typeTag+'</div><div class="pay-item-sub">'+p.plan+' · '+fmtDate(p.payment_date)+'</div>';
        if(!isProrata)html+=(next?'<div class="pay-item-ticket">🎫 '+next.code+'</div>':'<div class="pay-item-notick">⚠️ Aucun ticket dispo</div>');
        if(isProrata)html+='<div class="pay-item-ticket">📅 Nouvelle date: le '+p.prorata_new_day+' du mois</div>';
        html+='</div><div class="pay-item-amount">'+(p.amount||'—')+' Ar</div></div>';
        html+='<div class="pay-item-btns"><button class="btn btn-success" style="flex:2;padding:10px;margin:0;font-size:13px" onclick="openValidate(\''+p.id+'\')">✓ Valider</button><button class="btn btn-danger" style="flex:1;padding:10px;margin:0;font-size:13px" onclick="curPayId=\''+p.id+'\';rejectConfirm()">✗</button></div></div>';
      });
      html+='</div>';
    }

    // Expirent bientot
    if(soon.length>0){
      html+='<div class="section-card"><div class="section-head">⏰ Expirent dans 5 jours ou moins</div>';
      soon.forEach(x=>{const dl=daysLeft(x.expiry_date);html+='<div class="info-row"><div class="info-key"><div style="font-weight:600">'+x.name+'</div><div style="font-size:11px;color:var(--text3)">'+x.plan+' · expire le '+fmtDate(x.expiry_date)+'</div></div><div class="info-val" style="color:var(--warning);font-family:var(--mono);font-weight:700">'+dl+'j</div></div>';});
      html+='</div>';
    }
    html+='</div>';c.innerHTML=html;
  }catch(e){c.innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><p>Erreur<br><button class="btn btn-ghost" onclick="aPage(\'dashboard\',null)" style="margin-top:12px;width:auto;padding:10px 20px">Reessayer</button></p></div>';}
}

function toggleZoneCoupure(zoneName,active){
  const zones=JSON.parse(localStorage.getItem('nty_coupure_zones')||'{}');
  zones[zoneName]=active;localStorage.setItem('nty_coupure_zones',JSON.stringify(zones));
  coupureActive=Object.values(zones).some(v=>v===true);localStorage.setItem('nty_coupure',coupureActive.toString());
  toast(active?'🔴 Coupure activee pour '+zoneName:'🟢 Connexion retablie pour '+zoneName,active?'error':'success');
  aPage('dashboard',null);
}
function showCoupureEdit(zoneName){
  const zKey='nty_coupure_msg_'+zoneName;
  const cur=localStorage.getItem(zKey)||'Coupure electrique en cours dans votre zone.';
  showModal('<div class="modal-title">✏️ Message pour '+zoneName+' <button class="modal-close" onclick="closeModal()">×</button></div><div class="preset-list"><div class="preset-item" onclick="setPreset(this,\'Coupure electrique en cours — Connexion indisponible. Nous travaillons a retablir le service.\')">⚡ Coupure generale</div><div class="preset-item" onclick="setPreset(this,\'Maintenance en cours — Connexion retablie dans quelques heures.\')">🔧 Maintenance</div><div class="preset-item" onclick="setPreset(this,\'Panne meteorologique — Connexion retablie des que possible.\')">🌩️ Meteo</div></div><label class="inp-label" style="margin-top:14px">Message personnalise</label><textarea class="inp" id="coupure-msg-inp" rows="3">'+cur+'</textarea><button class="btn btn-primary btn-full" onclick="saveCoupureMsg(\''+zKey+'\')">💾 Enregistrer</button><button class="btn btn-ghost btn-full" onclick="closeModal()">Annuler</button>');
}
function setPreset(el,msg){document.querySelectorAll('.preset-item').forEach(i=>i.classList.remove('selected'));el.classList.add('selected');document.getElementById('coupure-msg-inp').value=msg;}
function saveCoupureMsg(zKey){const msg=document.getElementById('coupure-msg-inp').value.trim();if(!msg){toast('Entrez un message','error');return;}localStorage.setItem(zKey,msg);closeModal();toast('✅ Message enregistre !');}
async function showZoneManager(){
  let zones=[];try{zones=await sbGet('zones','order=name.asc');}catch(e){}
  let html='<div class="modal-title">⚙️ Gerer les zones <button class="modal-close" onclick="closeModal()">×</button></div><div style="margin-bottom:14px">';
  zones.forEach(z=>{html+='<div class="info-row"><div class="info-val" style="font-weight:600">📍 '+z.name+'</div><button class="btn btn-danger btn-sm" style="padding:6px 12px;font-size:12px" onclick="deleteZone(\''+z.id+'\',\''+z.name+'\')">🗑</button></div>';});
  if(!zones.length)html+='<div class="empty"><div class="empty-icon">📍</div><p>Aucune zone</p></div>';
  html+='</div><label class="inp-label">Nouvelle zone</label><input class="inp" type="text" id="new-zone-name" placeholder="Ex: Ambohijanaka"><button class="btn btn-primary btn-full" onclick="addZone()">+ Ajouter</button><button class="btn btn-ghost btn-full" onclick="closeModal()">Fermer</button>';
  showModal(html);
}
async function addZone(){const name=document.getElementById('new-zone-name').value.trim();if(!name){toast('Entrez un nom','error');return;}try{await sbPost('zones',{name});toast('✅ Zone "'+name+'" creee !');showZoneManager();}catch(e){toast('Erreur. Zone existe peut-etre deja.','error');}}
async function deleteZone(id,name){if(!confirm('Supprimer la zone "'+name+'" ?'))return;try{await sbDelete('zones','id=eq.'+id);toast('Zone supprimee');showZoneManager();}catch(e){toast('Erreur','error');}}

// ADMIN CLIENTS
async function renderAdminClients(search=''){
  const c=document.getElementById('a-content');
  try{
    let q='order=created_at.desc';if(search)q+='&or=(name.ilike.*'+search+'*,username.ilike.*'+search+'*)';
    const [clients,freeT]=await Promise.all([sbGet('clients',q),sbGet('tickets','is_used=eq.false')]);
    const tCount={};freeT.forEach(t=>{tCount[t.client_id]=(tCount[t.client_id]||0)+1;});
    let html='<div class="fade-up"><div class="page-header-row"><div><div class="page-title">👥 Clients</div><div class="page-sub">'+clients.length+' client(s)</div></div><button class="btn btn-primary btn-sm" onclick="showAddClient()">+ Ajouter</button></div>';
    html+='<div class="search-box"><span class="search-icon">🔍</span><input class="search-inp" type="text" placeholder="Rechercher..." value="'+search+'" oninput="renderAdminClients(this.value)"></div>';
    if(!clients.length)html+='<div class="empty"><div class="empty-icon">👤</div><p>Aucun client</p></div>';
    else{
      html+='<div class="client-list">';
      clients.forEach(cl=>{
        const dl=daysLeft(cl.expiry_date);
        html+='<div class="client-card" onclick="openDetail(\''+cl.id+'\')"><div class="client-avatar">'+initials(cl.name)+'</div><div class="client-info"><div class="client-name">'+cl.name+'</div><div class="client-meta">📍 '+(cl.zone||'—')+' · @'+cl.username+' · '+(tCount[cl.id]||0)+' ticket(s) · '+(dl!==null&&dl>=0?dl+'j':'—')+'</div></div><div class="client-right"><span class="badge badge-'+(cl.status||'pending')+'">'+({active:'Actif',expired:'Expire',pending:'En attente'}[cl.status||'pending'])+'</span><div class="client-arrow">›</div></div></div>';
      });
      html+='</div>';
    }
    html+='</div>';c.innerHTML=html;
  }catch(e){c.innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><p>Erreur</p></div>';}
}

// ADMIN PAIEMENTS
async function renderAdminPaiements(filter='pending'){
  const c=document.getElementById('a-content');
  // Afficher spinner immédiatement
  c.innerHTML='<div class="loading"><div class="spinner"></div><p>Chargement des paiements...</p></div>';
  try{
    let q='order=created_at.desc&limit=50';if(filter)q+='&status=eq.'+filter;
    const [pays,freeT]=await Promise.all([sbGet('payments',q),filter==='pending'||filter===''?sbGet('tickets','is_used=eq.false&order=created_at.asc'):Promise.resolve([])]);
    const nextByClient={};freeT.forEach(t=>{if(!nextByClient[t.client_id])nextByClient[t.client_id]=t;});
    let html='<div class="fade-up"><div class="page-header"><div class="page-title">💳 Paiements</div></div>';
    html+='<div class="filter-tabs"><button class="ftab '+(filter==='pending'?'active':'')+'" onclick="renderAdminPaiements(\'pending\')">En attente</button><button class="ftab '+(filter==='validated'?'active':'')+'" onclick="renderAdminPaiements(\'validated\')">Valides</button><button class="ftab '+(filter===''?'active':'')+'" onclick="renderAdminPaiements(\'\')">Tous</button></div>';
    if(!pays.length)html+='<div class="empty"><div class="empty-icon">💳</div><p>Aucun paiement</p></div>';
    else pays.forEach(p=>{
      const isProrata=p.payment_type==='prorata';
      const typeTag=isProrata?'<span class="tag-prorata">📅 PRORATA</span>':'<span class="tag-abo">🔄 ABONNEMENT</span>';
      const next=(!isProrata&&p.status==='pending')?nextByClient[p.client_id]:null;
      html+='<div class="pay-card"><div class="pay-card-top"><div><div class="pay-card-name">'+p.client_name+' '+typeTag+'</div><div class="pay-card-sub">'+p.plan+' · '+fmtDate(p.payment_date)+'</div><div class="pay-card-ref">Ref: '+(p.reference||'—')+'</div></div><div class="pay-card-right"><div class="pay-card-amount">'+(p.amount||'—')+' Ar</div><span class="badge badge-'+p.status+'">'+({validated:'✅ Valide',pending:'⏳ En attente',rejected:'❌ Refuse'}[p.status])+'</span></div></div>';
      if(p.status==='pending'){
        if(!isProrata)html+=(next?'<div class="ticket-preview">🎫 Prochain ticket: <strong>'+next.code+'</strong></div>':'<div class="ticket-preview" style="color:var(--danger)">⚠️ Aucun ticket disponible</div>');
        if(isProrata)html+='<div class="ticket-preview">📅 Nouvelle date: le <strong>'+p.prorata_new_day+'</strong> de chaque mois · Valable jusqu au <strong>'+fmtDate(p.prorata_next_date)+'</strong></div>';
        html+='<div class="pay-card-btns"><button class="btn btn-success" style="flex:2;padding:10px;margin:0;font-size:13px" onclick="openValidate(\''+p.id+'\')">✓ Valider</button><button class="btn btn-danger" style="flex:1;padding:10px;margin:0;font-size:13px" onclick="curPayId=\''+p.id+'\';rejectConfirm()">✗</button></div>';
      }
      if(p.photo_url)html+='<button class="btn btn-ghost" style="margin-top:8px;padding:8px;font-size:12px;width:auto" onclick="showModal(\'<div class=modal-title>Preuve <button class=modal-close onclick=closeModal()>×</button></div><img src=&quot;'+p.photo_url+'&quot; style=&quot;width:100%;border-radius:12px&quot;>\')">📷 Voir la preuve</button>';
      html+='</div>';
    });
    html+='</div>';c.innerHTML=html;
  }catch(e){c.innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><p>Erreur</p></div>';}
}

// VALIDATE
async function openValidate(payId){
  curPayId=payId;
  try{
    const pays=await sbGet('payments','id=eq.'+payId);const pay=pays[0];
    const isProrata=pay.payment_type==='prorata';
    const cT=!isProrata?await sbGet('tickets','client_id=eq.'+pay.client_id+'&is_used=eq.false&order=created_at.asc&limit=1'):[];
    const next=cT[0];
    let html='<div class="modal-title">'+(isProrata?'📅 Valider Prorata':'✅ Valider Paiement')+' <button class="modal-close" onclick="closeModal()">×</button></div>';
    html+='<div class="modal-client">Client : <strong>'+pay.client_name+'</strong></div>';
    if(isProrata)html+='<div class="tag-prorata" style="display:inline-block;margin-bottom:12px">📅 PRORATA — Changement de date</div>';
    else html+='<div class="tag-abo" style="display:inline-block;margin-bottom:12px">🔄 ABONNEMENT</div>';
    html+=[['Plan/Type',pay.plan],['Montant',(pay.amount||'—')+' Ar'],['Date paiement',fmtDate(pay.payment_date)],['Reference',pay.reference||'—']].map(([k,v])=>'<div class="info-row"><div class="info-key">'+k+'</div><div class="info-val">'+v+'</div></div>').join('');
    if(isProrata)html+='<div class="info-row" style="background:rgba(245,158,11,0.08);border-radius:8px;padding:10px;margin:8px 0"><div class="info-key">📅 Nouvelle date</div><div class="info-val" style="color:var(--warning);font-weight:700">Le '+pay.prorata_new_day+' de chaque mois<br>Valable jusqu au: '+fmtDateFull(pay.prorata_next_date)+'</div></div>';
    if(pay.photo_url)html+='<div style="margin:12px 0"><div class="inp-label">Preuve de paiement</div><img src="'+pay.photo_url+'" style="width:100%;border-radius:12px;max-height:180px;object-fit:cover"></div>';
    if(!isProrata)html+='<div class="ticket-preview-big">'+(next?'<div class="tp-label">🎫 TICKET QUI SERA ENVOYE</div><div class="tp-code">'+next.code+'</div>':'<div style="color:var(--danger);font-size:13px">⚠️ Aucun ticket. Ajoutez-en dans la fiche client.</div>')+'</div>';
    if(!isProrata&&next)html+='<button class="btn btn-success btn-full" onclick="validatePay(\''+payId+'\',\''+next.id+'\',\''+next.code+'\',\''+pay.client_id+'\')">✓ Valider et envoyer le ticket</button>';
    if(isProrata)html+='<button class="btn btn-success btn-full" onclick="validateProrata(\''+payId+'\',\''+pay.client_id+'\',\''+pay.prorata_new_day+'\',\''+pay.prorata_next_date+'\')">✓ Valider le prorata</button>';
    html+='<button class="btn btn-danger btn-full" onclick="closeModal();rejectConfirm()">✗ Refuser</button><button class="btn btn-ghost btn-full" onclick="closeModal()">Annuler</button>';
    showModal(html);
  }catch(e){toast('Erreur chargement','error');}
}

async function validatePay(payId,ticketId,ticketCode,clientId){
  try{
    const startDate=today();const endDate=addOneMonth(startDate);
    const startFmt=fmtDateFull(startDate);const endFmt=fmtDateFull(endDate);
    await Promise.all([
      sbPatch('payments','id=eq.'+payId,{status:'validated'}),
      sbPatch('tickets','id=eq.'+ticketId,{is_used:true,is_current:true}),
      sbPatch('clients','id=eq.'+clientId,{status:'active',current_ticket:ticketCode,start_date:startDate,expiry_date:endDate}),
      sbPost('messages',{client_id:clientId,sender:'admin',sender_name:'Admin',content:'✅ Paiement valide !\n\n🎫 Votre ticket Mikrotik : '+ticketCode+'\n\n📅 Valable du '+startFmt+' au '+endFmt+' a 23h59.\n\n🔄 Prochain renouvellement : le '+new Date(endDate).getDate()+1+' du mois prochain.\n\nConnectez-vous avec ce code sur NTY Starnet ! 🌐'})
    ]);
    closeModal();
    showModal('<div style="text-align:center;padding:16px"><div style="font-size:56px;margin-bottom:12px">🎉</div><div class="modal-title" style="justify-content:center;margin-bottom:8px">Ticket envoye !</div><div class="ticket-preview-big"><div class="tp-label">TICKET ENVOYE</div><div class="tp-code">'+ticketCode+'</div><div style="font-size:12px;color:var(--text3);margin-top:8px">Du '+startFmt+' au '+endFmt+'</div></div><button class="btn btn-primary btn-full" onclick="closeModal();aPage(\'paiements\',null)">OK ✓</button></div>');
  }catch(e){toast('Erreur lors de la validation','error');}
}

async function validateProrata(payId,clientId,newDay,nextDate){
  try{
    const newExpiry=addDays(nextDate,-1);// expiry = veille du prochain renouvellement
    await Promise.all([
      sbPatch('payments','id=eq.'+payId,{status:'validated'}),
      sbPatch('clients','id=eq.'+clientId,{expiry_date:newExpiry}),
      sbPost('messages',{client_id:clientId,sender:'admin',sender_name:'Admin',content:'✅ Prorata valide !\n\n📅 Votre date de renouvellement a ete changee.\n\n🗓 Nouvelle expiration : '+fmtDateFull(newExpiry)+' a 23h59\n🔄 Prochain renouvellement : le '+newDay+' de chaque mois.\n\nMerci pour votre confiance ! 😊'})
    ]);
    closeModal();toast('✅ Prorata valide ! Date changee au '+newDay+' du mois.');
    aPage('paiements',null);
  }catch(e){toast('Erreur validation prorata','error');}
}

function rejectConfirm(){showModal('<div class="modal-title">❌ Refuser <button class="modal-close" onclick="closeModal()">×</button></div><label class="inp-label">Motif (optionnel)</label><input class="inp" type="text" id="reject-reason" placeholder="Ex: Reference incorrecte"><button class="btn btn-danger btn-full" onclick="doReject()">✗ Confirmer</button><button class="btn btn-ghost btn-full" onclick="closeModal()">Annuler</button>');}
async function doReject(){
  const reason=document.getElementById('reject-reason')?.value||'';
  try{
    const pays=await sbGet('payments','id=eq.'+curPayId);const pay=pays[0];
    await Promise.all([sbPatch('payments','id=eq.'+curPayId,{status:'rejected'}),sbPost('messages',{client_id:pay.client_id,sender:'admin',sender_name:'Admin',content:'❌ Votre paiement du '+fmtDate(pay.payment_date)+' a ete refuse.'+(reason?'\nMotif: '+reason:'')+'\nContactez-nous pour plus d informations.'})]);
    closeModal();toast('Paiement refuse');aPage('paiements',null);
  }catch(e){toast('Erreur','error');}
}

// DETAIL CLIENT
async function openDetail(id){
  curDetailId=id;
  try{
    const [clients,tickets]=await Promise.all([sbGet('clients','id=eq.'+id),sbGet('tickets','client_id=eq.'+id+'&order=created_at.asc')]);
    const cl=clients[0];const freeT=tickets.filter(t=>!t.is_used);const dl=daysLeft(cl.expiry_date);
    let editZones=[];try{editZones=await sbGet('zones','order=name.asc');}catch(e){}
    const renewDay=cl.expiry_date?new Date(cl.expiry_date).getDate()+1:null;
    let html='<div class="modal-title"><div style="display:flex;align-items:center;gap:10px"><div class="modal-avatar">'+initials(cl.name)+'</div><div><div>'+cl.name+'</div><div style="font-size:11px;color:var(--text3)">@'+cl.username+' · '+(cl.zone||'—')+'</div></div></div><button class="modal-close" onclick="closeModal()">×</button></div>';
    html+='<div class="dtabs"><button class="dtab active" onclick="dtab(\'info\',this)">Infos</button><button class="dtab" onclick="dtab(\'tickets\',this)">Tickets ('+freeT.length+')</button><button class="dtab" onclick="dtab(\'edit\',this)">Modifier</button></div>';

    // Info tab
    html+='<div id="dt-info">';
    html+=[
      ['Statut','<span class="badge badge-'+(cl.status||'pending')+'">'+({active:'✅ Actif',expired:'❌ Expire',pending:'⏳ En attente'}[cl.status||'pending'])+'</span>'],
      ['Zone','📍 '+(cl.zone||'—')],
      ['Adresse IP','<span style="font-family:var(--mono)">'+(cl.ip_address||'Non assignee')+'</span>'],
      ['Plan',cl.plan||'—'],
      ['Prix',(cl.plan_price||'—')+' Ar/mois'],
      ['Debut',fmtDate(cl.start_date)],
      ['Fin',(cl.expiry_date?fmtDate(cl.expiry_date)+' a 23h59':'—')],
      ['Renouvellement',renewDay?'Le '+renewDay+' de chaque mois':'—'],
      ['Jours restants',dl!==null&&dl>=0?dl+' jours':'—'],
      ['Tickets dispo',freeT.length+' / '+tickets.length],
      ['Telephone',cl.phone||'—']
    ].map(([k,v])=>'<div class="info-row"><div class="info-key">'+k+'</div><div class="info-val">'+v+'</div></div>').join('');

    if(cl.plan==='100 Go'||cl.plan==='200 Go'){
      html+='<div class="divider"></div><div class="inp-label">📊 Consommation ('+cl.plan+')</div>';
      html+='<div style="display:flex;gap:8px;margin-bottom:8px">';
      [25,50,75,90].forEach(pct=>{html+='<button class="btn '+(cl.consumption_pct==pct?'btn-primary':'btn-ghost')+'" style="flex:1;padding:9px;margin:0;font-size:13px" onclick="setConsumption(\''+id+'\','+pct+')">'+pct+'%</button>';});
      html+='</div><button class="btn btn-ghost btn-full" style="margin-bottom:8px" onclick="setConsumption(\''+id+'\',0)">↺ Reinitialiser</button>';
    }

    html+='<div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-success" style="flex:1;padding:10px;margin:0;font-size:13px" onclick="quickStatus(\''+id+'\',\'active\')">✓ Activer</button><button class="btn btn-danger" style="flex:1;padding:10px;margin:0;font-size:13px" onclick="quickStatus(\''+id+'\',\'expired\')">✗ Expirer</button></div>';
    html+='<button class="btn" style="margin-top:8px;background:rgba(239,68,68,0.1);color:var(--danger);border:1px solid rgba(239,68,68,0.2);width:100%" onclick="deleteClient(\''+id+'\',\''+cl.name+'\')">🗑 Supprimer</button></div>';

    // Tickets tab
    html+='<div id="dt-tickets" style="display:none"><label class="inp-label">Ajouter tickets (un par ligne)</label><textarea class="inp" id="new-tickets-inp" placeholder="ABC123-XYZ"></textarea><button class="btn btn-success btn-full" onclick="addMoreTickets(\''+id+'\')">+ Ajouter</button><div style="margin-top:12px">';
    if(!tickets.length)html+='<div class="empty"><div class="empty-icon">🎫</div><p>Aucun ticket</p></div>';
    else tickets.forEach((t,i)=>{html+='<div class="ticket-row '+(t.is_used?'ticket-used':'')+'"><span class="ticket-row-code">'+(i+1)+'. '+t.code+(t.is_current?' 👈':'')+'</span><span class="tag '+(t.is_current?'tag-cur':t.is_used?'tag-used':'tag-free')+'">'+(t.is_current?'Actuel':t.is_used?'Utilise':'Dispo')+'</span></div>';});
    html+='</div></div>';

    // Edit tab
    html+='<div id="dt-edit" style="display:none">';
    html+='<label class="inp-label">Nom complet</label><input class="inp" type="text" id="edit-name" value="'+cl.name+'">';
    html+='<label class="inp-label">Username</label><input class="inp" type="text" id="edit-user" value="'+cl.username+'">';
    html+='<label class="inp-label">Nouveau mot de passe (vide = inchange)</label><input class="inp" type="password" id="edit-pass">';
    html+='<label class="inp-label">Telephone</label><input class="inp" type="tel" id="edit-phone" value="'+(cl.phone||'')+'">';
    html+='<label class="inp-label">🌐 Adresse IP</label><input class="inp" type="text" id="edit-ip" value="'+(cl.ip_address||'')+'" placeholder="Ex: 192.168.0.50">';
    html+='<label class="inp-label">📍 Zone</label><select class="inp" id="edit-zone">'+editZones.map(z=>'<option '+(cl.zone===z.name?'selected':'')+'>'+z.name+'</option>').join('')+'</select>';
    html+='<label class="inp-label">Plan</label><select class="inp" id="edit-plan">'+['100 Go','200 Go','Illimite 6 appareils','Illimite 9+ appareils'].map(p=>'<option '+(cl.plan===p?'selected':'')+'>'+p+'</option>').join('')+'</select>';
    html+='<label class="inp-label" style="color:var(--accent2)">📅 Date de debut abonnement</label><input class="inp" type="date" id="edit-start" value="'+(cl.start_date||'')+'" onchange="autoCalcExpiry()">';
    html+='<label class="inp-label" style="color:var(--accent2)">📅 Date de fin (expiration) — calculee automatiquement</label><input class="inp" type="date" id="edit-expiry" value="'+(cl.expiry_date||'')+'">';
    html+='<button class="btn btn-primary btn-full" onclick="saveClientEdit(\''+id+'\')">💾 Enregistrer</button></div>';

    showModal(html);
  }catch(e){toast('Erreur','error');}
}

function dtab(tab,btn){document.querySelectorAll('#modal-content .dtab').forEach(t=>t.classList.remove('active'));if(btn)btn.classList.add('active');['info','tickets','edit'].forEach(t=>{const el=document.getElementById('dt-'+t);if(el)el.style.display=t===tab?'block':'none';});}
async function quickStatus(id,status){try{await sbPatch('clients','id=eq.'+id,{status});closeModal();toast('Statut mis a jour !');renderAdminClients();}catch(e){toast('Erreur','error');}}
async function deleteClient(id,name){if(!confirm('Supprimer "'+name+'" ? Irreversible.'))return;try{await sbDelete('clients','id=eq.'+id);closeModal();toast('Client supprime');renderAdminClients();}catch(e){toast('Erreur','error');}}
async function addMoreTickets(clientId){const raw=document.getElementById('new-tickets-inp')?.value.trim();if(!raw){toast('Entrez un ticket','error');return;}const codes=raw.split('\n').map(t=>t.trim()).filter(t=>t);try{for(const code of codes){await sbPost('tickets',{client_id:clientId,code,is_used:false,is_current:false});}toast('✅ '+codes.length+' ticket(s) ajoute(s) !');openDetail(clientId);}catch(e){toast('Erreur','error');}}
async function setConsumption(id,pct){
  try{
    await sbPatch('clients','id=eq.'+id,{consumption_pct:pct.toString()});
    if(pct>0)await sbPost('messages',{client_id:id,sender:'admin',sender_name:'Admin',content:'📊 Mise a jour consommation : vous avez utilise '+pct+'% de votre forfait.'+(pct>=90?'\n⚠️ Pensez a renouveler bientot !':'')});
    toast(pct>0?'✅ Consommation : '+pct+'%':'✅ Reinitialise');openDetail(id);
  }catch(e){toast('Erreur','error');}
}
async function saveClientEdit(id){
  const name=document.getElementById('edit-name').value.trim();const user=document.getElementById('edit-user').value.trim().toLowerCase();
  const pass=document.getElementById('edit-pass').value;const phone=document.getElementById('edit-phone').value.trim();
  const ip=document.getElementById('edit-ip').value.trim();const zone=document.getElementById('edit-zone')?.value||'';const plan=document.getElementById('edit-plan').value;
  const prices={'100 Go':'40.000','200 Go':'55.000','Illimite 6 appareils':'65.000','Illimite 9+ appareils':'90.000'};
  if(!name||!user){toast('Nom et username requis','error');return;}
  const startDate=document.getElementById('edit-start')?.value||null;
  const expiryDate=document.getElementById('edit-expiry')?.value||null;
  const updates={name,username:user,phone,ip_address:ip,zone,plan,plan_price:prices[plan]};
  if(startDate)updates.start_date=startDate;
  if(expiryDate)updates.expiry_date=expiryDate;
  if(pass){if(pass.length<4){toast('Mot de passe trop court','error');return;}updates.password=pass;}
  try{await sbPatch('clients','id=eq.'+id,updates);closeModal();toast('✅ Client modifie !');renderAdminClients();}
  catch(e){toast('Erreur. Username peut-etre deja utilise.','error');}
}
async function showAddClient(){
  let zones=[];try{zones=await sbGet('zones','order=name.asc');}catch(e){}
  const zOpts=zones.map(z=>'<option>'+z.name+'</option>').join('');
  showModal('<div class="modal-title">👤 Nouveau client <button class="modal-close" onclick="closeModal()">×</button></div><label class="inp-label">Nom complet *</label><input class="inp" type="text" id="n-name" placeholder="Ex: Rakoto Jean"><label class="inp-label">Username *</label><input class="inp" type="text" id="n-user" placeholder="Ex: rakoto"><label class="inp-label">Mot de passe *</label><input class="inp" type="password" id="n-pass"><label class="inp-label">Telephone</label><input class="inp" type="tel" id="n-phone" placeholder="034 XX XXX XX"><label class="inp-label">🌐 Adresse IP</label><input class="inp" type="text" id="n-ip" placeholder="Ex: 192.168.0.50"><label class="inp-label">📍 Zone *</label><select class="inp" id="n-zone">'+zOpts+'</select><label class="inp-label">Plan</label><select class="inp" id="n-plan"><option>100 Go</option><option>200 Go</option><option>Illimite 6 appareils</option><option>Illimite 9+ appareils</option></select><label class="inp-label">Tickets Mikrotik (un par ligne) *</label><textarea class="inp" id="n-tickets" placeholder="ABC123-XYZ"></textarea><button class="btn btn-primary btn-full" onclick="addClient()">✓ Creer</button><button class="btn btn-ghost btn-full" onclick="closeModal()">Annuler</button>');
}
async function addClient(){
  const name=document.getElementById('n-name').value.trim();const user=document.getElementById('n-user').value.trim().toLowerCase();
  const pass=document.getElementById('n-pass').value;const phone=document.getElementById('n-phone').value.trim();
  const ip=document.getElementById('n-ip').value.trim();const zone=document.getElementById('n-zone').value;
  const plan=document.getElementById('n-plan').value;const raw=document.getElementById('n-tickets').value.trim();
  if(!name||!user||!pass){toast('Remplissez nom, username et mot de passe.','error');return;}
  if(!raw){toast('Ajoutez au moins un ticket.','error');return;}
  const tickets=raw.split('\n').map(t=>t.trim()).filter(t=>t);
  const prices={'100 Go':'40.000','200 Go':'55.000','Illimite 6 appareils':'65.000','Illimite 9+ appareils':'90.000'};
  try{
    const nc=await sbPost('clients',{username:user,password:pass,name,phone,ip_address:ip,zone,plan,plan_price:prices[plan],status:'pending',join_date:today()});
    const clientId=nc[0].id;
    for(const code of tickets){await sbPost('tickets',{client_id:clientId,code,is_used:false,is_current:false});}
    closeModal();
    showModal('<div style="text-align:center;padding:16px"><div style="font-size:56px;margin-bottom:12px">🎉</div><div class="modal-title" style="justify-content:center">Client cree !</div><div class="info-box" style="margin:12px 0"><div class="info-row"><div class="info-key">Nom</div><div class="info-val">'+name+'</div></div><div class="info-row"><div class="info-key">Username</div><div class="info-val" style="font-family:var(--mono)">'+user+'</div></div><div class="info-row"><div class="info-key">Mot de passe</div><div class="info-val" style="font-family:var(--mono)">'+pass+'</div></div><div class="info-row"><div class="info-key">Zone</div><div class="info-val">'+zone+'</div></div></div><button class="btn btn-primary btn-full" onclick="closeModal();renderAdminClients()">OK ✓</button></div>');
  }catch(e){toast('Erreur. Username peut-etre deja utilise.','error');}
}

// ADMIN MESSAGES
async function renderAdminMessages(){
  const c=document.getElementById('a-content');
  try{
    const [clients,allMsgs]=await Promise.all([sbGet('clients','order=created_at.desc'),sbGet('messages','order=created_at.desc')]);
    const lastMsg={};allMsgs.forEach(m=>{if(!lastMsg[m.client_id])lastMsg[m.client_id]=m;});
    let html='<div class="fade-up"><div class="page-header"><div class="page-title">💬 Messages</div></div>';
    if(!clients.length)html+='<div class="empty"><div class="empty-icon">💬</div><p>Aucun client</p></div>';
    else clients.forEach(cl=>{
      const last=lastMsg[cl.id];
      const lastText=last?(last.content.startsWith('[IMG]')?'📷 Photo':''+last.content.substring(0,50)):'Pas de messages';
      html+='<div class="conv-card" onclick="openAdminChat(\''+cl.id+'\',\''+cl.name+'\')"><div class="conv-avatar">'+initials(cl.name)+'</div><div class="conv-info"><div class="conv-name">'+cl.name+'</div><div class="conv-last">'+lastText+'</div></div><div class="conv-right"><span class="badge badge-'+(cl.status||'pending')+'" style="font-size:9px">'+({active:'Actif',expired:'Expire',pending:'En attente'}[cl.status||'pending'])+'</span></div></div>';
    });
    html+='</div>';c.innerHTML=html;
  }catch(e){c.innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><p>Erreur</p></div>';}
}
async function openAdminChat(clientId,clientName){
  curChatId=clientId;
  try{
    const msgs=await sbGet('messages','client_id=eq.'+clientId+'&order=created_at.asc');
    let html='<div class="modal-title"><div>💬 '+clientName+'</div><button class="modal-close" onclick="closeModal()">×</button></div>';
    html+='<div class="msg-list" id="admin-msg-list" style="max-height:300px">';
    if(!msgs.length)html+='<div class="empty"><div class="empty-icon">💬</div><p>Pas de messages</p></div>';
    else msgs.forEach(m=>{
      const mine=m.sender==='admin';
      if(m.content&&m.content.startsWith('[IMG]'))html+='<div class="msg-wrap msg-'+(mine?'sent':'recv')+'"><img src="'+m.content.replace('[IMG]','')+'" class="chat-img-preview"><div class="msg-time">'+new Date(m.created_at).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})+'</div></div>';
      else html+='<div class="msg-wrap msg-'+(mine?'sent':'recv')+'">'+(mine?'':'<div style="font-size:10px;color:var(--text3);margin-bottom:2px">'+m.sender_name+'</div>')+'<div class="bubble bubble-'+(mine?'sent':'recv')+'">'+m.content.replace(/\n/g,'<br>')+'</div><div class="msg-time">'+new Date(m.created_at).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'})+'</div></div>';
    });
    html+='</div><div class="chat-inp"><input class="chat-inp-field" type="text" id="a-msg-inp" placeholder="Repondre..." onkeydown="if(event.key===\'Enter\')aSendMsg()"><button class="chat-send-btn" onclick="aSendMsg()">→</button></div>';
    showModal(html);setTimeout(()=>{const el=document.getElementById('admin-msg-list');if(el)el.scrollTop=el.scrollHeight;},100);
  }catch(e){toast('Erreur','error');}
}
async function aSendMsg(){
  const inp=document.getElementById('a-msg-inp');if(!inp||!inp.value.trim())return;
  const txt=inp.value.trim();inp.value='';
  try{await sbPost('messages',{client_id:curChatId,sender:'admin',sender_name:'Admin',content:txt});openAdminChat(curChatId,document.querySelector('#modal-content .modal-title div')?.textContent?.replace('💬 ','')||'');}
  catch(e){inp.value=txt;toast('Erreur','error');}
}

// ADMIN STATS
async function renderAdminStats(){
  const c=document.getElementById('a-content');
  try{
    const [clients,payments]=await Promise.all([sbGet('clients'),sbGet('payments')]);
    const validated=payments.filter(p=>p.status==='validated');
    const revenue=validated.reduce((s,p)=>s+(parseInt((p.amount||'0').replace(/\./g,''))||0),0);
    const proratas=validated.filter(p=>p.payment_type==='prorata');
    const abonnements=validated.filter(p=>p.payment_type!=='prorata');
    const total=clients.length||1;
    const planCount={};clients.forEach(cl=>{if(cl.plan)planCount[cl.plan]=(planCount[cl.plan]||0)+1;});
    let html='<div class="fade-up"><div class="page-header"><div class="page-title">📈 Statistiques</div></div>';
    html+='<div class="revenue-hero"><div class="revenue-label">💰 REVENUS TOTAUX</div><div class="revenue-amount">'+revenue.toLocaleString('fr')+' <span>Ar</span></div><div class="revenue-sub">'+abonnements.length+' abonnements · '+proratas.length+' proratas</div></div>';
    html+='<div class="stats-grid"><div class="stat-card-admin"><div class="stat-card-num" style="color:var(--accent)">'+clients.length+'</div><div class="stat-card-lbl">Total clients</div></div><div class="stat-card-admin"><div class="stat-card-num" style="color:var(--success)">'+clients.filter(x=>x.status==='active').length+'</div><div class="stat-card-lbl">Actifs</div></div><div class="stat-card-admin"><div class="stat-card-num" style="color:var(--warning)">'+payments.filter(p=>p.status==='pending').length+'</div><div class="stat-card-lbl">En attente</div></div><div class="stat-card-admin"><div class="stat-card-num" style="color:var(--purple)">'+payments.length+'</div><div class="stat-card-lbl">Total paiements</div></div></div>';
    html+='<div class="section-card"><div class="section-head">Repartition clients</div>';
    [{l:'Actifs',v:clients.filter(x=>x.status==='active').length,col:'var(--success)'},{l:'En attente',v:clients.filter(x=>x.status==='pending').length,col:'var(--warning)'},{l:'Expires',v:clients.filter(x=>x.status==='expired').length,col:'var(--danger)'}].forEach(s=>{const pct=Math.round(s.v/total*100);html+='<div class="prog-wrap"><div class="prog-label"><span>'+s.l+'</span><span class="prog-val">'+s.v+' ('+pct+'%)</span></div><div class="prog-bar"><div class="prog-fill" style="width:'+pct+'%;background:'+s.col+'"></div></div></div>';});
    html+='</div>';
    if(Object.keys(planCount).length>0){html+='<div class="section-card"><div class="section-head">Par plan</div>';Object.entries(planCount).forEach(([plan,count])=>{const pct=Math.round(count/total*100);html+='<div class="prog-wrap"><div class="prog-label"><span>'+plan+'</span><span class="prog-val">'+count+'</span></div><div class="prog-bar"><div class="prog-fill" style="width:'+pct+'%;background:var(--accent)"></div></div></div>';});html+='</div>';}
    html+='<div class="section-card"><div class="section-head">🔐 Securite</div><button class="btn btn-ghost btn-full" onclick="showChangePass()">Changer mon mot de passe admin</button></div>';
    html+='</div>';c.innerHTML=html;
  }catch(e){c.innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><p>Erreur</p></div>';}
}

// CONFETTIS & EASTER EGG
function launchConfetti(){
  const colors=['#3b82f6','#60a5fa','#34d399','#fbbf24','#a78bfa','#f87171'];
  const container=document.createElement('div');container.className='confetti-container';document.body.appendChild(container);
  for(let i=0;i<60;i++){const cc=document.createElement('div');cc.className='confetti-piece';cc.style.left=Math.random()*100+'%';cc.style.background=colors[Math.floor(Math.random()*colors.length)];cc.style.animationDelay=(Math.random()*0.4)+'s';cc.style.animationDuration=(2+Math.random()*1.5)+'s';cc.style.width=cc.style.height=(6+Math.random()*6)+'px';cc.style.borderRadius=Math.random()>0.5?'50%':'2px';container.appendChild(cc);}
  setTimeout(()=>container.remove(),3500);
}
let eggClicks=0,eggTimer=null;
function easterEgg(el){
  eggClicks++;clearTimeout(eggTimer);eggTimer=setTimeout(()=>{eggClicks=0;},800);
  if(eggClicks>=5){eggClicks=0;const msgs=['🛰️ Vous avez trouve le secret NTY Starnet !','⭐ Easter egg debloque ! Merci d etre un client fidele.','🚀 Vous etes officiellement un explorateur NTY !'];toast(msgs[Math.floor(Math.random()*msgs.length)]);launchConfetti();}
}

// CSS additionnel pour prorata et tags
const style=document.createElement('style');
style.textContent=`
.prorata-steps{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
.prorata-step{display:flex;gap:12px;align-items:flex-start}
.prorata-step-num{width:26px;height:26px;min-width:26px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center}
.prorata-step-text{font-size:12px;color:var(--text2);line-height:1.5;padding-top:4px}
.prorata-step-text strong{color:var(--text);display:block;margin-bottom:2px}
.prorata-info-box{background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--text2);line-height:1.5}
.prorata-info-box strong{color:var(--accent2)}
.prorata-card{background:linear-gradient(135deg,rgba(245,158,11,0.08),rgba(217,119,6,0.04));border:1px solid rgba(245,158,11,0.25);border-radius:var(--r2);padding:16px;margin-bottom:12px}
.prorata-title{font-size:14px;font-weight:700;color:#fbbf24;margin-bottom:6px}
.prorata-desc{font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.5}
.prorata-result-box{background:var(--card2);border:1px solid var(--border);border-radius:var(--r);padding:12px;margin-bottom:12px}
.prorata-result-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px}
.prorata-result-row:last-child{border-bottom:none}
.prorata-total{background:rgba(245,158,11,0.08);border-radius:6px;padding:8px!important;margin-top:4px}
.prorata-total strong{color:#fbbf24;font-size:16px}
.prorata-modal-info{background:var(--card2);border-radius:var(--r);padding:12px;margin-bottom:12px}
.tag-prorata{background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.3);border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700}
.tag-abo{background:rgba(59,130,246,0.12);color:var(--accent2);border:1px solid rgba(59,130,246,0.25);border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700}
`;
document.head.appendChild(style);

// INIT
// ═══ VÉRIFICATION EXPIRATION AUTOMATIQUE ═══
async function checkExpiredClients(){
  // Vérifie et expire tous les clients dont la date est dépassée (côté admin)
  try{
    const today=new Date().toISOString().split('T')[0];
    // Récupérer tous les clients actifs dont la date d'expiration est dépassée
    const expired=await sbGet('clients','status=eq.active&expiry_date=lt.'+today);
    if(expired.length===0)return;
    // Les mettre en "expired" en batch
    await sbPatch('clients','status=eq.active&expiry_date=lt.'+today,{status:'expired'});
    console.log('✅ '+expired.length+' client(s) expire(s) automatiquement');
  }catch(e){console.log('Erreur vérification expiration:',e);}
}

async function checkExpiredClient(client){
  // Vérifie si CE client spécifique est expiré à sa connexion
  try{
    if(client.status!=='active'||!client.expiry_date)return;
    const today=new Date().toISOString().split('T')[0];
    const expiry=client.expiry_date;
    if(expiry<today){
      // Expirer ce client
      await sbPatch('clients','id=eq.'+client.id,{status:'expired'});
      me.status='expired';
      console.log('✅ Client '+client.name+' expire automatiquement');
    }
  }catch(e){console.log('Erreur vérification client:',e);}
}

function autoCalcExpiry(){
  const startVal=document.getElementById('edit-start')?.value;
  if(!startVal)return;
  // Fin = debut + 1 mois - 1 jour (19 juil → 18 aout)
  const start=new Date(startVal);
  const end=new Date(start);
  const day=end.getDate();
  end.setMonth(end.getMonth()+1);
  if(end.getDate()!==day)end.setDate(0);
  end.setDate(end.getDate()-1);
  const endStr=end.toISOString().split('T')[0];
  const expiryEl=document.getElementById('edit-expiry');
  if(expiryEl)expiryEl.value=endStr;
}

document.addEventListener('DOMContentLoaded',()=>{
  initStars();
  document.getElementById('login-pass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
  document.getElementById('login-user').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('login-pass').focus();});
});
