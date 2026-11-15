package com.kernelx.dto;
public record PtuTraceStep(long sequence, String operation, Integer currentPid, Integer parentPid,
    Integer firstChildBefore, Integer firstChildAfter, Integer nextSiblingBefore, Integer nextSiblingAfter,
    Integer visitedPid, String pointerChange, Integer pointerBeforePid, Integer pointerAfterPid, String description) { }
