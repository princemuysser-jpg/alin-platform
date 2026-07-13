
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.alin100r-bottom button').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.alin100r-bottom button').forEach(x=>x.classList.remove('active'));
      btn.classList.add('active');
    });
  });
});
