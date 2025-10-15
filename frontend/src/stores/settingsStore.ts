/**
 * Settings store using Zustand
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface SettingsState {
  selectedModel: string
  setSelectedModel: (model: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      selectedModel: 'deepseek/deepseek-chat-v3-0324:free',
      setSelectedModel: (model: string) => set({ selectedModel: model }),
    }),
    {
      name: 'tarregasheets-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
