// chronogramIntegration.js
// Integrates a user-provided chronogram JSON into the Project Timeline area

(function(){
    // User-provided chronogram (from request) — Aug 2025 to Nov 2026
    const CHRONO = {
        "title":"Chronogramme des activités restantes de la grappe de Boundou_Août 2025- Novembre 2026",
        "sections":[
            {"name":"1/ Communication/Formation","activities":[{"name":"Activités communication, sensibilisation et plaidoyer dans les communes","sub_activities":[{"communes":["Nétéboulou"],"dates":""},{"communes":["Missirak","Bandafassi","Fongolimbi","Dimboli","Bembou"],"dates":""},{"communes":["Bala","Koar"],"dates":""},{"communes":["Dindéfélo","Ballou","Gabou","Moudéry"],"dates":""},{"communes":["Tomboronkoto"],"dates":"1jr"},{"communes":["Sinthiou Maléme"],"dates":""},{"communes":["Sabadola","Médina Bafé"],"dates":""}]}]},
            {"name":"1/ Opérations inventaire systématique des droits foncier","activities":[{"name":"Inventaire systématique des droits fonciers + ratissage","sub_activities":[{"communes":["Sinthiou Malem","Netteboulou","Ndoga Babacar","Missirah","Bala","Koar"],"dates":"Semaine du 01 au 19 septembre"},{"communes":["Sabadola","Médina Bafé"],"dates":"En octobre"}]},{"name":"Préparatifs des listes pour déliberation, accompagnement de la commune à la délibération et à l’approbation","sub_activities":[]},{"name":"Elaboration des livrables L3.1 : Rapport périodique sur l’inventaire systématique des parcelles, des occupants et de leurs statuts et matérialisation des limites","sub_activities":[]} ]},
            {"name":"2/ Opération SIG/SIF","activities":[{"name":"Affichage public et traitement des plaintes enregistrés","sub_activities":[{"communes":["Missirah","Tomboronkoto"],"dates":"Semaine du 8 au 17 septembre"}]},{"name":"CTASF","sub_activities":[{"communes":["Missirah","Tomboronkoto"],"dates":"Semaine du 22 au 29 septembre"},{"communes":["Dindéfélo"],"dates":"Semaine du 29 septembre au 03 octobre"},{"communes":["Moudéry"],"dates":"Semaine du 22 au 26 septembre"}]},{"name":"Délibération","sub_activities":[{"communes":["Missirah","Tomboronkoto","Moudéry"],"dates":"Semaine du 29 septembre au O3 octobre"},{"communes":["Bembou"],"dates":"Semaine du 15 au 19 septembre"},{"communes":["Dindéfélo"],"dates":"Semaine du 06 au 10 octobre"}]},{"name":"Approbation","sub_activities":[{"communes":["Missirah","Tomboronkoto","Moudéry"],"dates":"Semaine du 06 au 10 octobre"},{"communes":["Bembou"],"dates":"Semaine du 22 au 26 septembre"},{"communes":["Dindéfélo"],"dates":"Semaine du 13 au 17 octobre"}]},{"name":"Atribution NICADs","sub_activities":[{"communes":[],"dates":"Août-septembre-octobre"}]},{"name":"Accompagnement de la commune à la délibération, et à l’approbation","sub_activities":[{"communes":[],"dates":"Août-septembre-octobre"}]},{"name":"Elaboration des livrables 3.2: Rapport périodique sur l’intégration des données dans le système d’information foncière (SIF) et l’appui à l’attribution des NICAD","sub_activities":[]},{"name":"Production du Plan parcellaire communal provisoire accompagné de son rapport L 3.3","sub_activities":[]},{"name":"Appui à l’opérationnalisation et à la pérennisation du SIF L-5.1","sub_activities":[]},{"name":"Appui aux personnels des BF dans les opérations d’enregistrement des droits L-5.2","sub_activities":[]},{"name":"Appui à la formalisation des droits L-5.3","sub_activities":[]},{"name":"Parcellaire définitif des opérations d’enregistrement systématique des communes accompagné de son rapport (1 rapport) L-5.4","sub_activities":[]} ]},
            {"name":"3/ Opérationnalisation du PEES","activities":[{"name":"Suivi des mesures de sauvegarde environnementale et sociale, d'hygiène, de sécurité (HSE)","sub_activities":[{"communes":["Tous les sites d'opération"],"dates":""}]},{"name":"Suivi des mesures du Genre et de l'Inclusion sociale, (VBG), (EAS), (HS)","sub_activities":[{"communes":["Tous les sites d'opération"],"dates":""}]},{"name":"Suivi du Mécanisme de Gestion des Plaintes et réclamations (MGP)","sub_activities":[{"communes":["Tous les sites d'opération"],"dates":""}]},{"name":"Elaboration des livrables 6.1 (PEES) et 6.2 (MGP)","sub_activities":[]},{"name":"Remise et reprise des outils et données aux communes","sub_activities":[]},{"name":"Accompagnement aux communes à leur appropriation","sub_activities":[]},{"name":"Rapports périodiques sur la collecte et l’analyse et la diffusion des données (9 rapports trimestriels) L-7.2","sub_activities":[]} ]}
        ]
    };

    // Map French month names to numbers
    const MONTHS = {
        'janvier':0,'fevrier':1,'février':1,'mars':2,'avril':3,'mai':4,'juin':5,'juillet':6,'aout':7,'août':7,'septembre':8,'octobre':9,'novembre':10,'decembre':11,'décembre':11
    };

    function parseDateRange(text){
        text = (text||'').trim();
        if(!text) return null;
        text = text.toLowerCase();
        const now = new Date();
        const defaultStartYear = 2025;

        // Simple patterns
        // "Semaine du 01 au 19 septembre"
        let m = text.match(/(\d{1,2})\s*(?:au|to|-)\s*(\d{1,2})\s*(\w+)/i);
        if(m){
            const d1 = parseInt(m[1],10);
            const d2 = parseInt(m[2],10);
            const month = m[3].replace(/[^a-zéûôàèç]+/gi,'');
            const monIndex = MONTHS[month] !== undefined ? MONTHS[month] : 8;
            const year = (monIndex >= 7) ? 2025 : 2026; // heuristic: Aug+ => 2025, else 2026
            const start = new Date(year, monIndex, d1);
            const end = new Date(year, monIndex, d2);
            return { start, end };
        }

        // "Semaine du 29 septembre au 03 octobre"
        m = text.match(/(\d{1,2})\s*(\w+)\s*(?:au|to|-)\s*(\d{1,2})\s*(\w+)/i);
        if(m){
            const d1 = parseInt(m[1],10);
            const month1 = m[2].replace(/[^a-zéûôàèç]+/gi,'');
            const d2 = parseInt(m[3],10);
            const month2 = m[4].replace(/[^a-zéûôàèç]+/gi,'');
            const mon1 = MONTHS[month1] !== undefined ? MONTHS[month1] : 8;
            const mon2 = MONTHS[month2] !== undefined ? MONTHS[month2] : mon1;
            const year1 = mon1 >= 7 ? 2025 : 2026;
            const year2 = mon2 >= 7 ? 2025 : 2026;
            const start = new Date(year1, mon1, d1);
            const end = new Date(year2, mon2, d2);
            return { start, end };
        }

        // "En octobre" or "Août-septembre-octobre"
        m = text.match(/(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)/i);
        if(m){
            const mon = m[1].toLowerCase().replace(/[^a-zéûôàèç]+/gi,'');
            const mi = MONTHS[mon] !== undefined ? MONTHS[mon] : 8;
            const year = mi >= 7 ? 2025 : 2026;
            const start = new Date(year, mi, 1);
            const end = new Date(year, mi+1, 0);
            return { start, end };
        }

        // "1jr" or "1 j" -> assume 1 day starting today
        if(text.match(/\b(\d+)\s*j/)){
            const days = parseInt(text.match(/(\d+)\s*j/)[1],10) || 1;
            const start = new Date();
            const end = new Date(); end.setDate(start.getDate() + Math.max(1, days-1));
            return { start, end };
        }

        // fallback: return null
        return null;
    }

    function buildItemsFromChrono(chrono){
        const items = [];
        let order = 1;
        chrono.sections.forEach(section => {
            section.activities.forEach(act => {
                if(!act.sub_activities || !act.sub_activities.length){
                    items.push({ task: act.name, region: section.name, start: null, end: null, order: order++ });
                } else {
                    act.sub_activities.forEach(sa => {
                        const dr = parseDateRange(sa.dates);
                        const communes = (sa.communes || []).join(', ') || '—';
                        const label = `${act.name} — ${communes}`;
                        items.push({ task: label, region: section.name, start: dr? dr.start : null, end: dr? dr.end : null, order: order++ });
                    });
                }
            });
        });
        return items;
    }

    function renderChrono(items){
        const container = document.getElementById('projectTimelineGantt');
        if(!container) return;
        container.innerHTML = '';

        // Basic injected styles for the chronogram area (kept minimal in JS)
        const styleId = 'chronogram-inline-styles';
        if(!document.getElementById(styleId)){
            const s = document.createElement('style');
            s.id = styleId;
            s.textContent = `
                #projectTimelineGantt .gantt-row { display:flex; align-items:center; padding:10px 0; }
                #projectTimelineGantt .gantt-label { flex:0 0 34%; padding-right:16px; color:#111827; }
                #projectTimelineGantt .gantt-timeline { flex:1 1 66%; position:relative; height:44px; background:transparent; }
                #projectTimelineGantt .gantt-bar { height:60%; border-radius:6px; box-shadow:0 1px 2px rgba(0,0,0,0.04); }
                #projectTimelineGantt .gantt-row:nth-child(odd) { background: rgba(99,102,241,0.03); }
                #projectTimelineGantt .date-badge { display:inline-block; min-width:110px; text-align:center; padding:6px 8px; border-radius:999px; background:#f3f4f6; color:#6b7280; font-size:12px; }
                #chronogram-modal .modal-title { font-size:18px; color:#92400e; }
                #chronogram-modal .modal-body { margin-top:8px; max-height:320px; overflow:auto; }
                #chronogram-modal .modal-item { display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px dashed rgba(0,0,0,0.04); }
                #chronogram-modal .modal-item .item-task { flex:1 1 auto; color:#111827; }
                #chronogram-modal .modal-item .item-date { flex:0 0 150px; text-align:right; }
                #chronogram-modal .btn { padding:8px 12px; border-radius:6px; cursor:pointer; }
                #chronogram-modal .btn-primary { background:#4f46e5; color:white; border:none; }
                #chronogram-modal .btn-ghost { background:transparent; border:1px solid rgba(0,0,0,0.08); }
            `;
            document.head.appendChild(s);
        }

        const now = new Date();
        // Render a simple months header (Aug 2025 - Dec 2026)
        const header = document.getElementById('projectTimelineHeader');
        if(header){
            header.innerHTML = '';
            const months = [];
            const start = new Date(2025,7,1);
            const end = new Date(2026,11,31);
            let cur = new Date(start.getFullYear(), start.getMonth(), 1);
            while(cur <= end){
                months.push(new Date(cur));
                cur = new Date(cur.getFullYear(), cur.getMonth()+1, 1);
            }
            months.forEach(m =>{
                const el = document.createElement('div');
                el.className = 'month';
                el.textContent = m.toLocaleString('fr-FR', { month: 'short', year: 'numeric' });
                header.appendChild(el);
            });
        }
        items.forEach((it, idx) => {
            const ganttRow = document.createElement('div');
            ganttRow.className = 'gantt-row';

            const label = document.createElement('div');
            label.className = 'gantt-label';
            const labelTitle = document.createElement('div');
            labelTitle.style.fontWeight = '600';
            labelTitle.style.marginBottom = '6px';
            labelTitle.textContent = it.task;
            label.appendChild(labelTitle);

            const timelineWrap = document.createElement('div');
            timelineWrap.className = 'gantt-timeline';

            if(it.start && it.end){
                const totalSpanDays =  ( (new Date(2026,11,31)) - (new Date(2025,7,1)) ) / (1000*60*60*24); // reference span Aug 1 2025 -> Dec 31 2026
                const projectStart = new Date(2025,7,1);
                const left = ( (it.start - projectStart) / (1000*60*60*24) ) / totalSpanDays * 100;
                const width = ( (it.end - it.start) / (1000*60*60*24) ) / totalSpanDays * 100;
                const bar = document.createElement('div');
                bar.className = 'gantt-bar';
                bar.style.position = 'absolute';
                bar.style.left = Math.max(0,left) + '%';
                bar.style.width = Math.max(0,width) + '%';
                bar.style.background = '#6366F1';
                bar.title = `${it.task}: ${it.start.toISOString().split('T')[0]} → ${it.end.toISOString().split('T')[0]}`;

                // date badge on the right inside the timeline
                const dateBadge = document.createElement('div');
                dateBadge.className = 'date-badge';
                const daysAway = Math.round((it.end - new Date())/(1000*60*60*24));
                if(daysAway <= 3) dateBadge.classList.add('due-soon');
                else if(daysAway <= 10) dateBadge.classList.add('due-warn');
                else dateBadge.classList.add('due-ok');
                dateBadge.textContent = `${it.start.toISOString().split('T')[0]} → ${it.end.toISOString().split('T')[0]}`;
                dateBadge.setAttribute('aria-hidden','true');

                // attach ISO dates to the row for filtering
                ganttRow.setAttribute('data-start', it.start.toISOString().split('T')[0]);
                ganttRow.setAttribute('data-end', it.end.toISOString().split('T')[0]);

                timelineWrap.appendChild(bar);
                timelineWrap.appendChild(dateBadge);
            } else {
                const noDateWrap = document.createElement('div');
                noDateWrap.style.display = 'flex';
                noDateWrap.style.justifyContent = 'flex-start';
                noDateWrap.style.alignItems = 'center';
                const noDate = document.createElement('div'); noDate.className='text-xs'; noDate.textContent='Dates non précisées';
                noDateWrap.appendChild(noDate);
                timelineWrap.appendChild(noDateWrap);
            }

            ganttRow.appendChild(label);
            ganttRow.appendChild(timelineWrap);
            container.appendChild(ganttRow);
        });

        // attach month filtering handlers to header months
        const monthEls = header ? Array.from(header.querySelectorAll('.month')) : [];
        const selectedMonths = new Set();

        function monthRange(monthDate){
            // return {start:Date, end:Date} for the whole month
            const y = monthDate.getFullYear();
            const m = monthDate.getMonth();
            const s = new Date(y,m,1);
            const e = new Date(y,m+1,0);
            return { start: s, end: e };
        }

        function overlapsRange(itemStart, itemEnd, rangeStart, rangeEnd){
            if(!itemStart || !itemEnd) return false;
            return (itemStart <= rangeEnd) && (itemEnd >= rangeStart);
        }

        function updateFilters(){
            const rows = Array.from(container.querySelectorAll('.gantt-row'));
            if(selectedMonths.size === 0){
                rows.forEach(r => r.style.display = 'flex');
                return;
            }
            // build ranges for selected months
            const ranges = Array.from(selectedMonths).map(i => monthRange(new Date(i)));
            rows.forEach(r =>{
                const ds = r.getAttribute('data-start');
                const de = r.getAttribute('data-end');
                if(!ds || !de){ r.style.display = 'none'; return; }
                const itStart = new Date(ds);
                const itEnd = new Date(de);
                const ok = ranges.some(rr => overlapsRange(itStart,itEnd, rr.start, rr.end));
                r.style.display = ok ? 'flex' : 'none';
            });
        }

        if(monthEls.length){
            monthEls.forEach((mEl, idx) =>{
                // store a date value on the element for filtering
                const text = mEl.textContent.trim();
                // try parse via Date using locale: create first-of-month using english parse fallback
                const mon = new Date(2025,7+idx,1); // idx aligns with Aug 2025 base
                mEl.dataset.monthDate = mon.toISOString();
                mEl.addEventListener('click', (ev)=>{
                    // multi-select with ctrl/cmd or shift
                    const iso = mon.toISOString();
                    const already = selectedMonths.has(iso);
                    if(ev.shiftKey || ev.ctrlKey || ev.metaKey){
                        if(already) { selectedMonths.delete(iso); mEl.classList.remove('active'); }
                        else { selectedMonths.add(iso); mEl.classList.add('active'); }
                    } else {
                        // single-select: clear others
                        if(already && selectedMonths.size===1){ selectedMonths.clear(); monthEls.forEach(x=>x.classList.remove('active')); }
                        else { selectedMonths.clear(); monthEls.forEach(x=>x.classList.remove('active')); selectedMonths.add(iso); mEl.classList.add('active'); }
                    }
                    updateFilters();
                });
            });
        }
    }

    function checkUpcoming(items, daysWindow=7){
        const now = new Date();
        const upcoming = items.filter(it => it.end && ((it.end - now)/(1000*60*60*24)) <= daysWindow && ((it.end - now)/(1000*60*60*24)) >= -1 );
        return upcoming;
    }

    function showAlerts(upcoming){
        // Remove any previous modal
        let modal = document.getElementById('chronogram-modal');
        if(modal) modal.remove();
        if(!upcoming || !upcoming.length) return;

        // Modal markup
        modal = document.createElement('div');
        modal.id = 'chronogram-modal';
        modal.setAttribute('role','dialog');
        modal.setAttribute('aria-modal','true');
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40';
        modal.innerHTML = `
            <div class="modal-inner max-w-lg w-full mx-4 relative animate-fadein">
                <button id="chronogram-close" class="absolute top-2 right-2" title="Fermer" aria-label="Fermer">&times;</button>
                <div>
                    <strong class="block text-lg mb-2">Rappels — échéances prochaines</strong>
                    <p class="text-sm text-gray-700">Les échéances listées ci-dessous arrivent bientôt — vérifiez et planifiez les actions.</p>
                </div>
                <ul class="mb-4 text-sm" style="margin-top:12px"></ul>
                <div class="actions">
                    <button id="chronogram-ack">Marquer comme lu</button>
                    <button id="chronogram-hide">Ne plus afficher</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        const ul = modal.querySelector('ul');
        // Add list items with colored due chips (localized labels)
        upcoming.forEach(it=>{
            const li = document.createElement('li');
            const left = document.createElement('div'); left.className = 'item-task'; left.textContent = it.task;
            const right = document.createElement('div'); right.className = 'item-date';
            const daysAway = Math.round((it.end - new Date())/(1000*60*60*24));
            const chip = document.createElement('span'); chip.className = 'due-chip';
            if(daysAway <= 3) chip.classList.add('soon');
            else if(daysAway <= 10) chip.classList.add('warn');
            else chip.classList.add('ok');

            // localized text
            let labelText = '';
            if(daysAway <= 0) labelText = "aujourd'hui";
            else if(daysAway === 1) labelText = "dans 1 jour";
            else labelText = `dans ${daysAway} jours`;

            const dateText = document.createElement('span'); dateText.className = 'chip-text';
            dateText.textContent = `${it.end.toISOString().split('T')[0]} — ${labelText}`;
            chip.appendChild(dateText);

            // add a small attention animation for very urgent items
            if(daysAway <= 3) li.classList.add('chronogram-attention');

            right.appendChild(chip);
            li.appendChild(left);
            li.appendChild(right);
            ul.appendChild(li);
        });
        // Focus for accessibility
        setTimeout(()=>{ modal.querySelector('#chronogram-close').focus(); }, 100);
        // Button handlers
        modal.querySelector('#chronogram-close').onclick = ()=>{ modal.remove(); };
        modal.querySelector('#chronogram-ack').onclick = ()=>{ modal.remove(); localStorage.setItem('chronogram_ack', new Date().toISOString()); };
        modal.querySelector('#chronogram-hide').onclick = ()=>{ modal.remove(); localStorage.setItem('chronogram_ack', 'never'); };

        // Try browser Notification
        if('Notification' in window && Notification.permission === 'granted'){
            const body = upcoming.map(it=>`${it.task} — ${it.end.toISOString().split('T')[0]}`).join('\n');
            new Notification('Rappels projet — échéances proches', { body });
        } else if('Notification' in window && Notification.permission !== 'denied'){
            Notification.requestPermission().then(p => { if(p==='granted'){ showAlerts(upcoming); } });
        }
    }

    // init on DOM ready
    document.addEventListener('DOMContentLoaded', ()=>{
        // If a static HTML block was provided via js/chronogramContent.js, use it.
        const container = document.getElementById('projectTimelineGantt');
        let items = [];
        if(window.chronogramRowsHtml && container){
            // inject the static rows
            container.innerHTML = window.chronogramRowsHtml;
            // try to build a lightweight items array for alert checks by reading date-badges
            const rows = Array.from(container.querySelectorAll('.gantt-row'));
            items = rows.map((r, idx) => {
                const task = (r.querySelector('.gantt-label') || {}).textContent || `item-${idx}`;
                const badge = r.querySelector('.date-badge');
                if(badge){
                    const m = badge.textContent.match(/(\d{4}-\d{2}-\d{2})\s*→\s*(\d{4}-\d{2}-\d{2})/);
                    if(m){ return { task: task.trim(), start: new Date(m[1]), end: new Date(m[2]) }; }
                }
                return { task: task.trim(), start: null, end: null };
            });
        } else {
            items = buildItemsFromChrono(CHRONO);
            renderChrono(items);
        }

        const upcoming = checkUpcoming(items,7);
        const lastAck = localStorage.getItem('chronogram_ack');
        if(!lastAck) showAlerts(upcoming);

        // toggle labels button
        const toggleBtn = document.getElementById('chronogram-toggle-labels');
        const gantt = document.getElementById('projectTimelineGantt');
        const pref = localStorage.getItem('chronogram_labels_hidden');
        if(pref === '1' && gantt) gantt.classList.add('labels-hidden');
        const headerEl = document.getElementById('projectTimelineHeader');
        if(toggleBtn){
            toggleBtn.addEventListener('click', ()=>{
                if(!gantt) return;
                const hidden = gantt.classList.toggle('labels-hidden');
                // keep header aligned
                if(headerEl) headerEl.classList.toggle('labels-hidden', hidden);
                localStorage.setItem('chronogram_labels_hidden', hidden? '1' : '0');
            });
        }

        // periodic check every hour
        setInterval(()=>{ const up = checkUpcoming(items,7); showAlerts(up); }, 1000*60*60);
    });

})();
