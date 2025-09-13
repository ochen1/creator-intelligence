'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Tags } from 'lucide-react';

type Tag = {
  tag_id: number;
  tag_name: string;
};

async function fetchTags(): Promise<Tag[]> {
  const res = await fetch('/api/tags');
  if (!res.ok) throw new Error('Failed to fetch tags');
  return res.json();
}

async function bulkTagProfiles(profilePks: number[], tagId: number, action: 'add' | 'remove'): Promise<void> {
  const res = await fetch('/api/profiles/tags/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profilePks, tagId, action }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || 'Bulk tag operation failed');
  }
}

export function BulkTagsSheet({ profilePks }: { profilePks: number[] }) {
  const queryClient = useQueryClient();
  const { data: tags, isLoading, isError, error } = useQuery<Tag[], Error>({
    queryKey: ['tags'],
    queryFn: fetchTags,
  });

  const [open, setOpen] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [action, setAction] = useState<'add' | 'remove'>('add');

  const mutation = useMutation({
    mutationFn: async () => {
      const tagId = Number(selectedTagId);
      if (!tagId || profilePks.length === 0) throw new Error('Select a tag and profiles');
      await bulkTagProfiles(profilePks, tagId, action);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('Bulk tag operation complete');
      setOpen(false);
      setSelectedTagId('');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Bulk tag operation failed');
    },
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" disabled={profilePks.length === 0}>
          <Tags className="h-4 w-4 mr-1" />
          Bulk Tag ({profilePks.length})
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Bulk Tag Profiles</SheetTitle>
        </SheetHeader>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Tag</label>
            <Select value={selectedTagId} onValueChange={setSelectedTagId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select tag" />
              </SelectTrigger>
              <SelectContent>
                {tags?.map(tag => (
                  <SelectItem key={tag.tag_id} value={String(tag.tag_id)}>
                    {tag.tag_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Action</label>
            <div className="flex gap-2">
              <Checkbox
                checked={action === 'add'}
                onCheckedChange={checked => checked && setAction('add')}
                id="bulk-add"
              />
              <label htmlFor="bulk-add" className="text-sm">Add</label>
              <Checkbox
                checked={action === 'remove'}
                onCheckedChange={checked => checked && setAction('remove')}
                id="bulk-remove"
              />
              <label htmlFor="bulk-remove" className="text-sm">Remove</label>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !selectedTagId || profilePks.length === 0}
            className="w-full"
          >
            {mutation.isPending ? 'Processing...' : 'Apply'}
          </Button>
          {mutation.error && (
            <div className="text-destructive text-sm">
              {(mutation.error as Error).message}
            </div>
          )}
        </div>
        <SheetFooter />
      </SheetContent>
    </Sheet>
  );
}