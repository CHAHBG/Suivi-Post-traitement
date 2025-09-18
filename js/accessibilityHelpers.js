// Small accessibility helpers: focus trap and announcement utilities
(function(){
    function trapFocus(container){
        const focusable = container.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
        const first = focusable[0];
        const last = focusable[focusable.length-1];
        function handleKey(e){
            if(e.key === 'Tab'){
                if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
                else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
            }
            if(e.key === 'Escape'){ closeModal(container); }
        }
        container.__ah_keydown = handleKey;
        container.addEventListener('keydown', handleKey);
    }

    function releaseFocus(container){
        if(container.__ah_keydown){ container.removeEventListener('keydown', container.__ah_keydown); delete container.__ah_keydown; }
    }

    function announce(text, politeness='polite'){
        let region = document.getElementById('__ah_aria_live_region');
        if(!region){ region = document.createElement('div'); region.id='__ah_aria_live_region'; region.setAttribute('aria-live', politeness); region.setAttribute('aria-atomic','true'); region.className='visually-hidden'; document.body.appendChild(region); }
        region.textContent = text;
    }

    function openModal(modal){
        if(!modal) return;
        modal.setAttribute('aria-hidden','false');
        modal.dataset.visible = 'true';
        modal.classList.remove('visually-hidden');
        // focus first focusable element
        setTimeout(()=>{
            const focusable = modal.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
            if(focusable && focusable.length) focusable[0].focus();
            trapFocus(modal);
        },50);
        announce('Boîte de dialogue ouverte: échéances à venir');
    }

    function closeModal(modal){
        if(!modal) return;
        modal.setAttribute('aria-hidden','true');
        modal.dataset.visible = 'false';
        modal.classList.add('visually-hidden');
        releaseFocus(modal);
        announce('Boîte de dialogue fermée');
    }

    // wire chronogram alerts buttons if present
    document.addEventListener('DOMContentLoaded', ()=>{
    // support old/new ids: some pages use #chronogram-alerts, others use #chronogram-modal
    const modal = document.getElementById('chronogram-alerts') || document.getElementById('chronogram-modal');
        if(!modal) return;
    const closeBtn = document.getElementById('chronogram-close');
    const ackBtn = document.getElementById('chronogram-ack');
    const hideBtn = document.getElementById('chronogram-hide');
    const viewBtn = document.getElementById('chronogram-view');
        if(closeBtn) closeBtn.addEventListener('click', ()=> closeModal(modal));
        if(ackBtn) ackBtn.addEventListener('click', ()=>{
            announce('Échéances marquées comme lues');
            // simply close modal for now; persistence could be added later
            closeModal(modal);
        });
        if(hideBtn) hideBtn.addEventListener('click', ()=>{
            // set a localStorage flag to stop showing reminders
            try{ localStorage.setItem('chronogram.reminders.hidden','1'); }catch(e){}
            announce('Rappels masqués');
            closeModal(modal);
        });
        if(viewBtn) viewBtn.addEventListener('click', ()=>{
            const tab = document.querySelector('[data-tab="temporal"]'); if(tab) tab.click();
            closeModal(modal);
        });
        
        // If CHRONO tasks are provided on window.CHRONO_TASKS (array), detect upcoming deadlines
        try{
            const tasks = Array.isArray(window.CHRONO_TASKS) ? window.CHRONO_TASKS : [];
            if(tasks && tasks.length){
                // compute date boundaries using local dates (midnight) to avoid fractional-day off-by-one
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const soon = new Date(today.getTime() + (14*24*60*60*1000)); // inclusive: within 14 days
                // find all tasks whose end/due/date/finish falls within [now, soon]
                    const upcoming = tasks
                        .map(t=> ({ raw: t, date: (t && (t.end || t.due || t.date || t.finish)) ? new Date(t.end||t.due||t.date||t.finish) : null }))
                        .filter(x => x.date && !isNaN(x.date.getTime()) && x.date >= today && x.date <= soon)
                        .sort((a,b) => a.date - b.date);

                if(upcoming && upcoming.length){
                    // try a few possible list ids/containers to be resilient to markup differences
                    const list = document.getElementById('chronogram-alerts-list') || modal.querySelector('.chronogram-alerts-list') || modal.querySelector('ul') || document.getElementById('chronogram-list');
                    // accessible summary item
                    const summaryLi = document.createElement('li');
                    summaryLi.className = 'chronogram-alert-summary';
                    summaryLi.setAttribute('aria-live','polite');
                    summaryLi.textContent = `${upcoming.length} échéance(s) dans les 14 prochains jours`;

                    // build li items
                    const items = upcoming.map(x=>{
                        const t = x.raw;
                        const d = x.date;
                        // compute day difference relative to local date boundaries
                        const dueDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                        const days = Math.round((dueDate - today)/(24*60*60*1000));
                        const title = String(t.title || t.name || t.label || t.id || 'Tâche');
                        const id = t.id || '';
                        const li = document.createElement('li');
                        li.className = 'chronogram-attention';
                        const taskDiv = document.createElement('div'); taskDiv.className = 'item-task'; taskDiv.textContent = title;
                        const dateDiv = document.createElement('div'); dateDiv.className = 'item-date';
                        const chip = document.createElement('span'); chip.className = 'due-chip soon';
                        const chipText = document.createElement('span'); chipText.className = 'chip-text';
                        chipText.textContent = `${d.toISOString().slice(0,10)} — ${days===0? 'aujourd\'hui' : (days===1? 'demain' : days + ' jours')}`;
                        chip.appendChild(chipText);
                        dateDiv.appendChild(chip);
                        const actionsDiv = document.createElement('div'); actionsDiv.className = 'actions';
                        const btn = document.createElement('button'); btn.className = 'control-button'; btn.setAttribute('data-task-id', id); btn.title = 'Voir'; btn.textContent = 'Voir';
                        actionsDiv.appendChild(btn);
                        li.appendChild(taskDiv); li.appendChild(dateDiv); li.appendChild(actionsDiv);
                        return li;
                    });

                    // clear and append
                    list.innerHTML = '';
                    list.appendChild(summaryLi);
                    items.forEach(it=> list.appendChild(it));

                    // wire the Voir buttons inside the UL
                    list.querySelectorAll('button[data-task-id]').forEach(btn=> btn.addEventListener('click', (ev)=>{
                        const id = btn.getAttribute('data-task-id');
                        // close the modal first for a cleaner transition
                        try{ closeModal(modal); }catch(e){}
                        // activate the Regional tab and then focus the task in the chronogram area
                        const regionalTab = document.querySelector('[data-tab="regional"]');
                        if(regionalTab) regionalTab.click();
                        if(window.chronogram && typeof window.chronogram.focusTask === 'function'){
                            try{ window.chronogram.focusTask(id); }catch(e){}
                        }
                        btn.focus();
                    }));

                    // add scroll shadow indicators
                    function updateShadows(){
                        try{
                            const el = list;
                            if(!el) return;
                            const { scrollTop, scrollHeight, clientHeight } = el;
                            el.classList.toggle('shadow-top', scrollTop > 2);
                            el.classList.toggle('shadow-bottom', (scrollTop + clientHeight) < (scrollHeight - 2));
                        }catch(e){}
                    }
                    // initial shadow state and event
                    updateShadows();
                    list.removeEventListener('__ah_scroll', updateShadows);
                    list.addEventListener('scroll', updateShadows);

                    // only show if reminders are not hidden via localStorage
                    try{
                        if(!localStorage.getItem('chronogram.reminders.hidden')) openModal(modal);
                    }catch(e){ openModal(modal); }
                }
            }
        }catch(e){ console.warn('chronogram alert detection failed', e); }
            // Populate upcoming deadlines from CHRONO tasks (extract into a callable function)
            function populateChronoAlerts(){
                try{
                    const tasks = Array.isArray(window.CHRONO_TASKS) ? window.CHRONO_TASKS : [];
                    if(!tasks || !tasks.length) return false;
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const soon = new Date(today.getTime() + (14*24*60*60*1000)); // inclusive: within 14 days

                    // find tasks whose end/due/date/finish falls within [today, soon]
                    const upcoming = tasks
                        .map(t=> ({ raw: t, date: (t && (t.end || t.due || t.date || t.finish)) ? new Date(t.end||t.due||t.date||t.finish) : null }))
                        .filter(x => x.date && !isNaN(x.date.getTime()) && x.date >= today && x.date <= soon)
                        .sort((a,b) => a.date - b.date);

                    if(!upcoming.length) return true; // nothing to show but the data is present

                    const list = document.getElementById('chronogram-alerts-list');
                    if(!list) return true;

                    // accessible summary item
                    const summaryLi = document.createElement('li');
                    summaryLi.className = 'chronogram-alert-summary';
                    summaryLi.setAttribute('aria-live','polite');
                    summaryLi.textContent = `${upcoming.length} échéance(s) dans les 14 prochains jours`;

                    // build li items
                    const items = upcoming.map(x=>{
                        const t = x.raw;
                        const d = x.date;
                        const dueDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                        const days = Math.round((dueDate - today)/(24*60*60*1000));
                        const title = String(t.title || t.name || t.label || t.id || 'Tâche');
                        const id = t.id || '';
                        const li = document.createElement('li');
                        li.className = 'chronogram-attention';
                        const taskDiv = document.createElement('div'); taskDiv.className = 'item-task'; taskDiv.textContent = title;
                        const dateDiv = document.createElement('div'); dateDiv.className = 'item-date';
                        const chip = document.createElement('span'); chip.className = 'due-chip soon';
                        const chipText = document.createElement('span'); chipText.className = 'chip-text';
                        chipText.textContent = `${d.toISOString().slice(0,10)} — ${days===0? 'aujourd\'hui' : (days===1? 'demain' : days + ' jours')}`;
                        chip.appendChild(chipText);
                        dateDiv.appendChild(chip);
                        const actionsDiv = document.createElement('div'); actionsDiv.className = 'actions';
                        const btn = document.createElement('button'); btn.className = 'control-button'; btn.setAttribute('data-task-id', id); btn.title = 'Voir'; btn.textContent = 'Voir';
                        actionsDiv.appendChild(btn);
                        li.appendChild(taskDiv); li.appendChild(dateDiv); li.appendChild(actionsDiv);
                        return li;
                    });

                    // clear and append
                    list.innerHTML = '';
                    list.appendChild(summaryLi);
                    items.forEach(it=> list.appendChild(it));

                    // wire the Voir buttons inside the UL
                    list.querySelectorAll('button[data-task-id]').forEach(btn=> btn.addEventListener('click', (ev)=>{
                        const id = btn.getAttribute('data-task-id');
                        const regionalTab = document.querySelector('[data-tab="regional"]');
                        if(regionalTab) regionalTab.click();
                        if(window.chronogram && typeof window.chronogram.focusTask === 'function'){
                            try{ window.chronogram.focusTask(id); }catch(e){}
                        }
                        btn.focus();
                    }));

                    // only show if reminders are not hidden via localStorage
                    try{
                        if(!localStorage.getItem('chronogram.reminders.hidden')) openModal(modal);
                    }catch(e){ openModal(modal); }

                    return true;
                }catch(err){ console.warn('chronogram alert detection failed', err); return false; }
            }

            // attempt to populate immediately; if CHRONO_TASKS arrives later, poll briefly
            try{
                const populated = populateChronoAlerts();
                if(!populated){
                    let attempts = 0;
                    const poll = setInterval(()=>{
                        attempts += 1;
                        const done = populateChronoAlerts();
                        if(done || attempts >= 20) clearInterval(poll);
                    }, 250);
                }
            }catch(e){ console.warn('populateChronoAlerts error', e); }

            // expose manual trigger
            try{ window.__AH = window.__AH || {}; window.__AH.populateChronoAlerts = populateChronoAlerts; }catch(e){}
    });

    // expose helpers for other modules
    window.__AH = { announce, openModal, closeModal };
})();
