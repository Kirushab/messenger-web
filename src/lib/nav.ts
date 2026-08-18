import type { NavigateFunction } from 'react-router-dom';

/**
 * «Умный назад»: если в истории приложения есть куда возвращаться — nav(-1),
 * иначе (прямой заход/перезагрузка/deep-link) — переход на разумный fallback.
 * React Router кладёт индекс истории в window.history.state.idx.
 */
export function goBack(nav: NavigateFunction, fallback: string) {
  const st: any = typeof window !== 'undefined' ? window.history.state : null;
  const idx = st && typeof st.idx === 'number' ? st.idx : 0;
  if (idx > 0) nav(-1);
  else nav(fallback, { replace: true });
}
