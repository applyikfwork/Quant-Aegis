import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseEnabled } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function useRealtimeTable(table: string, queryKeys: unknown[][]) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!isSupabaseEnabled) return;

    const channel = supabase
      .channel(`realtime:${table}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          queryKeys.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
          });
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, queryClient]);
}

export function useRealtimeMultiple(
  subscriptions: Array<{ table: string; queryKeys: unknown[][] }>
) {
  const queryClient = useQueryClient();
  const channelsRef = useRef<RealtimeChannel[]>([]);

  useEffect(() => {
    if (!isSupabaseEnabled) return;

    const channels = subscriptions.map(({ table, queryKeys }) =>
      supabase
        .channel(`realtime:${table}:${Math.random()}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => {
            queryKeys.forEach((key) => {
              queryClient.invalidateQueries({ queryKey: key });
            });
          }
        )
        .subscribe()
    );

    channelsRef.current = channels;
    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);
}
