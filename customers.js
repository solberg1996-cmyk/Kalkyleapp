    function renderDashboard(){
      $('#metricCustomers').textContent=state.customers.length;
      $('#metricProjects').textContent=state.projects.length;
      const sent=state.projects.filter(p=>p.status==='Sendt').length;
      const won=state.projects.filter(p=>['Vunnet','Pågår','Ferdig'].includes(p.status)).length;
      $('#metricSent').textContent=sent;
      $('#metricWinRate').textContent=sent?`${Math.round((won/sent)*100)}%`:'0%';
      const cQ=$('#customerSearch').value.trim().toLowerCase();
      const pQ=$('#projectSearch').value.trim().toLowerCase();
      const cList=$('#customerList'); cList.innerHTML='';
      const customers=state.customers.filter(c=>[c.name,c.phone,c.email].join(' ').toLowerCase().includes(cQ));
      if(!customers.length) cList.innerHTML='<div class="empty">Ingen kunder enda.</div>';
      customers.forEach(c=>{
        const div=document.createElement('div'); div.className='item';
        div.innerHTML=`<div><h4>${safe(c.name)}</h4><p>${safe(c.phone)}${c.phone&&c.email?' • ':''}${safe(c.email)}</p></div>
          <div class="inline-actions">
            <button class="btn small secondary" onclick="editCustomer('${c.id}')">Rediger</button>
            <button class="btn small danger" onclick="deleteCustomer('${c.id}')">Slett</button>
          </div>`;
        cList.appendChild(div);
      });
      const pList=$('#projectList'); pList.innerHTML='';
      const projects=state.projects.filter(p=>{const cu=getCustomer(p.customerId);return[p.name,p.type,p.status,cu?.name||''].join(' ').toLowerCase().includes(pQ);}).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
      if(!projects.length) pList.innerHTML='<div class="empty">Ingen prosjekter enda.</div>';
      projects.forEach(p=>{
        const calc=compute(p), cust=getCustomer(p.customerId);
        const div=document.createElement('div'); div.className='item';
        const statuses=['Utkast','Sendt','Vunnet','Tapt','Pågår','Ferdig'];
        const statusOpts=statuses.map(s=>'<option value="'+s+'" '+(p.status===s?'selected':'')+'>'+s+'</option>').join('');
        div.innerHTML='<div style="flex:1"><h4>'+safe(p.name)+'</h4><p>'+safe(cust?.name||'Ingen kunde valgt')+' • '+safe(p.type)+'</p>'
          +'<div class="pills" style="margin-top:8px">'
          +'<select class="pill status-'+p.status+'" style="border:none;font-weight:700;font-size:12px;padding:5px 8px;border-radius:999px;cursor:pointer;background:inherit;color:inherit"'
          +' onchange="quickChangeStatus('+"'"+p.id+"'"+',this.value)">'
          +statusOpts
          +'</select>'
          +'<span class="pill">'+currency(calc.totalSaleEx||calc.saleEx)+'</span>'
          +'</div></div>'
          +'<div class="inline-actions"><button class="btn small primary" onclick="openProject('+"'"+ p.id +"'"+')">Åpne</button></div>';
        pList.appendChild(div);
      });
      saveState();
    }

    function openCustomerModal(existing){
      const c=existing||{id:uid(),name:'',phone:'',email:'',address:''};
      showModal(`
        <div class="section-head"><div class="section-title">${existing?'Rediger kunde':'Ny kunde'}</div><button class="btn small secondary" onclick="closeModal()">Lukk</button></div>
        <label>Navn</label><input id="mCN" value="${escapeAttr(c.name)}" />
        <label>Telefon</label><input id="mCP" value="${escapeAttr(c.phone)}" />
        <label>E-post</label><input id="mCE" value="${escapeAttr(c.email)}" />
        <label>Adresse</label><input id="mCA" value="${escapeAttr(c.address)}" />
        <div class="toolbar" style="margin-top:14px"><button class="btn primary" id="saveCustBtn">Lagre kunde</button></div>
      `);
      $('#saveCustBtn').onclick=()=>{
        c.name=$('#mCN').value.trim(); c.phone=$('#mCP').value.trim(); c.email=$('#mCE').value.trim(); c.address=$('#mCA').value.trim();
        if(!c.name){alert('Skriv inn kundenavn.');return;}
        const idx=state.customers.findIndex(x=>x.id===c.id);
        if(idx>-1) state.customers[idx]=c; else state.customers.unshift(c);
        saveState(); closeModal(); renderDashboard();
      };
    }

    function editCustomer(id){ const c=getCustomer(id); if(c) openCustomerModal({...c}); }
    function deleteCustomer(id){
      if(!confirm('Slette denne kunden?')) return;
      state.customers=state.customers.filter(c=>c.id!==id);
      state.projects=state.projects.map(p=>p.customerId===id?{...p,customerId:''}:p);
      saveState(); renderDashboard();
    }
