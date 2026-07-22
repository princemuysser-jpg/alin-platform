import fs from 'node:fs';
import vm from 'node:vm';

const coreSource=fs.readFileSync('modules/courier/core.js','utf8');
const dashboardSource=fs.readFileSync('modules/courier/dashboard.js','utf8');
const source=coreSource+'\n;\n'+dashboardSource;
const code=source;
const failures=[];
const assert=(ok,msg)=>{if(!ok)failures.push(msg)};

function buildContext({courierRows=[],accountCourierRows=[],orders=[],current}){
  const content={innerHTML:'',textContent:'',classList:{toggle(){},add(){},remove(){}}};
  const name={textContent:''},areas={textContent:''},nav={innerHTML:'',classList:{}};
  const elements={
    '#courierV161Content':content,
    '#courierV161Name':name,
    '#courierV161Areas':areas,
    '.courier-v161-tabs':nav,
    '#courierCurrentBadge':{textContent:'',hidden:true},
    '#courierNotifyBadge':{textContent:'',hidden:true},
    '#v161MyAvailability':{value:'available'}
  };
  const document={
    readyState:'complete',
    querySelector:s=>elements[s]||null,
    querySelectorAll:s=>[],
    addEventListener(){},
    body:{contains(){return true}}
  };
  const window={
    current,
    couriers:courierRows,
    courierSettlements:[],
    db:{accounts:{couriers:accountCourierRows,all:accountCourierRows},couriers:courierRows,orders,notifications:[]},
    addEventListener(){},dispatchEvent(){},
    setTimeout,
  };
  const context={window,document,console,CustomEvent:class{},setTimeout,clearTimeout,setInterval,clearInterval,confirm:()=>true,prompt:()=>'',alert:()=>{},navigator:{onLine:true}};
  context.globalThis=context;context.current=current;context.db=window.db;
  vm.createContext(context);vm.runInContext(code,context);
  return {context,content,name,areas,nav};
}

const assigned={id:'O1',order_number:'AL-1',title:'هدية',student_name:'محمد',student_phone:'0770',delivery_area:'عرفة',delivery_landmark:'جامع نور الرحمن',total:8000,delivery_fee:2000,courier_id:'C1',status:'assigned',created_at:'2026-07-21T00:00:00Z'};

{
  const x=buildContext({current:{role:'courier',id:'C1',name:'علي',username:'ali',area:'عرفة'},courierRows:[],accountCourierRows:[{id:'C1',role:'courier',name:'علي',username:'ali',area:'عرفة'}],orders:[assigned]});
  const resolved=x.context.window.AlinCourierDashboard.resolveCourier();
  assert(resolved?.id==='C1','resolve:account-courier-fallback');
  assert(x.context.window.AlinCourierDashboard.myOrders(resolved).length===1,'orders:assigned-visible');
  await x.context.window.renderCourierDashboard('current',{refresh:false});
  assert(x.content.innerHTML.includes('AL-1'),'render:order-number');
  assert(x.content.innerHTML.includes('محمد'),'render:student');
  assert(x.content.innerHTML.includes('جامع نور الرحمن'),'render:landmark');
  assert(x.content.innerHTML.includes('قبول الطلب'),'render:actions');
}

{
  const x=buildContext({current:{role:'courier',id:'C2',name:'حسن',username:'hasan',area:'الحرية'},courierRows:[],accountCourierRows:[],orders:[]});
  const resolved=x.context.window.AlinCourierDashboard.resolveCourier();
  assert(resolved?.id==='C2','resolve:current-account-only');
  await x.context.window.renderCourierDashboard('home',{refresh:false});
  assert(x.content.innerHTML.includes('حالة العمل'),'render:home-not-blank');
  assert(x.name.textContent==='حسن','render:header-name');
  assert(x.areas.textContent.includes('الحرية'),'render:header-area');
}

assert(source.includes("accounts.couriers"),'source:account-courier-source');
assert(source.includes("client.from('orders').select('*').or"),'source:direct-orders-refresh');
assert(source.includes("لا توجد طلبات مسندة إليك حالياً"),'source:clear-empty-state');
assert(!code.includes("if(!c){if(typeof oldRender"),'source:no-silent-old-render-fallback');

if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,checks:13},null,2));
