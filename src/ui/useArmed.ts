import { useRef } from 'react';

// Yeni açılan bir panel, açılmasına sebep olan dokunuşu (ya da oyunda hızlı hızlı
// dokunmaya devam eden parmağı) yakalamasın: ilk birkaç yüz ms basışları yok sayar.
// Örn. oyuncu kat bırakırken teklif açılırsa yanlışlıkla jeton harcamasın.
export function useArmed(delay = 500) {
  const at = useRef(Date.now() + delay);
  return <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => {
      if (Date.now() >= at.current) fn(...args);
    };
}
