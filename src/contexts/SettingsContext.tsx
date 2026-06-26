import React, { createContext, useContext, useEffect, useState } from 'react';

interface Settings {
  theme: string;
  feedDensity: string;
  threadStyle: string;
  reducedMotion: boolean;
  hideLowQuality: boolean;
  showThoughts: boolean;
  workspaceMode: boolean;
  markdownRendering: boolean;
  performanceMode: boolean;
  publicProfile: boolean;
  showOnlineStatus: boolean;
  allowDirectMessages: boolean;
  experimentalFeatures: boolean;
  developerMode: boolean;
  preferredDomains: string[];
  preferredDifficulty: string[];
  notifications: {
     likes: boolean;
     replies: boolean;
     followers: boolean;
     solutions: boolean;
     statusChanges: boolean;
  }
}

const defaultSettings: Settings = {
  theme: 'dark',
  feedDensity: 'comfortable',
  threadStyle: 'compact',
  reducedMotion: false,
  hideLowQuality: false,
  showThoughts: true,
  workspaceMode: false,
  markdownRendering: true,
  performanceMode: false,
  publicProfile: true,
  showOnlineStatus: true,
  allowDirectMessages: false,
  experimentalFeatures: false,
  developerMode: false,
  preferredDomains: [],
  preferredDifficulty: [],
  notifications: {
     likes: true,
     replies: true,
     followers: true,
     solutions: true,
     statusChanges: true,
  }
};

interface SettingsContextType {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem('buildops-settings');
      if (saved) {
        return { ...defaultSettings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn("localStorage is not available:", e);
    }
    return defaultSettings;
  });

  useEffect(() => {
    try {
      localStorage.setItem('buildops-settings', JSON.stringify(settings));
    } catch (e) {
      console.warn("Could not save settings to localStorage:", e);
    }
    
    // Apply workspace mode
    if (settings.workspaceMode) {
      document.body.classList.add('workspace-mode');
    } else {
      document.body.classList.remove('workspace-mode');
    }

    // Apply reduced motion
    if (settings.reducedMotion) {
      document.body.classList.add('reduced-motion');
    } else {
      document.body.classList.remove('reduced-motion');
    }

  }, [settings]);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
