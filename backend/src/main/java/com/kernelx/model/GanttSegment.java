package com.kernelx.model;

/** A half-open [startTime,endTime) CPU execution interval; pid -1 represents idle. */
public record GanttSegment(int pid, String processName, int startTime, int endTime, int duration, boolean idle) {
    public static GanttSegment idle(int start, int end) {
        return new GanttSegment(-1, "IDLE", start, end, end - start, true);
    }
}
