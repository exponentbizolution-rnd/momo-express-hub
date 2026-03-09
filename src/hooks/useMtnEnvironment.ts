import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useMtnEnvironment = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["mtn-environment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "mtn_environment")
        .single();
      if (error) throw error;
      return data.value as "sandbox" | "production";
    },
    staleTime: 30_000,
  });

  const environment = data || "sandbox";
  const currency = environment === "production" ? "ZMW" : "EUR";
  const isProduction = environment === "production";

  return { environment, currency, isProduction, isLoading };
};
