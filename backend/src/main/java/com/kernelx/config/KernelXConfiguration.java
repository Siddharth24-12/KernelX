package com.kernelx.config;

import com.kernelx.model.SystemEvent;
import com.kernelx.service.EventLogPersistenceService;
import com.kernelx.service.EventManager;
import com.kernelx.service.HeapTraceRecorder;
import com.kernelx.service.FpbTraceRecorder;
import com.kernelx.service.ProcessManager;
import com.kernelx.service.ProcessListTraceRecorder;
import com.kernelx.service.AluTraceRecorder;
import com.kernelx.service.ProcessTreeTraceRecorder;
import com.kernelx.service.SchedulingService;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class KernelXConfiguration {
    @Bean
    EventManager eventManager(EventLogPersistenceService storage) {
        List<SystemEvent> previousEvents = storage.findAll();
        long nextId = previousEvents.stream().mapToLong(SystemEvent::eventId).max().orElse(0) + 1;
        return new EventManager(storage::append, nextId);
    }

    @Bean
    ProcessListTraceRecorder processListTraceRecorder() { return new ProcessListTraceRecorder(); }

    @Bean
    AluTraceRecorder aluTraceRecorder() { return new AluTraceRecorder(); }

    @Bean
    ProcessTreeTraceRecorder processTreeTraceRecorder() { return new ProcessTreeTraceRecorder(); }

    @Bean
    ProcessManager processManager(EventManager events, ProcessListTraceRecorder traces, AluTraceRecorder aluTraces, ProcessTreeTraceRecorder treeTraces) {
        return new ProcessManager(events, traces, aluTraces, treeTraces);
    }

    @Bean
    HeapTraceRecorder heapTraceRecorder() { return new HeapTraceRecorder(); }

    @Bean
    FpbTraceRecorder fpbTraceRecorder() { return new FpbTraceRecorder(); }

    @Bean
    SchedulingService schedulingService(HeapTraceRecorder traces, FpbTraceRecorder fpbTraces) {
        return new SchedulingService(traces, fpbTraces);
    }
}
