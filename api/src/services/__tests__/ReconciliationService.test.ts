import { registerReconciler, startReconciliation, stopReconciliation, _resetForTests } from "../ReconciliationService";

describe("ReconciliationService", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        _resetForTests();
    });

    afterEach(() => {
        stopReconciliation();
        jest.useRealTimers();
    });

    it("runs a registered reconciler immediately on start", () => {
        const fn = jest.fn().mockResolvedValue(undefined);
        registerReconciler("workgroup", 60_000, fn);

        startReconciliation();

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("runs each reconciler again after its own interval elapses", async () => {
        const fastFn = jest.fn().mockResolvedValue(undefined);
        const slowFn = jest.fn().mockResolvedValue(undefined);
        registerReconciler("fast", 1_000, fastFn);
        registerReconciler("slow", 5_000, slowFn);

        startReconciliation();
        expect(fastFn).toHaveBeenCalledTimes(1);
        expect(slowFn).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(1_000);
        await Promise.resolve();
        expect(fastFn).toHaveBeenCalledTimes(2);
        expect(slowFn).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(4_000);
        await Promise.resolve();
        expect(fastFn).toHaveBeenCalledTimes(6);
        expect(slowFn).toHaveBeenCalledTimes(2);
    });

    it("does not let one reconciler throwing stop others from running", async () => {
        const failingFn = jest.fn().mockRejectedValue(new Error("boom"));
        const okFn = jest.fn().mockResolvedValue(undefined);
        registerReconciler("failing", 1_000, failingFn);
        registerReconciler("ok", 1_000, okFn);

        startReconciliation();
        await Promise.resolve();

        jest.advanceTimersByTime(1_000);
        await Promise.resolve();

        expect(okFn).toHaveBeenCalledTimes(2);
    });

    it("stopReconciliation clears all intervals", () => {
        const fn = jest.fn().mockResolvedValue(undefined);
        registerReconciler("workgroup", 1_000, fn);
        startReconciliation();
        fn.mockClear();

        stopReconciliation();
        jest.advanceTimersByTime(10_000);

        expect(fn).not.toHaveBeenCalled();
    });
});
