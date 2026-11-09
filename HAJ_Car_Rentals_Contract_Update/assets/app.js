let data = { vehicles: [], customers: [], rentals: [], payments: [], settings: { name: 'HAJ Car Rentals', phone: '0919 897 9752', email: 'haj.biz246@gmail.com', address: 'Cebu City, Philippines 6000' } };
let activeView = 'dashboard', formType = '', editId = null;
let calendarCursor = new Date();
const db = window.hajSupabase;
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const peso = value => '₱' + Number(value || 0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
const dateLabel = value => value ? new Date(value+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—';
function toast(message){ const el=$('toast'); el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2600); }
function go(view){ activeView=view; document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id==='view-'+view)); document.querySelectorAll('.nav-link').forEach(x=>x.classList.toggle('active',x.dataset.view===view)); $('pageTitle').textContent=({dashboard:'Dashboard',vehicles:'Vehicles',customers:'Customers',rentals:'Reservations',receipts:'Receipts & invoices',contracts:'Rental contracts',calendar:'Calendar',reports:'Reports',settings:'Settings'})[view]||'Dashboard'; $('sidebar').classList.remove('open'); if(view==='calendar')renderCalendar(); if(view==='reports')renderReports(); }
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.view)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
$('mobileMenu').onclick=()=>$('sidebar').classList.toggle('open');
$('todayLabel').textContent=new Date().toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric',year:'numeric'}); $('year').textContent=new Date().getFullYear();
function showLogin(){ $('appShell').style.display='none'; $('loginScreen').style.display='grid'; }
function showApp(email){ $('loginScreen').style.display='none'; $('appShell').style.display='block'; $('signedInEmail').textContent=email||'Shared HAJ account'; }
$('loginForm').addEventListener('submit',async e=>{ e.preventDefault(); const btn=$('loginButton'); btn.disabled=true; btn.textContent='Signing in...'; const {error}=await db.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value}); btn.disabled=false; btn.textContent='Sign in'; if(error){$('loginError').textContent=error.message;return;} $('loginError').textContent=''; await startApp(); });
$('logoutButton').onclick=async()=>{ await db.auth.signOut(); showLogin(); };
async function startApp(){ const {data:sessionData}=await db.auth.getSession(); if(!sessionData.session){showLogin();return;} showApp(sessionData.session.user.email); await loadAll(); renderAll(); }
async function loadAll(){
 const [v,c,r,p]=await Promise.all([db.from('vehicles').select('*').order('created_at',{ascending:false}),db.from('customers').select('*').order('created_at',{ascending:false}),db.from('reservations').select('*').order('created_at',{ascending:false}),db.from('payments').select('*')]);
 for(const result of [v,c,r,p]) if(result.error){toast('Database error: '+result.error.message);return;}
 data.payments=p.data.map(x=>({id:x.id,reservationId:x.reservation_id,amount:Number(x.amount||0),date:x.payment_date,method:x.payment_method||'—'}));
 data.vehicles=v.data.map(x=>({id:x.id,name:x.make_model,plate:x.plate_number,rate:Number(x.daily_rate),status:x.status==='active'?'Available':x.status==='maintenance'?'Maintenance':'Inactive',notes:x.notes||''}));
 data.customers=c.data.map(x=>({id:x.id,name:x.full_name,phone:x.phone||'',email:x.email||'',address:x.address||'',notes:x.notes||''}));
 data.rentals=r.data.map(x=>{const paid=p.data.filter(y=>y.reservation_id===x.id).reduce((s,y)=>s+Number(y.amount||0),0);return {id:x.id,invoice:x.invoice_number,customerId:x.customer_id,vehicleId:x.vehicle_id,delivery:x.pickup_date,returnDate:x.return_date,days:Number(x.rental_days),rate:Number(x.daily_rate),deliveryFee:Number(x.delivery_fee||0),carwashFee:Number(x.other_charges||0),reservationFee:paid,status:x.status.charAt(0).toUpperCase()+x.status.slice(1),notes:x.notes||'',total:Number(x.total_amount),balance:Math.max(0,Number(x.total_amount)-paid)};});
}
async function saveVehicle(item){const row={make_model:item.name,plate_number:item.plate, daily_rate:item.rate,status:item.status==='Available'?'active':item.status==='Maintenance'?'maintenance':'inactive',notes:item.notes};return db.from('vehicles').upsert(item.id?{id:item.id,...row}:row).select().single();}
async function saveCustomer(item){const row={full_name:item.name,phone:item.phone,email:item.email,address:item.address,notes:item.notes||''};return db.from('customers').upsert(item.id?{id:item.id,...row}:row).select().single();}
async function saveRental(item){const row={customer_id:item.customerId,vehicle_id:item.vehicleId,pickup_date:item.delivery,return_date:item.returnDate,daily_rate:item.rate,rental_days:item.days,delivery_fee:item.deliveryFee,other_charges:item.carwashFee,discount:0,status:item.status.toLowerCase(),notes:item.notes||''};const result=await db.from('reservations').upsert(item.id?{id:item.id,...row}:row).select().single();if(result.error)return result; if(!item.id&&item.reservationFee>0){const payment=await db.from('payments').insert({reservation_id:result.data.id,amount:item.reservationFee,payment_method:'Cash',payment_date:new Date().toISOString().slice(0,10),notes:'Initial reservation payment'});if(payment.error)return payment;}return result;}
function field(label,name,type='text',value='',opts={}){let input='';if(type==='select')input=`<select name="${name}" required>${opts.options.map(o=>`<option value="${esc(o.value)}" ${String(value)===String(o.value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`;else if(type==='textarea')input=`<textarea name="${name}" rows="3" ${opts.required===false?'':'required'}>${esc(value)}</textarea>`;else input=`<input name="${name}" type="${type}" value="${esc(value)}" ${opts.required===false?'':'required'} ${opts.min!==undefined?`min="${opts.min}"`:''} ${opts.step?`step="${opts.step}"`:''} ${opts.placeholder?`placeholder="${esc(opts.placeholder)}"`:''}>`;return `<label class="field${opts.full?' full':''}">${label}${input}</label>`;}
function findRecord(type,id){return (type==='vehicle'?data.vehicles:type==='customer'?data.customers:data.rentals).find(x=>x.id===id)||{};}
function openForm(type,id=null){formType=type;editId=id;const r=id?findRecord(type,id):{};const fields=$('dialogFields');$('dialogTitle').textContent=({vehicle:id?'Edit vehicle':'Add vehicle',customer:id?'Edit customer':'Add customer',rental:id?'Edit reservation':'New reservation'})[type];
 if(type==='vehicle')fields.innerHTML=field('Vehicle name / model','name','text',r.name||'',{full:true,placeholder:'e.g. Toyota Vios 2022'})+field('Plate number','plate','text',r.plate||'')+field('Daily rental rate (PHP)','rate','number',r.rate??'',{min:0,step:'0.01'})+field('Status','status','select',r.status||'Available',{options:['Available','Maintenance','Inactive'].map(x=>({value:x,label:x}))})+field('Notes','notes','textarea',r.notes||'',{full:true,required:false});
 if(type==='customer')fields.innerHTML=field('Customer full name','name','text',r.name||'',{full:true})+field('Contact number','phone','tel',r.phone||'')+field('Email address','email','email',r.email||'',{required:false})+field('Address','address','textarea',r.address||'',{full:true,required:false});
 if(type==='rental'){if(!data.vehicles.length||!data.customers.length){toast('Add at least one vehicle and one customer first.');return;}const vs=data.vehicles.filter(v=>v.status==='Available'||v.id===r.vehicleId).map(v=>({value:v.id,label:v.name+' — '+v.plate}));const cs=data.customers.map(c=>({value:c.id,label:c.name}));fields.innerHTML=field('Customer','customerId','select',r.customerId||cs[0].value,{options:cs})+field('Vehicle','vehicleId','select',r.vehicleId||vs[0]?.value,{options:vs})+field('Pickup date','delivery','date',r.delivery||new Date().toISOString().slice(0,10))+field('Return date','returnDate','date',r.returnDate||new Date(Date.now()+86400000).toISOString().slice(0,10))+field('Daily rental rate (PHP)','rate','number',r.rate??(data.vehicles.find(v=>v.id===(r.vehicleId||vs[0]?.value))?.rate||0),{min:0,step:'0.01'})+field('Delivery / pickup fee','deliveryFee','number',r.deliveryFee??0,{min:0,step:'0.01'})+field('Other charges / carwash','carwashFee','number',r.carwashFee??0,{min:0,step:'0.01'})+field('Payment received','reservationFee','number',r.reservationFee??0,{min:0,step:'0.01'})+field('Rental status','status','select',r.status||'Reserved',{options:['Reserved','Ongoing','Completed','Cancelled'].map(x=>({value:x,label:x}))})+field('Additional note','notes','textarea',r.notes||'',{full:true,required:false});}
 $('formDialog').showModal();}
$('addVehicleBtn').onclick=()=>openForm('vehicle');$('addCustomerBtn').onclick=()=>openForm('customer');$('addRentalBtn').onclick=()=>openForm('rental');$('closeDialog').onclick=$('cancelDialog').onclick=()=>$('formDialog').close();
$('recordForm').addEventListener('submit',async e=>{e.preventDefault();const val=Object.fromEntries(new FormData(e.currentTarget));const id=editId;let result;
 if(formType==='vehicle'){const item={id,name:val.name.trim(),plate:val.plate.trim().toUpperCase(),rate:Number(val.rate),status:val.status,notes:val.notes||''};if(data.vehicles.some(x=>x.plate.toLowerCase()===item.plate.toLowerCase()&&x.id!==id)){toast('That plate number is already registered.');return;}result=await saveVehicle(item);}
 if(formType==='customer')result=await saveCustomer({id,name:val.name.trim(),phone:val.phone.trim(),email:val.email.trim(),address:val.address.trim()});
 if(formType==='rental'){const start=new Date(val.delivery+'T00:00:00'),end=new Date(val.returnDate+'T00:00:00');if(end<start){toast('Return date cannot be earlier than pickup date.');return;}const days=Math.max(1,Math.ceil((end-start)/86400000));const item={id,customerId:val.customerId,vehicleId:val.vehicleId,delivery:val.delivery,returnDate:val.returnDate,days,rate:Number(val.rate),deliveryFee:Number(val.deliveryFee||0),carwashFee:Number(val.carwashFee||0),reservationFee:Number(val.reservationFee||0),status:val.status,notes:val.notes||''};result=await saveRental(item);}
 if(result?.error){toast(result.error.message.includes('no_overlapping_vehicle_reservations')?'This vehicle already has a reservation during those dates.':result.error.message);return;} $('formDialog').close();await loadAll();renderAll();toast('Record saved to shared database.');});
function customerName(id){return data.customers.find(x=>x.id===id)?.name||'Unknown customer';}function vehicleName(id){const v=data.vehicles.find(x=>x.id===id);return v?v.name+' · '+v.plate:'Unknown vehicle';}
function table(headers,rows){return rows.length?`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:'<div class="empty">No records found.</div>';}
function renderVehicles(){const q=($('vehicleSearch').value||'').toLowerCase(),list=data.vehicles.filter(v=>(v.name+' '+v.plate).toLowerCase().includes(q));$('vehicleCount').textContent=`${list.length} vehicle(s)`;$('vehicleList').innerHTML=table(['Vehicle','Plate number','Daily rate','Status','Actions'],list.map(v=>`<tr><td><b>${esc(v.name)}</b></td><td>${esc(v.plate)}</td><td>${peso(v.rate)}</td><td>${esc(v.status)}</td><td><div class="row-actions"><button class="action-link" onclick="openForm('vehicle','${v.id}')">Edit</button><button class="action-link delete" onclick="deleteRecord('vehicle','${v.id}')">Delete</button></div></td></tr>`));}
function renderCustomers(){const q=($('customerSearch').value||'').toLowerCase(),list=data.customers.filter(c=>(c.name+' '+c.phone).toLowerCase().includes(q));$('customerCount').textContent=`${list.length} customer(s)`;$('customerList').innerHTML=table(['Customer','Phone','Email','Address','Actions'],list.map(c=>`<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.phone)}</td><td>${esc(c.email||'—')}</td><td>${esc(c.address||'—')}</td><td><div class="row-actions"><button class="action-link" onclick="openForm('customer','${c.id}')">Edit</button><button class="action-link delete" onclick="deleteRecord('customer','${c.id}')">Delete</button></div></td></tr>`));}
function renderRentals(){const q=($('rentalSearch').value||'').toLowerCase(),list=data.rentals.filter(r=>(r.invoice+' '+customerName(r.customerId)+' '+vehicleName(r.vehicleId)).toLowerCase().includes(q));$('rentalCount').textContent=`${list.length} reservation(s)`;$('rentalList').innerHTML=table(['Invoice','Customer / vehicle','Rental dates','Total','Balance','Status','Actions'],list.map(r=>`<tr><td><b>${esc(r.invoice)}</b></td><td>${esc(customerName(r.customerId))}<br><span class="muted">${esc(vehicleName(r.vehicleId))}</span></td><td>${dateLabel(r.delivery)} – ${dateLabel(r.returnDate)}<br><span class="muted">${r.days} day(s)</span></td><td>${peso(r.total)}</td><td>${peso(r.balance)}</td><td>${esc(r.status)}</td><td><div class="row-actions"><button class="action-link" onclick="printReceipt('${r.id}')">Receipt</button><button class="action-link" onclick="printContract('${r.id}')">Contract</button><button class="action-link" onclick="openForm('rental','${r.id}')">Edit</button><button class="action-link delete" onclick="deleteRecord('rental','${r.id}')">Delete</button></div></td></tr>`));}
function renderReceipts(){const q=($('receiptSearch').value||'').toLowerCase(),list=data.rentals.filter(r=>(r.invoice+' '+customerName(r.customerId)).toLowerCase().includes(q));$('receiptCount').textContent=`${list.length} receipt(s)`;$('receiptList').innerHTML=table(['Invoice number','Bill to','Date','Total amount','Balance due',''],list.map(r=>`<tr><td><b>${esc(r.invoice)}</b></td><td>${esc(customerName(r.customerId))}</td><td>${dateLabel(r.delivery)}</td><td>${peso(r.total)}</td><td>${peso(r.balance)}</td><td><button class="action-link" onclick="printReceipt('${r.id}')">Open / Print</button></td></tr>`));}
function renderContracts(){
 const list=[...data.rentals].filter(r=>r.status!=='Cancelled').sort((a,b)=>(b.delivery||'').localeCompare(a.delivery||''));
 $('contractList').innerHTML=table(['Reservation','Customer','Vehicle','Rental period','Status',''],list.map(r=>`<tr><td><b>${esc(r.invoice||'—')}</b></td><td>${esc(customerName(r.customerId))}</td><td>${esc(vehicleName(r.vehicleId))}</td><td>${dateLabel(r.delivery)} – ${dateLabel(r.returnDate)}</td><td>${esc(r.status)}</td><td><button class="action-link" onclick="printContract('${r.id}')">Generate / Print</button></td></tr>`));
}
function renderDashboard(){
 const today=new Date().toISOString().slice(0,10);
 const ongoing=data.rentals.filter(r=>r.status==='Ongoing').length, reserved=data.rentals.filter(r=>r.status==='Reserved').length;
 const maintenance=data.vehicles.filter(v=>v.status==='Maintenance').length;
 $('statVehicles').textContent=data.vehicles.length;$('statAvailable').textContent=data.vehicles.filter(v=>v.status==='Available').length;$('statCustomers').textContent=data.customers.length;$('statRentals').textContent=data.rentals.length;
 const upcoming=data.rentals.filter(r=>r.status!=='Cancelled'&&r.returnDate>=today).sort((a,b)=>a.returnDate.localeCompare(b.returnDate)).slice(0,6);
 const outstanding=data.rentals.reduce((s,r)=>s+r.balance,0);
 $('dashboardStatuses').innerHTML=`<article class="status-tile"><span>Reserved</span><b>${reserved}</b></article><article class="status-tile"><span>Ongoing</span><b>${ongoing}</b></article><article class="status-tile"><span>Maintenance</span><b>${maintenance}</b></article><article class="status-tile"><span>Outstanding balances</span><b>${peso(outstanding)}</b></article><article class="status-tile"><span>Payments received today</span><b>${peso(data.payments.filter(x=>x.date===today).reduce((s,x)=>s+x.amount,0))}</b></article>`;
 const recent=data.rentals.slice(0,5);$('recentRentals').innerHTML=recent.length?table(['Invoice','Customer','Vehicle','Status'],recent.map(r=>`<tr><td><b>${esc(r.invoice)}</b></td><td>${esc(customerName(r.customerId))}</td><td>${esc(vehicleName(r.vehicleId))}</td><td>${esc(r.status)}</td></tr>`)):'<div class="empty">No reservations yet. Add your first reservation to get started.</div>';
 const old=$('upcomingReturns');if(old)old.innerHTML=upcoming.length?table(['Return date','Vehicle','Customer'],upcoming.map(r=>`<tr><td>${dateLabel(r.returnDate)}</td><td>${esc(vehicleName(r.vehicleId))}</td><td>${esc(customerName(r.customerId))}</td></tr>`)):'<div class="empty">No upcoming returns.</div>';
}
function renderAll(){renderDashboard();renderVehicles();renderCustomers();renderRentals();renderReceipts();renderContracts();}
async function deleteRecord(type,id){if(!confirm('Delete this record?'))return;let result;if(type==='vehicle')result=await db.from('vehicles').delete().eq('id',id);else if(type==='customer')result=await db.from('customers').delete().eq('id',id);else result=await db.from('reservations').delete().eq('id',id);if(result.error){toast(result.error.message);return;}await loadAll();renderAll();toast('Record deleted from shared database.');}
function printReceipt(id){
 const r=data.rentals.find(x=>x.id===id);if(!r)return;
 const s=data.settings,c=data.customers.find(x=>x.id===r.customerId)||{},v=data.vehicles.find(x=>x.id===r.vehicleId)||{};
 const issue=new Date().toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'});
 const paid=data.payments.filter(p=>p.reservationId===r.id).reduce((sum,p)=>sum+Number(p.amount||0),0);
 const total=Number(r.total||0),balance=Math.max(0,total-paid);
 const rentalAmount=Number(r.rate||0)*Number(r.days||0);
 const extraRows=[];
 if(Number(r.deliveryFee||0)>0)extraRows.push(['Delivery/Pickup Fee',Number(r.deliveryFee),1,Number(r.deliveryFee)]);
 if(Number(r.carwashFee||0)>0)extraRows.push(['Other Charges',Number(r.carwashFee),1,Number(r.carwashFee)]);
 $('receiptPrint').innerHTML=`<article class="receipt">
   <header class="receipt-head">
     <div class="receipt-company"><img class="receipt-logo" src="assets/haj-logo.png" alt="HAJ Car Rentals logo"><div><h1>${esc(s.name||'HAJ Car Rentals')}</h1><p>${esc(s.address||'')}<br>${esc(s.phone||'')}<br>${esc(s.email||'')}</p></div></div>
     <div class="receipt-meta"><b>INVOICE</b><strong>${esc(r.invoice||'—')}</strong><b>DATE</b><span>${issue}</span><b>DUE</b><span>On Receipt</span><b>BALANCE DUE</b><strong class="balance-highlight">${peso(balance)}</strong></div>
   </header>
   <section class="bill-to"><small>BILL TO</small><strong>${esc(c.name||'Customer')}</strong><span>${esc(c.phone||'')}</span>${c.address?`<span>${esc(c.address)}</span>`:''}</section>
   <table class="receipt-table"><thead><tr><th>DESCRIPTION</th><th>RATE</th><th>QTY</th><th>AMOUNT</th></tr></thead><tbody>
     <tr><td>Car Rental</td><td>${peso(r.rate)}</td><td>${Number(r.days||0)}</td><td>${peso(rentalAmount)}</td></tr>
     ${extraRows.map(x=>`<tr><td>${x[0]}</td><td>${peso(x[1])}</td><td>${x[2]}</td><td>${peso(x[3])}</td></tr>`).join('')}
   </tbody></table>
   <section class="receipt-summary"><div><span>TOTAL</span><strong>${peso(total)}</strong></div><div><span>PAYMENTS RECEIVED</span><strong>${peso(paid)}</strong></div><div class="balance-row"><span>BALANCE DUE</span><strong>${peso(balance)}</strong></div></section>
   <section class="receipt-notes"><p><b>Rental Schedule</b><br>Pickup: ${dateLabel(r.delivery)}<br>Pickup/Return: ${dateLabel(r.returnDate)}<br>Duration: ${Number(r.days||0)} day(s)<br>Vehicle: ${esc(v.name||'')} ${v.plate?`(${esc(v.plate)})`:''}</p>
   ${r.notes?`<p><b>Additional Note:</b><br>${esc(r.notes)}</p>`:''}
   <p class="receipt-thanks">Thank you for choosing HAJ Car Rentals.</p></section>
 </article>`;
 window.print();
}
function printContract(id){
 const r=data.rentals.find(x=>x.id===id);if(!r){toast('Reservation not found.');return;}
 const c=data.customers.find(x=>x.id===r.customerId)||{};
 const v=data.vehicles.find(x=>x.id===r.vehicleId)||{};
 const s=data.settings;
 const rentalPeriod=`${dateLabel(r.delivery)} to ${dateLabel(r.returnDate)} (${Number(r.days||0)} day(s))`;
 const terms=[
  'The Borrower states that he / she is physically and legally qualified to operate the above-described vehicle.',
  'Cancellation Policy: The reservation fee is non-refundable. In the event that the borrower chooses to cancel the booking for any reason, the initial deposit shall be forfeited in full.',
  'EXCLUSIONS:',
  'The borrowed vehicle shall not be used to carry passengers or property for hire but for personal use only.',
  'The vehicle should not be used to push, propel or tow another vehicle, trailer or any other vehicle or items.',
  'The vehicle shall not be used for any race or in any competition. The vehicle shall not be used for any illegal purposes.',
  'The vehicle is strictly permitted for use within the Island of Cebu only. Removal or transport of vehicle outside Cebu Island is not allowed. Any breach of this condition will result in a penalty of PHP 5,000 and may be subject to applicable sanctions imposed by local law enforcement authorities.',
  'The vehicle shall only be operated by the borrower named in the Borrower Personal Details, unless the Owner gives prior written permission for another person to drive the vehicle.',
  'The borrower or authorized driver must be at least 18 years old and hold a valid driver’s license. The borrower will be fully responsible for all expenses relating to the vehicle and any other vehicle involved in any type of accident.',
  'The borrower shall not operate the vehicle in a negligent manner or under the influence of liquor or drugs.',
  'The borrower is strictly forbidden from using the vehicle for any off-road driving or on any terrain not classified as a paved or publicly maintained road. A penalty fee of ₱30,000 will be charged for any violation of this policy. Additionally, all damages resulting from off-road use will be the full responsibility of the renter and must be paid in full.'
 ];
 $('contractPrint').innerHTML=`<article class="rental-contract">
  <header class="contract-header">
   <div class="contract-brand"><img src="assets/haj-logo.png" alt="HAJ logo"><div><h1>${esc(s.name||'HAJ Car Rentals')}</h1><p>${esc(s.address||'Cebu City, Philippines 6000')}<br>${esc(s.phone||'0919 897 9752')}<br>${esc(s.email||'haj.biz246@gmail.com')}</p></div></div>
   <div class="contract-heading"><h2>RENTAL TERMS &amp; CONDITIONS</h2><span>Reservation ${esc(r.invoice||'—')}</span></div>
  </header>
  <p class="contract-intro">By renting a vehicle from HAJ Car Rental, you agree to the following:</p>
  <p class="contract-acknowledgement">I, <b>${esc(c.name||'________________________________')}</b>, hereby acknowledge that I have rented a <b>${esc(v.name||'________________________')}</b> from Car Rentals by HAJ for a period of <b>${esc(rentalPeriod)}</b>.</p>
  <p class="contract-acknowledgement">I confirm that I have received the vehicle in good condition and agree to comply with all rental terms and conditions. I accept responsibility for the vehicle throughout the rental period and agree to return it within the agreed time and in the same condition, subject to normal wear and tear.</p>
  <h3 class="contract-section-title">VEHICLE INFORMATION</h3>
  <table class="contract-vehicle-table"><tbody>
   <tr><th>MODEL</th><td>${esc(v.name||'—')}</td></tr>
   <tr><th>PLATE NUMBER</th><td>${esc(v.plate||'—')}</td></tr>
   <tr><th>COLOR</th><td>SPACE GREY</td></tr>
   <tr><th>FUEL TYPE</th><td>UNLEADED</td></tr>
  </tbody></table>
  <h3 class="contract-section-title">TERMS &amp; CONDITIONS</h3>
  <ol class="contract-terms">
   <li><b>QUALIFICATIONS:</b> ${esc(terms[0])}</li>
   <li>${esc(terms[1])}</li>
   <li><b>EXCLUSIONS:</b><ul>${terms.slice(3).map(t=>`<li>${esc(t)}</li>`).join('')}</ul></li>
   <li><b>Penalties:</b> Gasoline: ₱300/bar &nbsp; | &nbsp; Excess Hour charges: ₱200/hr</li>
  </ol>
  <section class="contract-agreement"><h3>AGREEMENT</h3><p>By signing below, the renter confirms that they have read, understood, and agreed to these Rental Terms &amp; Conditions.</p>
   <div class="contract-sign-grid"><div>Renter's Name: <b>${esc(c.name||'')}</b></div><div>Signature: __________________________________________</div><div>Date: ______________________________________________</div><div>Time rented: ____________________ &nbsp; Time returned: ____________________</div></div>
  </section>
  <footer class="contract-footer">HAJ Car Rentals · ${esc(r.invoice||'')} · Please keep a copy of this agreement.</footer>
 </article>`;
 document.body.classList.add('printing-contract');
 window.addEventListener('afterprint',()=>document.body.classList.remove('printing-contract'),{once:true});
 window.print();
}
['vehicleSearch','customerSearch','rentalSearch','receiptSearch'].forEach(id=>$(id).addEventListener('input',()=>({vehicleSearch:renderVehicles,customerSearch:renderCustomers,rentalSearch:renderRentals,receiptSearch:renderReceipts}[id])()));
$('saveSettings').onclick=()=>toast('Business details are currently kept in this browser version. Shared settings will be connected in a later update.');
$('exportData').onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='haj-car-rentals-backup.json';a.click();URL.revokeObjectURL(a.href);};
$('importData').onchange=()=>toast('Import is not enabled in the shared database version yet.');$('clearData').onclick=()=>toast('For safety, clearing all shared records is disabled. Delete individual records instead.');

function renderCalendar(){
 const grid=$('calendarGrid');if(!grid)return;const mode=$('calendarMode').value;const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();
 let start,end,title;if(mode==='month'){start=new Date(y,m,1);const offset=(start.getDay()+6)%7;start.setDate(start.getDate()-offset);end=new Date(start);end.setDate(start.getDate()+41);title=calendarCursor.toLocaleDateString('en-PH',{month:'long',year:'numeric'});}else{start=new Date(calendarCursor);const offset=(start.getDay()+6)%7;start.setDate(start.getDate()-offset);end=new Date(start);end.setDate(start.getDate()+6);title=`${dateLabel(start.toISOString().slice(0,10))} – ${dateLabel(end.toISOString().slice(0,10))}`;}
 $('calendarTitle').textContent=title;let days=[];for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1))days.push(new Date(d));
 const names=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];grid.innerHTML=names.map(n=>`<div class="calendar-weekday">${n}</div>`).join('')+days.map(d=>{const key=d.toISOString().slice(0,10),items=data.rentals.filter(r=>r.status!=='Cancelled'&&r.delivery<=key&&r.returnDate>=key);return `<div class="calendar-day ${d.getMonth()!==m&&mode==='month'?'outside-month':''}"><b>${d.getDate()}</b>${items.map(r=>`<button class="calendar-event ${r.status.toLowerCase()}" title="${esc(customerName(r.customerId))}" onclick="openForm('rental','${r.id}')">${esc(vehicleName(r.vehicleId))}</button>`).join('')}</div>`;}).join('');
}
function renderReports(){
 if(!$('reportCards'))return;const period=$('reportPeriod').value,now=new Date();let from=new Date(now);if(period==='day')from.setHours(0,0,0,0);else if(period==='week'){from.setDate(now.getDate()-((now.getDay()+6)%7));from.setHours(0,0,0,0);}else if(period==='month'){from=new Date(now.getFullYear(),now.getMonth(),1);}else from=new Date(2000,0,1);const fromKey=from.toISOString().slice(0,10),toKey=now.toISOString().slice(0,10);
 const payments=data.payments.filter(p=>p.date>=fromKey&&p.date<=toKey),income=payments.reduce((s,p)=>s+p.amount,0),balance=data.rentals.reduce((s,r)=>s+r.balance,0),completed=data.rentals.filter(r=>r.status==='Completed').length,cancelled=data.rentals.filter(r=>r.status==='Cancelled').length;
 $('reportCards').innerHTML=[['Payments received',peso(income)],['Outstanding balances',peso(balance)],['Completed bookings',completed],['Cancelled bookings',cancelled]].map(x=>`<article class="report-card"><span>${x[0]}</span><b>${x[1]}</b></article>`).join('');
 $('reservationReport').innerHTML=table(['Status','Bookings'],['Reserved','Ongoing','Completed','Cancelled'].map(s=>`<tr><td>${s}</td><td>${data.rentals.filter(r=>r.status===s).length}</td></tr>`));
 $('utilizationReport').innerHTML=table(['Vehicle','Bookings','Rental days'],data.vehicles.map(v=>{const rs=data.rentals.filter(r=>r.vehicleId===v.id&&r.status!=='Cancelled');return `<tr><td>${esc(v.name)} · ${esc(v.plate)}</td><td>${rs.length}</td><td>${rs.reduce((n,r)=>n+r.days,0)}</td></tr>`;}));
 const owing=data.rentals.filter(r=>r.balance>0);$('balanceReport').innerHTML=table(['Invoice','Customer','Balance'],owing.map(r=>`<tr><td>${esc(r.invoice)}</td><td>${esc(customerName(r.customerId))}</td><td>${peso(r.balance)}</td></tr>`));
}
$('calendarPrev').onclick=()=>{calendarCursor.setDate(1);calendarCursor.setMonth(calendarCursor.getMonth()-1);renderCalendar();};$('calendarNext').onclick=()=>{calendarCursor.setDate(1);calendarCursor.setMonth(calendarCursor.getMonth()+1);renderCalendar();};$('calendarToday').onclick=()=>{calendarCursor=new Date();renderCalendar();};$('calendarMode').onchange=renderCalendar;$('reportPeriod').onchange=renderReports;

(async()=>{const {data:auth}=await db.auth.getSession();if(auth.session)await startApp();else showLogin();})();
