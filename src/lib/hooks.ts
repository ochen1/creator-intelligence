import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

// Types
export type Tag = {
  tag_id: number
  tag_name: string
}

export type Campaign = {
  campaign_id: number
  campaign_name: string
  campaign_date: string
  campaign_type: 'CONTENT' | 'OUTBOUND_FOLLOW'
}

export type Profile = {
  profile_pk: number
  current_username: string
  first_seen_ts: string
  is_active_follower: boolean
  is_currently_following?: boolean
  is_pending_outbound_request?: boolean
  notes?: string | null
  tags?: { tag: { tag_id: number; tag_name: string } }[]
  interaction_events?: InteractionEvent[]
}

export type InteractionEvent = {
  event_id: number
  event_type: string
  event_ts: string
  attribution?: {
    reason: string
    campaign_id: number | null
    campaign?: Campaign
  } | null
}

export type ProfilesResponse = {
  data: Profile[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// API Functions
export const api = {
  // Campaigns
  fetchCampaigns: async (): Promise<Campaign[]> => {
    const res = await fetch('/api/campaigns')
    if (!res.ok) throw new Error('Failed to fetch campaigns')
    const response = await res.json()
    return response.data || []
  },

  createCampaign: async (data: Omit<Campaign, 'campaign_id'>): Promise<Campaign> => {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error('Failed to create campaign')
    const response = await res.json()
    return response.data
  },

  updateCampaign: async (id: number, data: Partial<Omit<Campaign, 'campaign_id'>>): Promise<Campaign> => {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error('Failed to update campaign')
    const response = await res.json()
    return response.data
  },

  deleteCampaign: async (id: number): Promise<void> => {
    const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete campaign')
  },

  // Profiles
  fetchProfiles: async (params: {
    status?: string
    search?: string
    page?: number
    pageSize?: number
    sortBy?: string
    sortDir?: string
  }): Promise<ProfilesResponse> => {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        searchParams.set(key, String(value))
      }
    })
    
    const res = await fetch(`/api/profiles?${searchParams.toString()}`)
    if (!res.ok) throw new Error('Failed to fetch profiles')
    const response = await res.json()
    // The API now returns { success: true, data: { data: profiles, total, page, etc } }
    return response.data || { data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }
  },

  fetchProfile: async (username: string): Promise<Profile> => {
    const res = await fetch(`/api/profiles/${encodeURIComponent(username)}`)
    if (!res.ok) throw new Error('Failed to fetch profile')
    const response = await res.json()
    return response.data
  },

  updateProfile: async (username: string, data: { notes?: string }): Promise<Profile> => {
    const res = await fetch(`/api/profiles/${encodeURIComponent(username)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error('Failed to update profile')
    const response = await res.json()
    return response.data
  },

  // Attributions
  setAttribution: async (eventId: number, data: { reason: string; campaign_id?: number | null }) => {
    const res = await fetch(`/api/events/${eventId}/attribution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error('Failed to set attribution')
    const response = await res.json()
    return response.data
  },

  deleteAttribution: async (eventId: number) => {
    const res = await fetch(`/api/events/${eventId}/attribution`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete attribution')
  },

  bulkAttribution: async (data: {
    profile_pks: number[]
    reason: string
    campaign_id?: number | null
    target: 'FOLLOWED' | 'UNFOLLOWED' | 'BOTH'
  }) => {
    const res = await fetch('/api/attributions/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error('Failed to apply bulk attribution')
    const response = await res.json()
    return response.data
  },

  // Tags
  fetchTags: async (): Promise<Tag[]> => {
    const res = await fetch('/api/tags')
    if (!res.ok) throw new Error('Failed to fetch tags')
    const response = await res.json()
    return response.data || []
  },

  createTag: async (tagName: string): Promise<Tag> => {
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagName })
    })
    if (!res.ok) throw new Error('Failed to create tag')
    const response = await res.json()
    return response.data
  },

  updateTag: async (id: number, tagName: string): Promise<Tag> => {
    const res = await fetch(`/api/tags/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagName })
    })
    if (!res.ok) throw new Error('Failed to update tag')
    const response = await res.json()
    return response.data
  },

  deleteTag: async (id: number): Promise<void> => {
    const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete tag')
  },

  // Profile Tags
  addTagToProfile: async (username: string, tagId: number) => {
    const res = await fetch(`/api/profiles/${encodeURIComponent(username)}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId })
    })
    if (!res.ok) throw new Error('Failed to add tag to profile')
    const response = await res.json()
    return response.data
  },

  removeTagFromProfile: async (username: string, tagId: number) => {
    const res = await fetch(`/api/profiles/${encodeURIComponent(username)}/tags`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagId })
    })
    if (!res.ok) throw new Error('Failed to remove tag from profile')
  }
}

// Hooks
export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: api.fetchCampaigns
  })
}

export function useProfiles(params: Parameters<typeof api.fetchProfiles>[0] = {}) {
  return useQuery({
    queryKey: ['profiles', params],
    queryFn: () => api.fetchProfiles(params)
  })
}

export function useProfile(username: string) {
  return useQuery({
    queryKey: ['profile', username],
    queryFn: () => api.fetchProfile(username),
    enabled: !!username
  })
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: api.fetchTags
  })
}

export function useCampaignMutations() {
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: api.createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Campaign created successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to create campaign: ${error.message}`)
    }
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof api.updateCampaign>[1] }) =>
      api.updateCampaign(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Campaign updated successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to update campaign: ${error.message}`)
    }
  })

  const remove = useMutation({
    mutationFn: api.deleteCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('Campaign deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete campaign: ${error.message}`)
    }
  })

  return { create, update, remove }
}

export function useAttributionMutations() {
  const queryClient = useQueryClient()

  const setAttribution = useMutation({
    mutationFn: ({ eventId, data }: { eventId: number; data: Parameters<typeof api.setAttribution>[1] }) =>
      api.setAttribution(eventId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast.success('Attribution set successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to set attribution: ${error.message}`)
    }
  })

  const deleteAttribution = useMutation({
    mutationFn: api.deleteAttribution,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast.success('Attribution removed successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove attribution: ${error.message}`)
    }
  })

  const bulkAttribution = useMutation({
    mutationFn: api.bulkAttribution,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('Bulk attribution applied successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to apply bulk attribution: ${error.message}`)
    }
  })

  return { setAttribution, deleteAttribution, bulkAttribution }
}

export function useTagMutations() {
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: api.createTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      toast.success('Tag created successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to create tag: ${error.message}`)
    }
  })

  const update = useMutation({
    mutationFn: ({ id, tagName }: { id: number; tagName: string }) =>
      api.updateTag(id, tagName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast.success('Tag updated successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to update tag: ${error.message}`)
    }
  })

  const remove = useMutation({
    mutationFn: api.deleteTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast.success('Tag deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete tag: ${error.message}`)
    }
  })

  return { create, update, remove }
}

export function useProfileTagMutations() {
  const queryClient = useQueryClient()

  const addTag = useMutation({
    mutationFn: ({ username, tagId }: { username: string; tagId: number }) =>
      api.addTagToProfile(username, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast.success('Tag added to profile')
    },
    onError: (error: Error) => {
      toast.error(`Failed to add tag: ${error.message}`)
    }
  })

  const removeTag = useMutation({
    mutationFn: ({ username, tagId }: { username: string; tagId: number }) =>
      api.removeTagFromProfile(username, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast.success('Tag removed from profile')
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove tag: ${error.message}`)
    }
  })

  return { addTag, removeTag }
}