'use client';

import { Toaster } from 'react-hot-toast';

const toastStyle = {
  background: '#ffffff',
  color: '#0A0A0A',
  border: '1px solid #E5E5E5',
  fontSize: '12px',
  borderRadius: '10px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
};

export default function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: toastStyle,
        success: { iconTheme: { primary: '#CC0000', secondary: '#fff' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
      }}
    />
  );
}
