import { describe, expect, it, vi } from "vitest";
import { createJobPump } from "@/lib/jobs/pump";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("lesson worker job cap", () => {
  it("prevents overlapping ticks from claiming above capacity", async () => {
    const slowClaim = deferred<number | null>();
    const claim = vi.fn().mockResolvedValue(1).mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockReturnValueOnce(slowClaim.promise);
    const run = vi.fn(() => new Promise<void>(() => {}));
    const tick = createJobPump({ concurrency: 3, claim, run, onError: vi.fn() });
    const first = tick();
    await Promise.resolve();
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(2);
    await tick();
    await tick();
    expect(claim).toHaveBeenCalledTimes(3);
    slowClaim.resolve(3);
    await first;
    await tick();
    expect(run).toHaveBeenCalledTimes(3);
    expect(claim).toHaveBeenCalledTimes(3);
  });

  it("releases capacity when a job rejects, including failures before its own catch", async () => {
    const job = deferred<void>();
    const claim = vi.fn().mockResolvedValue(1);
    const onError = vi.fn();
    const run = vi.fn().mockReturnValue(job.promise);
    const tick = createJobPump({ concurrency: 1, claim, run, onError });
    await tick();
    await tick();
    expect(run).toHaveBeenCalledTimes(1);
    job.reject(new Error("database failure"));
    await Promise.resolve();
    run.mockReturnValue(new Promise<void>(() => {}));
    await tick();
    expect(run).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "database failure" }));
  });

  it("unlocks polling after a claim error or an empty queue", async () => {
    const claim = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(null);
    const onError = vi.fn();
    const tick = createJobPump({ concurrency: 3, claim, run: vi.fn(), onError });
    await tick();
    await tick();
    await tick();
    expect(claim).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
