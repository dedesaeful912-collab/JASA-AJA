const SUPABASE_URL="https://hhmvutunognvlbkeulnf.supabase.co";
const SUPABASE_KEY="sb_publishable_ElleDxRJT85BHFnS8upOmQ_IkvW6MMr";
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const box=document.getElementById("error");
function showError(message){if(box)box.innerHTML="<div class='error'>"+String(message).replace(/[&<>]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[m]))+"</div>";}
function showSuccess(message){if(box)box.innerHTML="<div class='success'>"+String(message).replace(/[&<>]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[m]))+"</div>";}
async function redirectByRole(){
 const user=(await client.auth.getUser()).data.user;
 if(!user)return location.href="login.html";
 const r=await client.from("profiles").select("role").eq("id",user.id).single();
 if(r.error)return showError("Akun berhasil masuk, tetapi profil belum siap. Silakan coba lagi.");
 const role=r.data.role;
 location.href=role==="admin"?"index.html":role==="mitra"?"index.html":"index.html";
}
const lf=document.getElementById("loginForm");
if(lf)lf.addEventListener("submit",async e=>{
 e.preventDefault(); if(box)box.innerHTML="";
 const email=document.getElementById("email").value.trim(),password=document.getElementById("password").value;
 const r=await client.auth.signInWithPassword({email,password});
 if(r.error)return showError(r.error.message);
 await redirectByRole();
});
const rf=document.getElementById("registerForm");
if(rf)rf.addEventListener("submit",async e=>{
 e.preventDefault(); if(box)box.innerHTML="";
 const name=document.getElementById("name").value.trim(),phone=document.getElementById("phone").value.trim(),email=document.getElementById("email").value.trim(),password=document.getElementById("password").value,role=document.getElementById("role").value;
 if(!name)return showError("Nama lengkap wajib diisi.");
 if(!phone)return showError("No. HP wajib diisi.");
 if(password.length<6)return showError("Password minimal 6 karakter.");
 const r=await client.auth.signUp({email,password,options:{data:{full_name:name,phone,role}}});
 if(r.error)return showError(r.error.message);
 if(r.data.session)return redirectByRole();
 showSuccess("Pendaftaran berhasil. Silakan cek email jika verifikasi email aktif, lalu masuk.");
});
