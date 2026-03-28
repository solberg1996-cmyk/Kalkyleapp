    function openSettings(){
      $('#dashboardView').classList.add('hidden');
      $('#settingsView').classList.remove('hidden');
      const co=state.company;
      // Fill fields
      ['Name','OrgNr','Address','City','Phone','Email','Website','ExtraInfo'].forEach(k=>{
        const el=$('#c'+k); if(el) el.value=co[k.charAt(0).toLowerCase()+k.slice(1)]||'';
      });
      $('#sDefTimeRate').value=state.settings.timeRate||850;
      $('#sDefInternalCost').value=state.settings.internalCost||450;
      $('#sDefMatMarkup').value=state.settings.materialMarkup||20;
      $('#sDefDriveCost').value=state.settings.driveCost||650;
      // Color
      const colorEl=$('#cColor'); if(colorEl){ colorEl.value=co.color||'#2e75b6'; updateColorPreview(co.color||'#2e75b6'); }
      // Logo
      if(co.logo){ showLogoPreview(co.logo); }
      // Color input live
      colorEl&&colorEl.addEventListener('input',function(){ updateColorPreview(this.value); });
    }

    function updateColorPreview(hex){
      const h=$('#colorPreviewHeader'); if(h) h.style.background=hex;
      const l=$('#colorPreviewLine'); if(l) l.style.background=hex;
    }

    window.setColor=function(hex){
      const el=$('#cColor'); if(el){ el.value=hex; updateColorPreview(hex); }
    };

    function showLogoPreview(dataUrl){
      const prev=$('#logoPreview');
      if(prev){ prev.innerHTML='<img src="'+dataUrl+'" style="width:100%;height:100%;object-fit:contain;border-radius:12px" />'; }
      const btn=$('#removeLogoBtn'); if(btn) btn.style.display='';
    }

    window.removeLogo=function(){
      state.company.logo='';
      const prev=$('#logoPreview');
      if(prev) prev.innerHTML='<span style="color:var(--muted);font-size:12px">Ingen logo</span>';
      const btn=$('#removeLogoBtn'); if(btn) btn.style.display='none';
    };

    function saveSettings(){
      state.company.name=$('#cName')?.value.trim()||'';
      state.company.orgNr=$('#cOrgNr')?.value.trim()||'';
      state.company.address=$('#cAddress')?.value.trim()||'';
      state.company.city=$('#cCity')?.value.trim()||'';
      state.company.phone=$('#cPhone')?.value.trim()||'';
      state.company.email=$('#cEmail')?.value.trim()||'';
      state.company.website=$('#cWebsite')?.value.trim()||'';
      state.company.extraInfo=$('#cExtraInfo')?.value.trim()||'';
      state.company.color=$('#cColor')?.value||'#2e75b6';
      state.settings.timeRate=Number($('#sDefTimeRate')?.value)||850;
      state.settings.internalCost=Number($('#sDefInternalCost')?.value)||450;
      state.settings.materialMarkup=Number($('#sDefMatMarkup')?.value)||20;
      state.settings.driveCost=Number($('#sDefDriveCost')?.value)||0;
      // Apply accent color to app
      document.documentElement.style.setProperty('--blue', state.company.color);
      saveState();
      // Back to dashboard
      $('#settingsView').classList.add('hidden');
      $('#dashboardView').classList.remove('hidden');
      renderDashboard();
    }
