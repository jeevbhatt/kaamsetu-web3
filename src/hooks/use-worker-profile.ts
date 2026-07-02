import { useMutation, useQueryClient } from "@tanstack/react-query";
import { workerProfilesApi } from "@shram-sewa/shared/api";
import type { UpdateWorkerProfileInput } from "@shram-sewa/shared";
import { queryKeys } from "../lib/query-client";

export function useWorkerProfileUpdateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      profileId: string;
      patch: UpdateWorkerProfileInput;
    }) => workerProfilesApi.updateById(input.profileId, input.patch),
    onSuccess: (worker) => {
      queryClient.setQueryData(
        queryKeys.workerProfiles.byUser(worker.userId),
        worker,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.workers.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.workers.detail(worker.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.workerProfiles.byUser(worker.userId),
      });
    },
  });
}
