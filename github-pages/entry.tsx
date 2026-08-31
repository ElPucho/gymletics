import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/app/globals.css';
import { GymleticsApp } from '@/components/gymletics/gymletics-app';
import { PwaRegister } from '@/components/pwa-register';

const root = document.getElementById('root');

if (!root) {
  throw new Error('No se encontró el contenedor principal de Gymletics.');
}

createRoot(root).render(
  <StrictMode>
    <GymleticsApp />
    <PwaRegister />
  </StrictMode>,
);
