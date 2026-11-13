package com.kernelx.config;

import com.kernelx.model.SystemEvent;
import com.kernelx.service.EventLogPersistenceService;
import com.kernelx.service.EventManager;
import com.kernelx.service.ProcessManager;
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
    ProcessManager processManager(EventManager events) { return new ProcessManager(events); }

    @Bean
    SchedulingService schedulingService() { return new SchedulingService(); }
}
