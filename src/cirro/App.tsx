import React from 'react';
import { ViewerProvider } from '@cirrobio/react-tool';
import { CirroTreeViewer } from './CirroTreeViewer';

export function App() {
  return (
    <ViewerProvider>
      <CirroTreeViewer />
    </ViewerProvider>
  );
}
