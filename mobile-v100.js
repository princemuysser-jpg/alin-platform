
document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('.alin100-bottom-nav button').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.alin100-bottom-nav button').forEach(function(x){
        x.classList.remove('active');
      });
      btn.classList.add('active');
    });
  });
});
