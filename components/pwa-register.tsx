'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const scopeUrl = new URL('./', document.baseURI);
      const serviceWorkerUrl = new URL('sw.js', scopeUrl);
      navigator.serviceWorker
        .register(serviceWorkerUrl.pathname, { scope: scopeUrl.pathname })
        .catch(() => undefined);
    }
  }, []);
  return null;
}
