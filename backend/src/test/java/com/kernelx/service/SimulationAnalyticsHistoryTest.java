package com.kernelx.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class SimulationAnalyticsHistoryTest {
    @Test void samplesActualIntervalsAndBoundsRetainedHistory() {
        SimulationAnalyticsHistory history = new SimulationAnalyticsHistory();
        String runId = history.beginRun();
        history.recordTick(1, null, "IDLE", 0, 0, 0);
        history.recordTick(2, 1001, "worker", 0, 0, 0);

        assertEquals(1, history.idleTicks());
        assertEquals(1, history.busyTicks());
        assertEquals(50.0, history.currentRunSamples().getLast().utilizationPercent());
        assertEquals(runId, history.currentRunSamples().getLast().runId());
        for (int tick = 3; tick <= SimulationAnalyticsHistory.MAX_SAMPLES + 10; tick++) {
            history.recordTick(tick, 1001, "worker", 0, 0, 0);
        }
        assertEquals(SimulationAnalyticsHistory.MAX_SAMPLES, history.currentRunSamples().size());
        assertTrue(history.historyTruncated());
        assertEquals(SimulationAnalyticsHistory.MAX_SAMPLES + 10,
                history.currentRunSamples().getLast().simulationTime());
    }
}
