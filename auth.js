const SUPABASE_URL="https://hhmvutunognvlbkeulnf.supabase.co";
const SUPABASE_KEY="sb_publishable_ElleDxRJT85BHFnS8upOmQ_IkvW6MMr";
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const box=document.getElementById("error");
function showError(message){box.innerHTML="<div class='error'>"+String(message)+"</div>";}
const lf=document.getElementById("loginForm");
if(lf)lf.addEventListener("submit",async e=>{e.preventDefault();box.innerHTML="";const r=await client.auth.signInWithPassword({email:document.getElementById("email").value.trim(),password:document.getElementById("password").value});if(r.error)return showError(r.error.message);location.href="index.html";});
const rf=document.getElementById("registerForm");
if(rf)rf.addEventListener("submit",async e=>{e.preventDefault();box.innerHTML="";const name=document.getElementById("name").value.trim(),phone=document.getElementById("phone").value.trim(),email=document.getElementById("email").value.trim(),password=document.getElementById("password").value,role=document.getElementById("role").value;if(password.length<6)return showError("Password minimal 6 karakter.");const r=await client.auth.signUp({email,password,options:{data:{full_name:name,phone,role}}});if(r.error)return showError(r.error.message);if(r.data.session)return location.href="index.html";box.innerHTML="<div class='success'>Pendaftaran berhasil. Jika verifikasi email aktif, cek email lalu masuk.</div>";});