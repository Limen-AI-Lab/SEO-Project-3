import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 初始化 i18n（必须在 App 渲染之前）
import './i18n';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);