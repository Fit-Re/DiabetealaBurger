import React from 'react';
import App from './App';

// Detectar si estamos en web
const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';

if (isWeb) {
  // Web: usar React DOM directamente
  const React18 = require('react');
  const ReactDOM = require('react-dom/client');

  const root = document.getElementById('root');
  if (root) {
    try {
      const reactRoot = ReactDOM.createRoot(root);
      reactRoot.render(React18.createElement(App));
      console.log('App rendered successfully with React DOM');
    } catch (e) {
      console.error('Error rendering app:', e);
      root.innerHTML = `<div style="color: red; padding: 20px;">Error: ${e.message}</div>`;
    }
  } else {
    console.error('Root element not found');
  }
} else {
  // React Native: usar registerRootComponent
  const { registerRootComponent } = require('expo');
  registerRootComponent(App);
}
