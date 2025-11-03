export type ApiResponse<T = unknown> = {
  success: boolean;
  message: string;
  data?: T | null;
};

export const ResponseUtils = {
  success<T>(message: string, data?: T): ApiResponse<T> {
    return { success: true, message, data: data ?? null };
  },

  error(message: string, status: number, data?: unknown): ApiResponse {
    return { success: false, message, data: data ?? null };
  },
};
