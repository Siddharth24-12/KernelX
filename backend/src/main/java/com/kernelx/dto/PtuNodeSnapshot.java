package com.kernelx.dto;
/** nodeId is the logical identifier derived from PID; it is not a memory address. */
public record PtuNodeSnapshot(int nodeId, int pid, String name, String state, int parentPid, Integer firstChildPid, Integer nextSiblingPid) { }
