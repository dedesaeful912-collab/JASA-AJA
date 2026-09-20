const SUPABASE_URL="https://hhmvutunognvlbkeulnf.supabase.co";
const SUPABASE_KEY="sb_publishable_ElleDxRJT85BHFnS8upOmQ_IkvW6MMr";
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const box=document.getElementById("error");
function showError(message){if(box)box.innerHTML="<div class='error'>"+String(message).replace(/[&<>]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[m]))+"</div>";}
function showSuccess(message){if(box)box.innerHTML="<div class='success'>"+String(message).replace(/[&<>]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[m]))+"</div>";}
async function redirectByRole(){
 try{
  const {data,error}=await client.auth.getUser();
  if(error)throw error;
  const user=data.user;
  if(!user){location.href="login.html";return;}
  const r=await client.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(r.error)throw r.error;
  if(!r.data?.role)return showError("Akun sudah aktif tetapi profil belum tersedia. Silakan coba daftar ulang atau hubungi admin.");
  location.href="index.html";
 }catch(e){showError(e?.message||"Gagal membuka dashboard.");}
}
const lf=document.getElementById("loginForm");
if(lf)lf.addEventListener("submit",async e=>{
 e.preventDefault(); if(box)box.innerHTML="";
 const email=document.getElementById("email").value.trim(),password=document.getElementById("password").value;
 try{
  const r=await client.auth.signInWithPassword({email,password});
  if(r.error)throw r.error;
  await redirectByRole();
 }catch(e){showError(e?.message||"Gagal masuk. Coba lagi.");}
});
const rf=document.getElementById("registerForm");
if(rf)rf.addEventListener("submit",async e=>{
 e.preventDefault(); if(box)box.innerHTML="";
 const name=document.getElementById("name").value.trim(),phone=document.getElementById("phone").value.trim(),email=document.getElementById("email").value.trim(),password=document.getElementById("password").value,role=document.getElementById("role").value;
 if(!name)return showError("Nama lengkap wajib diisi.");
 if(!phone)return showError("No. HP wajib diisi.");
 if(password.length<6)return showError("Password minimal 6 karakter.");
 try{
  const r=await client.auth.signUp({email,password,options:{data:{full_name:name,phone,role}}});
  if(r.error)throw r.error;
  if(r.data.session){await redirectByRole();return;}
  showSuccess("Pendaftaran berhasil. Silakan cek email jika verifikasi email aktif, lalu masuk.");
 }catch(e){showError(e?.message||"Pendaftaran gagal. Coba lagi.");}
});
