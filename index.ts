import { Platform } from 'react-native';
import React from 'react';

// Para web, usar React DOM. Para React Native, usar registerRootComponent
if (Platform.OS === 'web') {
  // Web: usar React DOM
  import('react-dom/client').then(({ createRoot }) => {
    import('./App').then(({ default: App }) => {
      const root = document.getElementById('root');
      if (root) {
        const reactRoot = createRoot(root);
        reactRoot.render(React.createElement(App));
      }
    });
  });
} else {
  // React Native: usar registerRootComponent
  import('expo').then(({ registerRootComponent }) => {
    import('./App').then(({ default: App }) => {
      registerRootComponent(App);
    });
  });
}
