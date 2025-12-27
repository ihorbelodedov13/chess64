import { useState, useCallback } from "react";
import { type AxiosError, type AxiosResponse } from "axios";

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiReturn<T, P extends unknown[]> extends UseApiState<T> {
  execute: (...args: P) => Promise<T | null>;
  reset: () => void;
}

/**
 * Хук для работы с API запросами
 *
 * @example
 * const { data, loading, error, execute } = useApi(fetchMe);
 *
 * useEffect(() => {
 *   execute();
 * }, []);
 */
export function useApi<T, P extends unknown[]>(
  apiFunc: (...args: P) => Promise<AxiosResponse<T>>
): UseApiReturn<T, P> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: P): Promise<T | null> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const response = await apiFunc(...args);
        setState({
          data: response.data,
          loading: false,
          error: null,
        });
        return response.data;
      } catch (err) {
        const error = err as AxiosError;
        const errorMessage =
          (error.response?.data as { message?: string })?.message ||
          error.message ||
          "Произошла ошибка";

        setState({
          data: null,
          loading: false,
          error: errorMessage,
        });
        return null;
      }
    },
    [apiFunc]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

/**
 * Хук для автоматического выполнения запроса при монтировании
 *
 * @example
 * const { data, loading, error, refetch } = useAutoApi(fetchMe);
 */
export function useAutoApi<T, P extends unknown[]>(
  apiFunc: (...args: P) => Promise<AxiosResponse<T>>,
  args?: P
): UseApiReturn<T, P> & { refetch: () => Promise<T | null> } {
  const api = useApi(apiFunc);

  const refetch = useCallback(() => {
    return api.execute(...(args || ([] as unknown as P)));
  }, [api, args]);

  // Автоматическое выполнение при монтировании
  useState(() => {
    refetch();
  });

  return {
    ...api,
    refetch,
  };
}
