'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useProfiles } from '@/lib/hooks'
import { formatDate } from '@/lib/dates'
import { Search, UserCheck, UserX, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pencil, Check, X } from 'lucide-react'
import type { Profile } from '@/lib/hooks'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface ProfileListProps {
  onSelectProfile: (username: string) => void
  selectedProfilePks?: number[]
  onSelectionChange?: (profilePks: number[]) => void
}

// API function for updating profile notes
const updateProfileNotes = async ({ username, notes }: { username: string; notes: string }) => {
  const res = await fetch(`/api/profiles/${encodeURIComponent(username)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ notes }),
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(msg || 'Failed to update notes')
  }
  return res.json()
}

// Notes cell component with inline editing
function NotesCell({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState<string>(profile.notes ?? '')

  const updateNotesMutation = useMutation({
    mutationFn: updateProfileNotes,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      setEditing(false)
    },
  })

  const save = () => {
    if (!updateNotesMutation.isPending) {
      updateNotesMutation.mutate({
        username: profile.current_username,
        notes: value,
      })
    }
  }

  return (
    <div className="w-full max-w-[300px]" onClick={(e) => e.stopPropagation()}>
      {!editing ? (
        <div className="group flex items-center gap-2">
          {profile.notes && profile.notes.length > 0 ? (
            <span title={profile.notes} className="truncate text-sm flex-1">
              {profile.notes}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs flex-1">No notes</span>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(true)}
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={2}
            autoFocus
            className="text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                setEditing(false)
                setValue(profile.notes ?? '')
              }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                save()
              }
            }}
          />
          <div className="flex gap-1">
            <Button size="sm" onClick={save} disabled={updateNotesMutation.isPending} className="h-7 text-xs">
              <Check className="h-3 w-3 mr-1" />
              {updateNotesMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={updateNotesMutation.isPending}
              onClick={() => {
                setEditing(false)
                setValue(profile.notes ?? '')
              }}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ProfileList({ 
  onSelectProfile, 
  selectedProfilePks = [], 
  onSelectionChange 
}: ProfileListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)

  const { data: profilesResponse, isLoading, isError, error } = useProfiles({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: searchQuery || undefined,
    page,
    pageSize,
    sortBy: 'first_seen_ts',
    sortDir: 'desc'
  })

  const profiles = profilesResponse?.data || []
  const total = profilesResponse?.total || 0
  const totalPages = profilesResponse?.totalPages || 1

  // Status filter options
  const statusOptions = [
    { key: 'all', label: 'All' },
    { key: 'follower', label: 'Followers' },
    { key: 'following', label: 'Following' },
    { key: 'mutual', label: 'Mutual' },
    { key: 'none', label: 'No Connection' }
  ]

  // Get status badge for profile
  const getStatusBadge = (profile: Profile) => {
    const isFollower = profile.is_active_follower
    const isFollowing = profile.is_currently_following
    const isPending = profile.is_pending_outbound_request

    if (isFollower && isFollowing) {
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700">
          <UserCheck className="mr-1 h-3 w-3" />
          Mutual
        </Badge>
      )
    } else if (isFollower) {
      return (
        <Badge className="bg-green-500 hover:bg-green-600">
          <UserCheck className="mr-1 h-3 w-3" />
          Follower
        </Badge>
      )
    } else if (isFollowing) {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600">
          <UserCheck className="mr-1 h-3 w-3" />
          Following
        </Badge>
      )
    } else if (isPending) {
      return (
        <Badge className="bg-purple-500 hover:bg-purple-600">
          <UserCheck className="mr-1 h-3 w-3" />
          Pending
        </Badge>
      )
    } else {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <UserX className="mr-1 h-3 w-3" />
          None
        </Badge>
      )
    }
  }

  // Handle row selection
  const handleRowSelection = (profilePk: number, checked: boolean) => {
    if (!onSelectionChange) return
    
    const newSelection = checked 
      ? [...selectedProfilePks, profilePk]
      : selectedProfilePks.filter(pk => pk !== profilePk)
    
    onSelectionChange(newSelection)
  }

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return
    
    if (checked) {
      const allVisiblePks = profiles.map(p => p.profile_pk)
      const newSelection = Array.from(new Set([...selectedProfilePks, ...allVisiblePks]))
      onSelectionChange(newSelection)
    } else {
      const visiblePkSet = new Set(profiles.map(p => p.profile_pk))
      const newSelection = selectedProfilePks.filter(pk => !visiblePkSet.has(pk))
      onSelectionChange(newSelection)
    }
  }

  const allVisibleSelected = profiles.length > 0 && profiles.every(p => selectedProfilePks.includes(p.profile_pk))
  const someVisibleSelected = profiles.some(p => selectedProfilePks.includes(p.profile_pk))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Profiles</span>
          {selectedProfilePks.length > 0 && (
            <Badge variant="outline" className="text-sm">
              {selectedProfilePks.length} selected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Search */}
          <div className="space-y-2">
            <label htmlFor="search" className="text-sm font-medium">Search Username</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search usernames..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((option) => (
                <Button
                  key={option.key}
                  size="sm"
                  variant={statusFilter === option.key ? 'default' : 'outline'}
                  onClick={() => {
                    setStatusFilter(option.key)
                    setPage(1)
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {total > 0 ? `Showing ${((page - 1) * pageSize) + 1}-${Math.min(page * pageSize, total)} of ${total}` : 'No results'}
          </span>
          {selectedProfilePks.length > 0 && (
            <span>{selectedProfilePks.length} profiles selected across all pages</span>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-muted-foreground">Loading profiles...</span>
          </div>
        ) : isError ? (
          <div className="text-center py-8">
            <p className="text-sm text-destructive">Error: {error?.message}</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {onSelectionChange && (
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={allVisibleSelected ? true : (someVisibleSelected ? 'indeterminate' as any : false)}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                  )}
                  <TableHead>Username</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>First Seen</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.length === 0 ? (
                  <TableRow>
                    <TableCell 
                      colSpan={onSelectionChange ? 5 : 4} 
                      className="h-24 text-center text-muted-foreground"
                    >
                      <div className="flex flex-col items-center justify-center py-4">
                        <Search className="h-8 w-8 mb-2 text-muted-foreground" />
                        <p>No profiles found</p>
                        <p className="text-xs">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  profiles.map((profile) => (
                    <TableRow 
                      key={profile.profile_pk}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onSelectProfile(profile.current_username)}
                    >
                      {onSelectionChange && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedProfilePks.includes(profile.profile_pk)}
                            onCheckedChange={(checked) => 
                              handleRowSelection(profile.profile_pk, checked === true)
                            }
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        <a
                          href={`https://instagram.com/${profile.current_username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          @{profile.current_username}
                        </a>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(profile)}
                      </TableCell>
                      <TableCell>
                        {formatDate(profile.first_seen_ts, 'date')}
                      </TableCell>
                      <TableCell>
                        <NotesCell profile={profile} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}