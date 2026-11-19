/* 랭킹 공용 도우미: 같은 학교 + 같은 이름은 한 사람으로 보고 최고 기록 하나만 보여 줌.
   (띄어쓰기와 영어 대소문자는 무시하고 비교) */
window.KRANK = {
  key(school, name) {
    const clean = s => String(s || '').replace(/\s+/g, '').toLowerCase();
    return clean(school) + '|' + clean(name);
  },
  // 점수 높은 순으로 정렬된 문서 목록에서 같은 사람의 두 번째 기록부터 뺌
  dedupe(docs) {
    const seen = new Set();
    return docs.filter(d => {
      const v = d.data(), k = this.key(v.school, v.name);
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  },
  // 문서 목록에서 이 사람의 최고 기록 문서 찾기 (없으면 null)
  bestOf(docs, school, name) {
    const k = this.key(school, name);
    let best = null;
    docs.forEach(d => {
      const v = d.data();
      if (this.key(v.school, v.name) === k && (!best || (v.score || 0) > (best.data().score || 0))) best = d;
    });
    return best;
  },
  // 전체 문서에서 내 점수보다 높은 사람 수 + 1 (같은 사람은 한 번만)
  rankOf(docs, score) {
    return this.dedupe(docs).filter(d => (d.data().score || 0) > score).length + 1;
  }
};
