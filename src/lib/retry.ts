import pRetry, { Options } from "p-retry";

/**
 * Wrapper for p-retry to standardize retry logic across the app.
 * Useful for flaky external APIs like Google Drive or Gemini.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: Options = { retries: 3, factor: 2, minTimeout: 1000 }
): Promise<T> {
    return pRetry(fn, {
        ...options,
        onFailedAttempt: (error) => {
            console.warn(
                `Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`
            );
            // You could add more sophisticated logging here
        },
    });
}
