export const useMtnEnvironment = () => {
  return {
    environment: "production" as const,
    currency: "ZMW",
    isProduction: true,
    isLoading: false,
  };
};
