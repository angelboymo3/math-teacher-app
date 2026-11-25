(() => {
  'use strict';
  const api = window.PuliStorage;
  const status = document.getElementById('backup-status');
  const exportButton = document.getElementById('export-backup');
  const importButton = document.getElementById('import-backup');
  const fileInput = document.getElementById('backup-file');
  const recovery = document.getElementById('backup-recovery');
  const rawButton = document.getElementById('export-original');
  const resetButton = document.getElementById('reset-storage');
  const dialog = document.getElementById('restore-dialog');
  const confirmButton = document.getElementById('confirm-restore');
  let pending = null;
  let busy = false;
  let stale = false;
  let store;
  function announce(message, error = false) {
    status.textContent = message;
    status.classList.toggle('backup-error', error);
  }
  function updateControls() {
    exportButton.disabled = busy || stale || !store?.data;
    importButton.disabled = busy || stale || !store?.hasRead;
    rawButton.disabled = stale || !store?.hasRead || store.raw === null;
    resetButton.disabled = stale || !store?.hasRead;
  }
  function report(error) {
    announce(error.message || '처리하지 못했습니다. 다시 시도해 주세요.', true);
    recovery.hidden = false;
    updateControls();
  }
  function load() {
    try {
      store.load();
      stale = false;
      recovery.hidden = true;
      announce('빈 보관함이 이 브라우저에 저장되어 있습니다. 학기·과목 입력은 다음 단계에서 제공합니다.');
    } catch (error) { stale = false; report(error); }
    updateControls();
  }
  function download(text, filename) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function openConfirmation(value, resetting = false) {
    pending = value;
    document.getElementById('restore-title').textContent = resetting ? '보관함을 비울까요?' : '백업으로 교체할까요?';
    document.getElementById('restore-summary').textContent = resetting
      ? '현재 보관함을 빈 상태로 바꿉니다. 읽을 수 없는 원본이 있다면 먼저 원본 저장을 눌러 보관해 주세요.'
      : '가져올 내용: 학기 0개 · 과목 0개. 현재 보관함 전체를 이 파일의 내용으로 덮어씁니다. 필요한 내용은 먼저 내보내기로 보관해 주세요.';
    confirmButton.textContent = resetting ? '빈 보관함으로 초기화' : '전체 교체하고 저장';
    dialog.showModal();
    document.getElementById('cancel-restore').focus();
  }
  try {
    if (!api) throw new Error('저장 기능을 불러오지 못했습니다. 새로고침해 주세요.');
    store = new api.Store();
    document.getElementById('reload-storage').addEventListener('click', load);
    exportButton.addEventListener('click', () => {
      try {
        if (store.readRaw() !== store.raw) throw new Error('다른 창에서 저장 내용이 바뀌었습니다. 저장 상태를 다시 확인해 주세요.');
        download(JSON.stringify(api.validate(store.data), null, 2), `puli-process-backup-${new Date().toISOString().slice(0, 10)}.json`);
        announce('백업 파일 다운로드를 요청했습니다. 브라우저의 다운로드 목록을 확인해 주세요.');
      } catch (error) { report(error); }
    });
    rawButton.addEventListener('click', () => {
      try {
        const raw = store.readRaw();
        if (raw === null) throw new Error('보관할 원본이 없습니다.');
        download(raw, 'puli-process-original.json');
        announce('원본 파일 다운로드를 요청했습니다. 이 파일은 손상되어 있을 수 있으므로 정상 백업과 구분해 보관해 주세요.');
      } catch (error) { report(error); }
    });
    resetButton.addEventListener('click', () => openConfirmation(api.empty(), true));
    importButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      busy = true;
      updateControls();
      try {
        if (!/\.json$/i.test(file.name)) throw new Error('확장자가 .json인 백업 파일을 선택해 주세요.');
        if (file.size > api.LIMIT) throw new Error('백업 파일은 2MB 이하로 선택해 주세요.');
        let text;
        try { text = await file.text(); }
        catch { throw new Error('파일을 읽지 못했습니다. 파일 접근 권한을 확인하고 다시 선택해 주세요.'); }
        const value = api.parse(text);
        if (stale) throw new Error('다른 창에서 변경되었습니다. 저장 상태를 다시 확인해 주세요.');
        openConfirmation(value);
      } catch (error) { report(error); }
      finally { busy = false; updateControls(); }
    });
    document.getElementById('cancel-restore').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { pending = null; });
    confirmButton.addEventListener('click', () => {
      if (!pending) return;
      try {
        store.save(pending);
        recovery.hidden = true;
        announce('보관함이 이 브라우저에 저장되었습니다.');
      } catch (error) { report(error); }
      finally { dialog.close(); updateControls(); }
    });
    window.addEventListener('storage', event => {
      if (event.key !== api.KEY && event.key !== null) return;
      stale = true;
      if (dialog.open) dialog.close();
      report(new Error('다른 창에서 저장 내용이 바뀌었습니다. 저장 상태 다시 확인을 눌러 최신 내용을 불러와 주세요.'));
    });
    load();
  } catch (error) { report(error); }
})();
