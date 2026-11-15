package com.kernelx.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest @AutoConfigureMockMvc
class PtuApiIntegrationTest {
    private static final Path DATA = directory(); private static final int ROOT=87001, CHILD_A=87002, CHILD_B=87003, GRANDCHILD=87004, SECOND_ROOT=87005;
    @Autowired MockMvc mvc; @Autowired ObjectMapper mapper;
    @DynamicPropertySource static void props(DynamicPropertyRegistry r) { r.add("kernelx.data-directory", () -> DATA.toString()); }

    @Test void reportsActualLinksAndDiagnosticReadsNeverRecordOperations() throws Exception {
        mvc.perform(get("/api/dsa/ptu/snapshot")).andExpect(status().isOk()).andExpect(jsonPath("$.size").value(0)).andExpect(jsonPath("$.rootCount").value(0)).andExpect(jsonPath("$.nodes").isEmpty());
        create(ROOT,-1); create(CHILD_A,ROOT); create(CHILD_B,ROOT); create(GRANDCHILD,CHILD_A); create(SECOND_ROOT,-1);
        JsonNode snap = snapshot();
        assertEquals(5,snap.path("size").asInt()); assertEquals(2,snap.path("rootCount").asInt());
        assertEquals(ROOT,snap.path("rootPids").get(0).asInt()); assertEquals(SECOND_ROOT,snap.path("rootPids").get(1).asInt());
        assertEquals(CHILD_A,node(snap,ROOT).path("firstChildPid").asInt());
        assertEquals(CHILD_B,node(snap,CHILD_A).path("nextSiblingPid").asInt());
        assertEquals(GRANDCHILD,node(snap,CHILD_A).path("firstChildPid").asInt());
        JsonNode summaries=traces(); assertTrue(summaries.size()>=4);
        JsonNode insert=summaries.get(summaries.size()-1); String id=insert.path("traceId").asText();
        JsonNode trace=mapper.readTree(mvc.perform(get("/api/dsa/ptu/traces/{id}",id)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertTrue(containsOperation(trace,"NEXT_SIBLING_UPDATE"));
        JsonNode childInsert = null; for(JsonNode summary:summaries) if(summary.path("targetPid").asInt()==CHILD_A) childInsert=summary;
        assertNotNull(childInsert);
        JsonNode childTrace=mapper.readTree(mvc.perform(get("/api/dsa/ptu/traces/{id}",childInsert.path("traceId").asText())).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertTrue(containsOperation(childTrace,"FIRST_CHILD_UPDATE"));
        int count=summaries.size();
        for(int i=0;i<5;i++){snapshot();traces();mvc.perform(get("/api/dsa/ptu/traces/{id}",id)).andExpect(status().isOk());mvc.perform(get("/api/processes/tree")).andExpect(status().isOk());}
        assertEquals(count,traces().size());
        mvc.perform(delete("/api/processes/{pid}",CHILD_A)).andExpect(status().isNoContent());
        JsonNode after=snapshot(); assertTrue(find(after,CHILD_A)==null); assertTrue(find(after,GRANDCHILD)==null);
        assertEquals(CHILD_B,node(after,ROOT).path("firstChildPid").asInt());
        JsonNode removal=traces().get(traces().size()-1);
        JsonNode removalTrace=mapper.readTree(mvc.perform(get("/api/dsa/ptu/traces/{id}",removal.path("traceId").asText())).andReturn().getResponse().getContentAsString());
        assertTrue(containsOperation(removalTrace,"NODE_REMOVAL"));
        mvc.perform(get("/api/dsa/ptu/traces/no-such-trace")).andExpect(status().isNotFound());
    }

    private void create(int pid,int parent)throws Exception{mvc.perform(post("/api/processes").contentType(MediaType.APPLICATION_JSON).content("{\"pid\":%d,\"name\":\"p%d\",\"priority\":2,\"arrivalTime\":0,\"burstTime\":2,\"memoryRequirement\":8,\"parentPid\":%d}".formatted(pid,pid,parent))).andExpect(status().isCreated());}
    private JsonNode snapshot()throws Exception{return mapper.readTree(mvc.perform(get("/api/dsa/ptu/snapshot")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());}
    private JsonNode traces()throws Exception{return mapper.readTree(mvc.perform(get("/api/dsa/ptu/traces")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());}
    private static JsonNode node(JsonNode tree,int pid){return find(tree,pid);}
    private static JsonNode find(JsonNode tree,int pid){for(JsonNode n:tree.path("nodes"))if(n.path("pid").asInt()==pid)return n;return null;}
    private static boolean containsOperation(JsonNode trace,String operation){for(JsonNode s:trace.path("steps"))if(operation.equals(s.path("operation").asText()))return true;return false;}
    private static Path directory(){try{return Files.createTempDirectory("kernelx-ptu-"+UUID.randomUUID());}catch(Exception e){throw new ExceptionInInitializerError(e);}}
}
