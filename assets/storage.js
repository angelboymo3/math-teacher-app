(function (root) {
  'use strict';
  const KEY = 'puli-process.workspace';
  const LIMIT = 2 * 1024 * 1024;
  class StorageError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  const empty = () => ({ format: 'puli-process-backup', version: 1, selectedSemesterId: null, selectedCourseId: null, semesters: [] });
  function validate(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.format !== 'puli-process-backup') {
      throw new StorageError('format', '풀이과정 백업 파일이 아닙니다. 이 앱에서 내보낸 JSON 파일을 선택해 주세요.');
    }
    if (value.version !== 1) throw new StorageError('version', '이 버전의 앱에서 지원하지 않는 백업입니다. 파일을 만든 앱 버전을 확인해 주세요.');
    const keys = Object.keys(empty());
    if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key)) || !Array.isArray(value.semesters)) {
      throw new StorageError('shape', '백업의 필수 항목이나 구조가 올바르지 않습니다. 기존 데이터는 변경하지 않았습니다.');
    }
    // Stage 1 supports an empty workspace only. Never silently drop future course data.
    if (value.semesters.length || value.selectedSemesterId !== null || value.selectedCourseId !== null) {
      throw new StorageError('unsupported', '현재 단계는 빈 보관함만 지원합니다. 학기·과목 데이터가 있는 백업은 해당 기능이 추가된 버전에서 열어 주세요.');
    }
    return empty();
  }
  function parse(text) {
    if (new Blob([text]).size > LIMIT) throw new StorageError('size', '백업 파일은 2MB 이하로 선택해 주세요.');
    let value;
    try { value = JSON.parse(text.replace(/^\uFEFF/, '')); }
    catch { throw new StorageError('json', 'JSON 파일을 읽을 수 없습니다. 파일 내용이 손상되었거나 JSON 형식이 아닙니다.'); }
    return validate(value);
  }
  function storageFailure(error) {
    return new StorageError('storage', error?.name === 'QuotaExceededError'
      ? '브라우저 저장 공간이 부족합니다. 기존 데이터는 유지했습니다. 공간을 확보한 뒤 다시 시도해 주세요.'
      : '브라우저 저장소에 접근할 수 없습니다. 사이트의 저장 허용 설정을 확인한 뒤 다시 시도해 주세요.');
  }
  class Store {
    constructor(getStorage = () => root.localStorage) { this.getStorage = getStorage; this.raw = null; this.data = null; this.hasRead = false; }
    readRaw() {
      try { return this.getStorage().getItem(KEY); }
      catch (error) { throw storageFailure(error); }
    }
    load() {
      this.hasRead = false;
      this.data = null;
      const raw = this.readRaw();
      this.raw = raw;
      this.hasRead = true;
      this.data = null;
      if (raw === null) return this.save(empty());
      this.data = parse(raw);
      return this.data;
    }
    save(value) {
      const next = validate(value);
      if (!this.hasRead) throw new StorageError('unread', '저장 상태를 먼저 다시 확인해 주세요.');
      if (this.readRaw() !== this.raw) throw new StorageError('conflict', '다른 창에서 저장 내용이 바뀌었습니다. 현재 저장 내용을 다시 확인한 뒤 시도해 주세요.');
      const serialized = JSON.stringify(next);
      try { this.getStorage().setItem(KEY, serialized); }
      catch (error) { throw storageFailure(error); }
      this.raw = serialized;
      this.data = next;
      return next;
    }
  }
  const api = { KEY, LIMIT, empty, validate, parse, Store };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuliStorage = api;
})(globalThis);
