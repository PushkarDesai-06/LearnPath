/** One claim loop per process; jobs may run concurrently up to the given cap. */
export function createJobPump<T>(options: {
  concurrency: number;
  claim: () => Promise<T | null>;
  run: (job: T) => Promise<void>;
  onError: (error: unknown) => void;
}): () => Promise<void> {
  let polling = false;
  let active = 0;
  return async () => {
    if (polling) return;
    polling = true;
    try {
      while (active < options.concurrency) {
        const job = await options.claim();
        if (!job) break;
        active += 1;
        void (async () => {
          try {
            await options.run(job);
          } catch (error) {
            options.onError(error);
          } finally {
            active -= 1;
          }
        })();
      }
    } catch (error) {
      options.onError(error);
    } finally {
      polling = false;
    }
  };
}
