/**
 * Next.js instrumentation — runs once when the server process starts.
 * We use it to launch the in-process background lesson-generation worker.
 * Guarded to the Node.js runtime (skips edge) and imported dynamically so the
 * worker's Node-only deps don't load in other runtimes.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startLessonWorker } = await import("@/lib/jobs/lessonWorker");
    startLessonWorker();
  }
}
