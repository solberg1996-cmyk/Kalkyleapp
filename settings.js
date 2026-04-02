    // ── Color Picker State ──────────────────────────────
    var _cpHue = 210, _cpSat = 80, _cpLight = 45;
    var _cpDragging = false;

    function hslToHex(h, s, l) {
      s /= 100; l /= 100;
      var a = s * Math.min(l, 1 - l);
      function f(n) {
        var k = (n + h / 30) % 12;
        var color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
      }
      return '#' + f(0) + f(8) + f(4);
    }

    function hexToHsl(hex) {
      var r = parseInt(hex.slice(1, 3), 16) / 255;
      var g = parseInt(hex.slice(3, 5), 16) / 255;
      var b = parseInt(hex.slice(5, 7), 16) / 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b);
      var h = 0, s = 0, l = (max + min) / 2;
      if (max !== min) {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        else if (max === g) h = ((b - r) / d + 2) * 60;
        else h = ((r - g) / d + 4) * 60;
      }
      return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
    }

    function drawColorWheel() {
      var canvas = $('#cpWheel');
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      var w = canvas.width, h = canvas.height;
      var cx = w / 2, cy = h / 2, radius = w / 2;

      ctx.clearRect(0, 0, w, h);

      // Draw hue/saturation wheel at current lightness
      var imageData = ctx.createImageData(w, h);
      var data = imageData.data;
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          var dx = x - cx, dy = y - cy;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= radius) {
            var angle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
            var sat = (dist / radius) * 100;
            var hex = hslToHex(angle, sat, _cpLight);
            var idx = (y * w + x) * 4;
            data[idx] = parseInt(hex.slice(1, 3), 16);
            data[idx + 1] = parseInt(hex.slice(3, 5), 16);
            data[idx + 2] = parseInt(hex.slice(5, 7), 16);
            data[idx + 3] = 255;
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);

      // Clip to circle
      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    function updateWheelThumb() {
      var canvas = $('#cpWheel');
      var thumb = $('#cpWheelThumb');
      if (!canvas || !thumb) return;
      var cx = canvas.width / 2, cy = canvas.height / 2, radius = canvas.width / 2;
      var rad = _cpHue * Math.PI / 180;
      var dist = (_cpSat / 100) * radius;
      var x = cx + Math.cos(rad) * dist;
      var y = cy + Math.sin(rad) * dist;
      thumb.style.left = x + 'px';
      thumb.style.top = y + 'px';
      thumb.style.background = hslToHex(_cpHue, _cpSat, _cpLight);
    }

    function applyPickerColor() {
      var hex = hslToHex(_cpHue, _cpSat, _cpLight);
      var el = $('#cColor');
      if (el) el.value = hex;
      var hexInput = $('#cpHexInput');
      if (hexInput && document.activeElement !== hexInput) hexInput.value = hex;
      var swatch = $('#cpActiveSwatch');
      if (swatch) swatch.style.background = hex;
      // Update lightness slider gradient to reflect current hue/sat
      var slider = $('#cpLightness');
      if (slider) {
        var dark = hslToHex(_cpHue, _cpSat, 10);
        var mid = hslToHex(_cpHue, _cpSat, 50);
        var light = hslToHex(_cpHue, _cpSat, 90);
        slider.style.background = 'linear-gradient(to right,' + dark + ',' + mid + ',' + light + ')';
      }
      updateColorPreview(hex);
      updatePresetHighlight(hex);
      updateSampleElements(hex);
    }

    function updateSampleElements(hex) {
      var btn = $('#cpSampleBtn');
      if (btn) btn.style.background = hex;
      var pill = $('#cpSamplePill');
      if (pill) pill.style.background = hex;
      var bar = $('#cpSampleBar');
      if (bar) bar.style.background = hex;
    }

    function updatePresetHighlight(hex) {
      var presets = document.querySelectorAll('.cp-preset');
      var lower = hex.toLowerCase();
      presets.forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.color.toLowerCase() === lower);
      });
    }

    function handleWheelInteraction(e) {
      var canvas = $('#cpWheel');
      if (!canvas) return;
      var rect = canvas.getBoundingClientRect();
      var x = (e.clientX || e.touches[0].clientX) - rect.left;
      var y = (e.clientY || e.touches[0].clientY) - rect.top;
      var cx = canvas.width / 2, cy = canvas.height / 2, radius = canvas.width / 2;
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;
      x *= scaleX; y *= scaleY;
      var dx = x - cx, dy = y - cy;
      var dist = Math.min(Math.sqrt(dx * dx + dy * dy), radius);
      _cpHue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      _cpSat = (dist / radius) * 100;
      updateWheelThumb();
      applyPickerColor();
    }

    function initColorPicker(hex) {
      var hsl = hexToHsl(hex);
      _cpHue = hsl.h;
      _cpSat = hsl.s;
      _cpLight = Math.max(10, Math.min(90, hsl.l));

      var slider = $('#cpLightness');
      if (slider) slider.value = _cpLight;

      drawColorWheel();
      updateWheelThumb();
      applyPickerColor();

      // Wheel mouse/touch events
      var wrap = document.querySelector('.cp-wheel-wrap');
      if (wrap && !wrap._cpBound) {
        wrap._cpBound = true;
        wrap.addEventListener('mousedown', function(e) {
          _cpDragging = true; handleWheelInteraction(e); e.preventDefault();
        });
        document.addEventListener('mousemove', function(e) {
          if (_cpDragging) handleWheelInteraction(e);
        });
        document.addEventListener('mouseup', function() { _cpDragging = false; });
        wrap.addEventListener('touchstart', function(e) {
          _cpDragging = true; handleWheelInteraction(e); e.preventDefault();
        }, { passive: false });
        wrap.addEventListener('touchmove', function(e) {
          if (_cpDragging) handleWheelInteraction(e); e.preventDefault();
        }, { passive: false });
        wrap.addEventListener('touchend', function() { _cpDragging = false; });
      }

      // Lightness slider
      if (slider && !slider._cpBound) {
        slider._cpBound = true;
        slider.addEventListener('input', function() {
          _cpLight = Number(this.value);
          drawColorWheel();
          updateWheelThumb();
          applyPickerColor();
        });
      }

      // Hex input
      var hexInput = $('#cpHexInput');
      if (hexInput && !hexInput._cpBound) {
        hexInput._cpBound = true;
        hexInput.addEventListener('input', function() {
          var v = this.value.trim();
          if (/^#[0-9a-fA-F]{6}$/.test(v)) {
            var hsl = hexToHsl(v);
            _cpHue = hsl.h; _cpSat = hsl.s; _cpLight = Math.max(10, Math.min(90, hsl.l));
            var slider = $('#cpLightness');
            if (slider) slider.value = _cpLight;
            drawColorWheel();
            updateWheelThumb();
            applyPickerColor();
          }
        });
      }

      // Preset buttons
      document.querySelectorAll('.cp-preset').forEach(function(btn) {
        if (btn._cpBound) return;
        btn._cpBound = true;
        btn.addEventListener('click', function() {
          setColor(this.dataset.color);
        });
      });
    }

    function openSettings(){
      $('#dashboardView').classList.add('hidden');
      $('#settingsView').classList.remove('hidden');
      var co=state.company;
      ['Name','OrgNr','Address','City','Phone','Email','Website','ExtraInfo'].forEach(function(k){
        var el=$('#c'+k); if(el) el.value=co[k.charAt(0).toLowerCase()+k.slice(1)]||'';
      });
      $('#sDefTimeRate').value=state.settings.timeRate||850;
      $('#sDefInternalCost').value=state.settings.internalCost||450;
      $('#sDefMatMarkup').value=state.settings.materialMarkup||20;
      $('#sDefDriveCost').value=state.settings.driveCost||650;
      // Color picker
      var currentColor = co.color || '#2e75b6';
      var colorEl = $('#cColor');
      if (colorEl) colorEl.value = currentColor;
      initColorPicker(currentColor);
      // Logo
      if(co.logo){ showLogoPreview(co.logo); }
    }

    function updateColorPreview(hex){
      var h=$('#colorPreviewHeader'); if(h) h.style.background=hex;
      var l=$('#colorPreviewLine'); if(l) l.style.background=hex;
    }

    window.setColor=function(hex){
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
      var hsl = hexToHsl(hex);
      _cpHue = hsl.h; _cpSat = hsl.s; _cpLight = Math.max(10, Math.min(90, hsl.l));
      var slider = $('#cpLightness');
      if (slider) slider.value = _cpLight;
      drawColorWheel();
      updateWheelThumb();
      applyPickerColor();
      var el = $('#cColor');
      if (el) el.value = hex;
      var hexInput = $('#cpHexInput');
      if (hexInput) hexInput.value = hex;
    };

    function showLogoPreview(dataUrl){
      var prev=$('#logoPreview');
      if(prev){ prev.innerHTML='<img src="'+dataUrl+'" style="width:100%;height:100%;object-fit:contain;border-radius:12px" />'; }
      var btn=$('#removeLogoBtn'); if(btn) btn.style.display='';
    }

    window.removeLogo=function(){
      state.company.logo='';
      var prev=$('#logoPreview');
      if(prev) prev.innerHTML='<span style="color:var(--muted);font-size:12px">Ingen logo</span>';
      var btn=$('#removeLogoBtn'); if(btn) btn.style.display='none';
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
