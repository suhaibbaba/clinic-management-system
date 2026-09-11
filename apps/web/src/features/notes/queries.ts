import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { ClinicNote, CreateClinicNoteInput, Paginated } from '@clinic/shared';

import { notesApi } from '@web/features/notes/api';

export const NOTES_KEY = 'clinic-notes';

/** The widget shows the most recent few; the board is not a list screen. */
export const NOTES_LIMIT = 6;

export function useNotes(): UseQueryResult<Paginated<ClinicNote>> {
  return useQuery({
    queryKey: [NOTES_KEY, NOTES_LIMIT],
    queryFn: () => notesApi.list(NOTES_LIMIT),
    placeholderData: (previous) => previous,
  });
}

function useNoteMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: [NOTES_KEY] }),
  });
}

export function useCreateNote(): UseMutationResult<ClinicNote, Error, CreateClinicNoteInput> {
  return useNoteMutation((body: CreateClinicNoteInput) => notesApi.create(body));
}

export function useDeleteNote(): UseMutationResult<void, Error, string> {
  return useNoteMutation((id: string) => notesApi.remove(id));
}
