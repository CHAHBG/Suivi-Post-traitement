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
        const modal = document.getElementById('chronogram-alerts');
        if(!modal) return;
        const openBtn = document.getElementById('chronogram-alerts-open');
        const closeBtn = document.getElementById('chronogram-alerts-close');
        if(closeBtn) closeBtn.addEventListener('click', ()=> closeModal(modal));
        if(openBtn) openBtn.addEventListener('click', ()=>{
            // open chronogram panel in main UI and close modal
            try{ document.querySelector('[data-tab="temporal"]').click(); }catch(e){}
            closeModal(modal);
            // also ensure the chronogram panel is visible (tab id)
            const tab = document.querySelector('[data-tab="temporal"]'); if(tab){ tab.click(); }
        });
        
        // If CHRONO tasks are provided on window.CHRONO_TASKS (array), detect upcoming deadlines
        try{
            const tasks = Array.isArray(window.CHRONO_TASKS) ? window.CHRONO_TASKS : [];
            if(tasks && tasks.length){
                const now = new Date();
                const soon = new Date(now.getTime() + (14*24*60*60*1000)); // next 14 days
                const upcoming = tasks.filter(t=>{
                    const d = t && (t.end || t.due || t.date || t.finish) ? new Date(t.end||t.due||t.date||t.finish) : null;
                    return d && !isNaN(d.getTime()) && d >= now && d <= soon;
                }).sort((a,b)=> new Date(a.end||a.due||a.date||a.finish) - new Date(b.end||b.due||b.date||b.finish));
                if(upcoming && upcoming.length){
                    const list = document.getElementById('chronogram-alerts-list');
                    list.innerHTML = upcoming.map(t=>{
                        const d = new Date(t.end||t.due||t.date||t.finish);
                        const days = Math.ceil((d - now)/(24*60*60*1000));
                        return `<div class="chronogram-alert"><div><div class="title">${String(t.title||t.name||t.id||'Tâche')}</div><div class="meta">Échéance: ${d.toLocaleDateString()} (${days} jours)</div></div><div class="actions"><button class="control-button" data-task-id="${t.id||''}" title="Voir">Voir</button></div></div>`;
                    }).join('');
                    // wire the 'Voir' buttons to open chronogram and attempt to focus the task via existing code if available
                    list.querySelectorAll('button[data-task-id]').forEach(btn=> btn.addEventListener('click', (ev)=>{
                        const id = btn.getAttribute('data-task-id');
                        // try to use existing chronogramIntegration API if exposed
                        if(window.chronogram && typeof window.chronogram.focusTask === 'function'){
                            window.chronogram.focusTask(id);
                        }
                        // open temporal tab
                        const tab = document.querySelector('[data-tab="temporal"]'); if(tab) tab.click();
                    }));
                    // show modal
                    openModal(modal);
                }
            }
        }catch(e){ console.warn('chronogram alert detection failed', e); }
    });

    // expose helpers for other modules
    window.__AH = { announce, openModal, closeModal };
})();
