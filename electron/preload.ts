import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  apiBaseUrl: `http://localhost:${process.env.BACKEND_PORT || 3001}`,
});
