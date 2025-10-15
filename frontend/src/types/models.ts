/**
 * AI Model types
 */

export interface AIModel {
  id: string
  name: string
  provider: string
  free: boolean
}

export interface ModelsResponse {
  models: AIModel[]
  current: string
}
