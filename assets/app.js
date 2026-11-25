(() => {
  'use strict';
  const error = document.getElementById('app-error');
  const showError = () => { if (error) error.hidden = false; };
  try {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
    if (tabs.length !== 5 || panels.some(panel => !panel)) throw new Error('Missing tab panel');
    function render() {
      try {
        let index = tabs.findIndex(tab => tab.hash === location.hash);
        if (index < 0) { index = 0; history.replaceState(null, '', tabs[0].hash); }
        tabs.forEach((tab, i) => {
          tab.setAttribute('aria-selected', String(i === index));
          tab.tabIndex = i === index ? 0 : -1;
          panels[i].hidden = i !== index;
        });
        document.title = `${tabs[index].textContent} · 풀이과정`;
        error.hidden = true;
      } catch { showError(); }
    }
    function select(index) {
      tabs[index].focus();
      if (location.hash !== tabs[index].hash) history.pushState(null, '', tabs[index].hash);
      render();
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        try { select(index); } catch { showError(); }
      });
      tab.addEventListener('keydown', event => {
        const targets = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1, ' ': index };
        if (!(event.key in targets)) return;
        event.preventDefault();
        try { select(targets[event.key]); } catch { showError(); }
      });
    });
    window.addEventListener('hashchange', render);
    window.addEventListener('popstate', render);
    render();
  } catch { showError(); }
})();
