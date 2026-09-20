const SUPABASE_URL="https://hhmvutunognvlbkeulnf.supabase.co";
const SUPABASE_KEY="sb_publishable_ElleDxRJT85BHFnS8upOmQ_IkvW6MMr";
const supabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
let services=[],currentUser=null,currentProfile=null,channel=null,locationWatch=null;
const STATUS={searching:"Mencari mitra",accepted:"Diterima",on_the_way:"Menuju lokasi",arrived:"Mitra tiba",quoting:"Penawaran harga",awaiting_approval:"Menunggu persetujuan",working:"Sedang dikerjakan",completed:"Selesai",cancelled:"Dibatalkan"};
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const money=v=>v==null?"—":"Rp "+Number(v).toLocaleString("id-ID");
const msg=(t,s)=>'<div class="'+t+'">'+esc(s)+'</div>';
const errorText=e=>e?.message||"Terjadi kesalahan.";
const scrollToId=id=>$(id)?.scrollIntoView({behavior:"smooth"});
function showModal(h){$("modalBody").innerHTML=h;$("modal").classList.remove("hidden")}
function closeModal(){$("modal").classList.add("hidden")}
async function getUser(){return(await supabase.auth.getUser()).data.user}
async function loadServices(){
 const fallback=[
  ["service-ac","Service AC","Perawatan dan perbaikan AC","❄️"],["service-elektronik","Service Elektronik","Perbaikan perangkat elektronik","📺"],
  ["tukang-listrik","Tukang Listrik","Instalasi dan perbaikan listrik","⚡"],["tukang-bangunan","Tukang Bangunan","Pekerjaan bangunan dan renovasi","🧱"],
  ["antar-motor","Jasa Antar (Motor)","Pengantaran menggunakan motor","🛵"],["antar-mobil","Jasa Antar (Mobil)","Pengantaran menggunakan mobil","🚗"]
 ].map(x=>({id:x[0],name:x[1],description:x[2],icon:x[3],active:true}));
 const r=await supabase.from("services").select("id,name,description,icon,active").eq("active",true).order("name");
 services=r.error||!r.data?.length?fallback:r.data;
 if($("services"))$("services").innerHTML=services.map(s=>'<button type="button" class="card" data-id="'+esc(s.id)+'"><span class="icon">'+esc(s.icon||"🛠️")+'</span><b>'+esc(s.name)+'</b><span>'+esc(s.description||"")+'</span></button>').join("");
 if($("service"))$("service").innerHTML='<option value="">Pilih layanan</option>'+services.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>').join("");
 document.querySelectorAll(".card[data-id]").forEach(x=>x.onclick=()=>{$("service").value=x.dataset.id;scrollToId("booking")});
}
async function loadProfile(){currentUser=await getUser();currentProfile=null;if(currentUser){const r=await supabase.from("profiles").select("*").eq("id",currentUser.id).maybeSingle();if(!r.error)currentProfile=r.data}}
function authLabel(){const b=$("authBtn");if(!b)return;if(currentUser){b.textContent="Keluar";b.removeAttribute("href");b.onclick=async()=>{stopLocationWatch();await supabase.auth.signOut();location.reload()}}else{b.textContent="Masuk";b.href="login.html"}}
async function refresh(){await loadProfile();authLabel();if(currentUser){$("dashboard").classList.remove("hidden");await renderDashboard();subscribeRealtime()}else{$("dashboard").classList.add("hidden");if(channel){supabase.removeChannel(channel);channel=null}}}
function subscribeRealtime(){if(channel)supabase.removeChannel(channel);channel=supabase.channel("jasaaja-"+currentUser.id).on("postgres_changes",{event:"*",schema:"public",table:"orders"},()=>renderDashboard()).on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:"user_id=eq."+currentUser.id},()=>renderDashboard()).on("postgres_changes",{event:"*",schema:"public",table:"partner_locations"},()=>currentProfile?.role==="customer"&&renderDashboard()).subscribe()}
function authForm(mode="login"){
 showModal('<h2>'+(mode==="login"?"Masuk":"Daftar")+'</h2><p class="muted">'+(mode==="login"?"Masuk untuk memesan jasa.":"Buat akun customer atau mitra.")+'</p>'+
 '<label>Nama<input id="fName" '+(mode==="login"?'style="display:none"':'required')+' placeholder="Nama lengkap"></label>'+
 '<label>No. HP<input id="fPhone" '+(mode==="login"?'style="display:none"':'')+' placeholder="08xxxxxxxxxx"></label>'+
 '<label>Email<input id="fEmail" type="email" required></label><label>Password<input id="fPass" type="password" minlength="6" required></label>'+
 (mode==="register"?'<label>Daftar sebagai<select id="fRole"><option value="customer">Customer</option><option value="mitra">Mitra</option></select></label>':"")+
 '<div class="actions"><button class="cta" id="authSubmit">'+(mode==="login"?"Masuk":"Daftar")+'</button><button class="secondary" id="switchAuth">'+(mode==="login"?"Buat akun":"Sudah punya akun")+'</button></div><div id="authMsg"></div>');
 $("switchAuth").onclick=()=>authForm(mode==="login"?"register":"login");
 $("authSubmit").onclick=async()=>{
  const email=$("fEmail").value.trim(),password=$("fPass").value;let r;
  r=mode==="login"?await supabase.auth.signInWithPassword({email,password}):await supabase.auth.signUp({email,password,options:{data:{full_name:$("fName").value.trim(),phone:$("fPhone").value.trim(),role:$("fRole").value}}});
  if(r.error){$("authMsg").innerHTML=msg("error",errorText(r.error));return}
  if(mode==="register"&&!r.data.session){closeModal();alert("Akun dibuat. Jika konfirmasi email aktif, verifikasi email lalu login.");return}
  closeModal();await refresh();
 };
}
if($("locateBtn"))$("locateBtn").onclick=()=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>{$("lat").value=p.coords.latitude;$("lng").value=p.coords.longitude},()=>alert("Izinkan lokasi browser."),{enableHighAccuracy:true,timeout:15000}):alert("GPS tidak didukung.");
if($("orderForm"))$("orderForm").onsubmit=async e=>{
 e.preventDefault();if(!currentUser)return authForm("login");if(currentProfile?.role!=="customer")return alert("Hanya customer yang dapat membuat order.");
 const serviceId=$("service").value,address=$("address").value.trim();if(!serviceId)return alert("Pilih layanan.");if(!address)return alert("Alamat wajib diisi.");
 const r=await supabase.from("orders").insert({customer_id:currentUser.id,service_id:serviceId,address,problem_description:$("problem").value.trim(),latitude:$("lat").value?Number($("lat").value):null,longitude:$("lng").value?Number($("lng").value):null}).select("id").single();
 $("result").innerHTML=r.error?msg("error",errorText(r.error)):msg("success","Order dibuat. Mitra yang sesuai dapat melihatnya.");if(!r.error){e.target.reset();await renderDashboard();scrollToId("dashboard")}
};
async function customerOrders(){const r=await supabase.from("orders").select("*,services(name,icon),profiles:profiles!orders_partner_id_fkey(full_name,phone)").eq("customer_id",currentUser.id).order("created_at",{ascending:false}).limit(30);return r.error?[]:r.data||[]}
async function mitraOrders(){const r=await supabase.from("orders").select("*,services(name,icon),profiles:profiles!orders_customer_id_fkey(full_name,phone)").or("partner_id.eq."+currentUser.id+",status.eq.searching").order("created_at",{ascending:false}).limit(30);return r.error?[]:r.data||[]}
function price(o){if(o.final_price==null&&o.offered_price==null)return"";const base=Number(o.final_price??o.offered_price),fee=Number(o.customer_service_fee||0),total=Number(o.customer_total||base+fee);return'<div class="price-box"><b>Harga jasa: '+money(base)+'</b>'+(fee?'<span>Biaya layanan: '+money(fee)+'</span>':"")+'<strong>Total: '+money(total)+'</strong></div>'}
function orderCard(o,role){
 let a="";
 if(role==="customer"){
  if(o.status==="searching")a='<button class="danger" onclick="cancelOrder(\''+o.id+'\')">Batalkan</button>';
  if(o.status==="awaiting_approval")a='<button class="cta" onclick="approveQuote(\''+o.id+'\')">Setujui '+money(o.offered_price)+'</button><button class="danger" onclick="cancelOrder(\''+o.id+'\')">Tolak</button>';
  if(o.status==="completed")a='<button class="secondary" onclick="payOrder(\''+o.id+'\')">Bayar</button><button class="secondary" onclick="reviewOrder(\''+o.id+'\',\''+(o.partner_id||"")+'\')">Rating</button>';
 }else{
  if(o.status==="searching")a='<button class="cta" onclick="acceptOrder(\''+o.id+'\')">Terima Order</button>';
  if(o.status==="accepted")a='<button class="cta" onclick="setStatus(\''+o.id+'\',\'on_the_way\')">Menuju lokasi</button>';
  if(o.status==="on_the_way")a='<button class="cta" onclick="setStatus(\''+o.id+'\',\'arrived\')">Saya tiba</button>';
  if(o.status==="arrived")a='<button class="cta" onclick="quoteOrder(\''+o.id+'\')">Beri harga</button>';
  if(o.status==="awaiting_approval")a='<span class="notice">Menunggu persetujuan '+money(o.offered_price)+'</span>';
  if(o.status==="working")a='<button class="cta" onclick="setStatus(\''+o.id+'\',\'completed\')">Tandai selesai</button>';
 }
 const maps=o.latitude!=null&&o.longitude!=null?'<a class="secondary" href="https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(o.latitude+","+o.longitude)+'" target="_blank" rel="noopener">🗺️ Maps</a>':"";
 const track=role==="customer"&&o.partner_id&&["accepted","on_the_way","arrived"].includes(o.status)?'<button class="secondary" onclick="showPartnerLocation(\''+o.partner_id+'\')">📍 Lacak</button>':"";
 return'<article class="order"><div class="order-head"><div><b>'+esc((o.services?.icon||"🛠️")+" "+(o.services?.name||"Layanan"))+'</b><div class="small">'+esc(o.address)+'</div></div><span class="badge">'+esc(STATUS[o.status]||o.status)+'</span></div><p class="small">'+esc(o.problem_description||"Tanpa catatan")+'</p>'+
 (o.profiles?'<p class="small">'+esc(role==="mitra"?"Customer: ":"Mitra: ")+esc(o.profiles.full_name||"")+(o.profiles.phone?" · "+esc(o.profiles.phone):"")+'</p>':"")+
 (o.offered_price!=null?'<p><b>Penawaran: '+money(o.offered_price)+'</b></p>':"")+price(o)+'<div class="actions">'+a+maps+track+'</div></article>';
}
async function renderDashboard(){if(!currentUser)return;if(currentProfile?.role==="customer")return renderCustomer();if(currentProfile?.role==="mitra")return renderMitra();if(currentProfile?.role==="admin")return renderAdmin()}
async function renderCustomer(){
 const os=await customerOrders();
 document.body.classList.add("customer-mode");
 $("layanan")?.classList.add("hidden");
 $("booking")?.classList.add("hidden");
 $("cara")?.classList.add("hidden");
 document.querySelector(".hero")?.classList.add("hidden");
 document.querySelector("header")?.classList.add("hidden");
 const d=$("dash");
 d.classList.remove("hidden");
 d.innerHTML='<div class="gojek-app"><div class="app-top"><div><span class="tag">JASA AJA</span><h2>Halo, '+esc(currentProfile?.full_name||"Customer")+'</h2><small class="small">Mau pesan jasa apa hari ini?</small></div><button class="profile-avatar" id="customerProfileBtn">'+esc((currentProfile?.full_name||"J").slice(0,1).toUpperCase())+'</button></div><div id="customerTabContent"></div><div class="bottom-nav"><button data-tab="beranda" class="active"><span>⌂</span>Beranda</button><button data-tab="pesanan"><span>▣</span>Pesanan</button><button data-tab="profil"><span>●</span>Profil</button></div></div>';
 $("customerProfileBtn").onclick=()=>customerTab("profil");
 document.querySelectorAll(".bottom-nav [data-tab]").forEach(b=>b.onclick=()=>customerTab(b.dataset.tab));
 $("customerTabContent").innerHTML=customerHome(os);
}
function customerHome(os){
 return '<div class="customer-banner"><div><b>Butuh bantuan?</b><span>Pesan jasa di sekitar kamu.</span></div><span class="banner-icon">🛠️</span></div><div class="section-title"><h3>Layanan</h3><span>Semua</span></div><div class="customer-services">'+services.map(s=>'<button type="button" data-service="'+esc(s.id)+'"><span>'+esc(s.icon||"🛠️")+'</span><b>'+esc(s.name)+'</b></button>').join("")+'</div><div class="section-title"><h3>Pesanan terbaru</h3><button class="link-btn" id="allOrdersBtn" type="button">Lihat semua</button></div>'+(os.length?orderCard(os[0],"customer"):'<div class="empty-card">Belum ada pesanan.</div>')+'<button class="customer-cta" id="customerBookBtn" type="button">+ Pesan jasa sekarang</button>';
}
async function customerTab(tab){
 const os=await customerOrders();
 const c=$("customerTabContent");
 if(!c)return;
 if(tab==="beranda")c.innerHTML=customerHome(os);
 else if(tab==="pesanan")c.innerHTML='<div class="section-title"><h3>Pesanan Saya</h3><button class="link-btn" id="refreshOrders" type="button">↻</button></div>'+(os.length?os.map(o=>orderCard(o,"customer")).join(""):'<div class="empty-card">Belum ada pesanan.</div>');
 else c.innerHTML='<div class="profile-card"><div class="profile-big">'+esc((currentProfile?.full_name||"J").slice(0,1).toUpperCase())+'</div><h3>'+esc(currentProfile?.full_name||"Customer")+'</h3><p>'+esc(currentUser.email||"")+'</p><p>'+esc(currentProfile?.phone||"No. HP belum diisi")+'</p><button class="danger" id="customerLogout" type="button">Keluar</button></div>';
 document.querySelectorAll(".bottom-nav [data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
 document.querySelectorAll(".customer-services [data-service]").forEach(b=>b.onclick=()=>customerBook(b.dataset.service));
 $("customerBookBtn")?.addEventListener("click",()=>customerBook());
 $("allOrdersBtn")?.addEventListener("click",()=>customerTab("pesanan"));
 $("refreshOrders")?.addEventListener("click",()=>customerTab("pesanan"));
 $("customerLogout")?.addEventListener("click",async()=>{stopLocationWatch();await supabase.auth.signOut();location.reload()});
}
function customerBook(serviceId){
 $("service").value=serviceId||"";
 $("booking")?.classList.remove("hidden");
 $("dashboard")?.classList.remove("hidden");
 scrollToId("booking");
}
async function renderMitra(){
 const os=await mitraOrders(),w=await supabase.from("mitra_wallets").select("balance,total_earned").eq("mitra_id",currentUser.id).maybeSingle(),p=await supabase.from("partner_profiles").select("*").eq("id",currentUser.id).maybeSingle(),ps=await supabase.from("partner_services").select("service_id").eq("partner_id",currentUser.id),po=await supabase.from("payouts").select("amount,status,created_at").eq("mitra_id",currentUser.id).order("created_at",{ascending:false}).limit(5);
 const selected=(ps.data||[]).map(x=>x.service_id),online=!!p.data?.online;
 $("dash").innerHTML='<div class="heading"><span class="tag">MITRA</span><h2>Dashboard Mitra</h2><p class="muted">Status verifikasi: '+(p.data?.verified?"Terverifikasi":"Menunggu admin")+'</p></div>'+
 '<div class="grid2"><div class="stat"><b>'+ (online?"ONLINE":"OFFLINE")+'</b><div class="small">'+(online?"Menerima":"Tidak menerima")+' order</div><button class="secondary" onclick="toggleOnline('+(online?"false":"true")+')">'+(online?"Offline":"Online")+'</button></div>'+
 '<div class="stat"><b>'+os.filter(x=>x.partner_id===currentUser.id).length+'</b><div class="small">Order Anda</div></div><div class="stat"><b>'+money(w.data?.balance||0)+'</b><div class="small">Saldo bersih</div><button class="secondary" onclick="requestPayout()">Tarik saldo</button></div><div class="stat"><b>'+money(w.data?.total_earned||0)+'</b><div class="small">Total penghasilan bersih</div></div></div>'+
 '<div class="order"><b>Layanan yang dikuasai</b><div class="grid2">'+services.map(s=>'<label><input type="checkbox" '+(selected.includes(s.id)?"checked":"")+' onchange="toggleService(\''+s.id+'\',this.checked)"> '+esc(s.icon||"🛠️")+' '+esc(s.name)+'</label>').join("")+'</div></div>'+
 '<h3>Payout terakhir</h3>'+((po.data||[]).map(x=>'<div class="notice">'+money(x.amount)+' · '+esc(x.status)+'</div>').join("")||'<div class="small">Belum ada payout.</div>')+
 '<h3>Order tersedia / aktif</h3>'+(os.length?os.map(o=>orderCard(o,"mitra")).join(""):'<div class="loading">Belum ada order.</div>');
}
async function renderAdmin(){
 const [u,o,p,r,srv,pay,po,set]=await Promise.all([
  supabase.from("profiles").select("id,full_name,phone,role").order("created_at",{ascending:false}).limit(100),
  supabase.from("orders").select("id,status,partner_id,final_price,customer_total,created_at,services(name)").order("created_at",{ascending:false}).limit(100),
  supabase.from("partner_profiles").select("id,verified,online").limit(100),
  supabase.from("reviews").select("rating").limit(100),
  supabase.from("services").select("*").order("name"),
  supabase.from("payments").select("id,order_id,method,amount,status").order("created_at",{ascending:false}).limit(100),
  supabase.from("payouts").select("id,mitra_id,amount,status,bank_name,account_number").order("created_at",{ascending:false}).limit(100),
  supabase.from("app_settings").select("key,value").eq("key","platform").maybeSingle()
 ]);
 const users=u.data||[],partners=p.data||[];
 $("dash").innerHTML='<div class="heading"><span class="tag">SUPER ADMIN</span><h2>Control Center</h2><p class="muted">Pengguna, mitra, order, pembayaran, payout dan layanan.</p></div>'+
 '<div class="grid2"><div class="stat"><b>'+users.length+'</b><div class="small">Pengguna</div></div><div class="stat"><b>'+partners.length+'</b><div class="small">Profil mitra</div></div><div class="stat"><b>'+((o.data||[]).length)+'</b><div class="small">Order</div></div><div class="stat"><b>'+((r.data||[]).length)+'</b><div class="small">Review</div></div></div>'+
 '<h3>Mitra</h3><div class="table-wrap"><table class="table"><tr><th>Nama</th><th>Status</th><th>Aksi</th></tr>'+users.filter(x=>x.role==="mitra").map(x=>{const pp=partners.find(z=>z.id===x.id);return'<tr><td>'+esc(x.full_name||x.phone||x.id.slice(0,8))+'</td><td>'+(pp?.verified?"Verified":"Belum")+'</td><td>'+(pp?'<button class="secondary" onclick="verifyPartner(\''+x.id+'\','+(!pp.verified)+')">'+(pp.verified?"Cabut":"Verifikasi")+'</button>':"—")+'</td></tr>'}).join("")+'</table></div>'+
 '<h3>Pembayaran</h3><div class="table-wrap"><table class="table"><tr><th>Order</th><th>Metode</th><th>Nominal</th><th>Status</th><th>Aksi</th></tr>'+((pay.data||[]).map(x=>'<tr><td>'+esc(x.order_id.slice(0,8))+'</td><td>'+esc(x.method)+'</td><td>'+money(x.amount)+'</td><td>'+esc(x.status)+'</td><td>'+(x.status==="pending"?'<button class="secondary" onclick="markPaymentPaid(\''+x.id+'\')">Paid</button>':"—")+'</td></tr>').join(""))+'</table></div>'+
 '<h3>Payout</h3><div class="table-wrap"><table class="table"><tr><th>Mitra</th><th>Nominal</th><th>Status</th><th>Aksi</th></tr>'+((po.data||[]).map(x=>'<tr><td>'+esc(x.mitra_id.slice(0,8))+'</td><td>'+money(x.amount)+'</td><td>'+esc(x.status)+'</td><td>'+(x.status==="pending"?'<button class="secondary" onclick="markPayoutPaid(\''+x.id+'\')">Paid</button>':"—")+'</td></tr>').join(""))+'</table></div>'+
 '<h3>Layanan</h3><button class="cta" onclick="addService()">+ Tambah layanan</button><div class="table-wrap"><table class="table"><tr><th>Layanan</th><th>Aktif</th><th>Aksi</th></tr>'+((srv.data||[]).map(x=>'<tr><td>'+esc(x.icon||"")+' '+esc(x.name)+'</td><td>'+(x.active?"Ya":"Tidak")+'</td><td><button class="secondary" onclick="toggleActive(\''+x.id+'\','+(!x.active)+')">'+(x.active?"Nonaktifkan":"Aktifkan")+'</button></td></tr>').join(""))+'</table></div>'+
 '<div class="notice">Komisi mitra: '+esc(set.data?.value?.commission_percent??8)+'% · Biaya layanan customer: '+esc(set.data?.value?.customer_service_fee_percent??8)+'%</div>';
}
async function acceptOrder(id){const r=await supabase.from("orders").update({partner_id:currentUser.id,status:"accepted"}).eq("id",id).eq("status","searching");if(r.error)alert(errorText(r.error));else await renderDashboard()}
async function setStatus(id,status){const r=await supabase.from("orders").update({status}).eq("id",id);if(r.error)alert(errorText(r.error));else await renderDashboard()}
async function quoteOrder(id){showModal('<h2>Penawaran Harga</h2><label>Harga jasa<input id="quote" type="number" min="1" required></label><button class="cta" id="sendQuote">Kirim</button>');$("sendQuote").onclick=async()=>{const price=Number($("quote").value);if(!price)return;const r=await supabase.from("orders").update({offered_price:price,status:"awaiting_approval"}).eq("id",id);if(r.error)alert(errorText(r.error));else{closeModal();await renderDashboard()}}}
async function approveQuote(id){const q=await supabase.from("orders").select("offered_price").eq("id",id).eq("customer_id",currentUser.id).single();if(q.error)return alert(errorText(q.error));const r=await supabase.from("orders").update({final_price:q.data.offered_price,status:"working"}).eq("id",id).eq("status","awaiting_approval");if(r.error)alert(errorText(r.error));else await renderDashboard()}
async function cancelOrder(id){if(!confirm("Batalkan pesanan?"))return;const r=await supabase.from("orders").update({status:"cancelled"}).eq("id",id);if(r.error)alert(errorText(r.error));else await renderDashboard()}
function stopLocationWatch(){if(locationWatch!==null&&navigator.geolocation)navigator.geolocation.clearWatch(locationWatch);locationWatch=null}
async function toggleOnline(value){
 const online=typeof value==="string"?value==="true":!!value;if(currentProfile?.role!=="mitra")return;
 if(online){const p=await supabase.from("partner_profiles").select("verified").eq("id",currentUser.id).maybeSingle();if(!p.data?.verified)return alert("Mitra harus diverifikasi admin sebelum Online.")}
 const r=await supabase.from("partner_profiles").upsert({id:currentUser.id,online,updated_at:new Date().toISOString()});if(r.error)return alert(errorText(r.error));stopLocationWatch();
 if(online&&navigator.geolocation)locationWatch=navigator.geolocation.watchPosition(async p=>{const d={partner_id:currentUser.id,latitude:p.coords.latitude,longitude:p.coords.longitude,updated_at:new Date().toISOString()};await supabase.from("partner_locations").upsert(d);await supabase.from("partner_profiles").update({latitude:d.latitude,longitude:d.longitude,updated_at:d.updated_at}).eq("id",currentUser.id)},()=>{},{enableHighAccuracy:true,maximumAge:10000,timeout:15000});
 await renderDashboard();
}
async function showPartnerLocation(id){const r=await supabase.from("partner_locations").select("latitude,longitude,updated_at").eq("partner_id",id).maybeSingle();if(r.error||!r.data)return alert("Lokasi mitra belum tersedia.");showModal('<h2>Lokasi Mitra</h2><p>Update: '+esc(new Date(r.data.updated_at).toLocaleString("id-ID"))+'</p><p><b>'+esc(r.data.latitude)+', '+esc(r.data.longitude)+'</b></p><a class="cta" href="https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(r.data.latitude+","+r.data.longitude)+'" target="_blank" rel="noopener">Buka Google Maps</a>')}
async function requestPayout(){const amount=Number(prompt("Jumlah tarik saldo (Rp):","50000"));if(!amount||amount<=0)return;const w=await supabase.from("mitra_wallets").select("balance").eq("mitra_id",currentUser.id).single();if(w.error||Number(w.data.balance)<amount)return alert("Saldo tidak mencukupi.");const bank=prompt("Nama bank:"),account=prompt("Nomor rekening:"),name=prompt("Nama pemilik rekening:");if(!bank||!account||!name)return;const r=await supabase.from("payouts").insert({mitra_id:currentUser.id,amount,bank_name:bank,account_number:account,account_name:name});if(r.error)alert(errorText(r.error));else alert("Payout dibuat.");await renderDashboard()}
async function toggleService(id,on){const r=on?await supabase.from("partner_services").upsert({partner_id:currentUser.id,service_id:id}):await supabase.from("partner_services").delete().eq("partner_id",currentUser.id).eq("service_id",id);if(r.error)alert(errorText(r.error))}
async function payOrder(id){
 const o=await supabase.from("orders").select("final_price,customer_service_fee,customer_total").eq("id",id).eq("customer_id",currentUser.id).single();if(o.error)return alert(errorText(o.error));
 const total=Number(o.data.customer_total||o.data.final_price||0);
 showModal('<h2>Pembayaran</h2><p>Harga jasa: <b>'+money(o.data.final_price)+'</b></p><p>Biaya layanan: <b>'+money(o.data.customer_service_fee||0)+'</b></p><p>Total: <b>'+money(total)+'</b></p><label>Metode<select id="payMethod"><option value="qris">QRIS</option><option value="cash">Cash</option></select></label><div class="notice">Uji coba: pembayaran dibuat pending dan dikonfirmasi admin.</div><button class="cta" id="payBtn">Catat pembayaran</button>');
 $("payBtn").onclick=async()=>{const r=await supabase.from("payments").upsert({order_id:id,method:$("payMethod").value,amount:total,status:"pending"});if(r.error)alert(errorText(r.error));else{alert("Pembayaran pending tercatat.");closeModal();await renderDashboard()}};
}
async function reviewOrder(id,pid){const x=await supabase.from("reviews").select("id").eq("order_id",id).maybeSingle();if(x.data)return alert("Rating sudah diberikan.");showModal('<h2>Beri Rating</h2><div class="stars">'+[1,2,3,4,5].map(n=>'<button onclick="submitReview(\''+id+'\',\''+pid+'\','+n+')">★</button>').join("")+'</div><textarea id="reviewText" placeholder="Ulasan (opsional)"></textarea>')}
async function submitReview(id,pid,rating){const r=await supabase.from("reviews").insert({order_id:id,customer_id:currentUser.id,partner_id:pid,rating,review:$("reviewText").value.trim()});if(r.error)alert(errorText(r.error));else{closeModal();await renderDashboard()}}
async function verifyPartner(id,v){const r=await supabase.from("partner_profiles").upsert({id,verified:v,updated_at:new Date().toISOString()});if(r.error)alert(errorText(r.error));else await renderDashboard()}
async function markPaymentPaid(id){const r=await supabase.from("payments").update({status:"paid",paid_at:new Date().toISOString()}).eq("id",id);if(r.error)alert(errorText(r.error));else await renderDashboard()}
async function markPayoutPaid(id){const r=await supabase.from("payouts").update({status:"paid",processed_at:new Date().toISOString()}).eq("id",id);if(r.error)alert(errorText(r.error));else await renderDashboard()}
async function toggleActive(id,v){const r=await supabase.from("services").update({active:v}).eq("id",id);if(r.error)alert(errorText(r.error));else{await loadServices();await renderDashboard()}}
async function addService(){showModal('<h2>Tambah Layanan</h2><label>Nama<input id="sn"></label><label>Icon<input id="si" placeholder="🛠️"></label><label>Deskripsi<textarea id="sd"></textarea></label><button class="cta" id="addBtn">Simpan</button>');$("addBtn").onclick=async()=>{const name=$("sn").value.trim();if(!name)return;const r=await supabase.from("services").insert({name,icon:$("si").value.trim()||"🛠️",description:$("sd").value.trim(),active:true});if(r.error)alert(errorText(r.error));else{closeModal();await loadServices();await renderDashboard()}}}
async function init(){try{await loadServices();await refresh()}catch(e){console.error(e)}supabase.auth.onAuthStateChange(()=>setTimeout(()=>refresh().catch(console.error),0))}
init();
